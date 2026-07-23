#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="/mystra/workspace"
REPO_DIR="${WORKSPACE}/repo"
PROMPT_FILE="${WORKSPACE}/prompt.txt"
TEST_LOG="${WORKSPACE}/test.log"
BUILD_LOG="${WORKSPACE}/build.log"
PREVIEW_LOG="${WORKSPACE}/preview.log"
BASE_COMMIT_FILE="${WORKSPACE}/base-commit"
AGENT_PROCESS_RESULT_FILE="${WORKSPACE}/agent-process-result.json"

write_phase_output() {
  [ -n "${MYSTRA_PHASE_OUTPUT_FILE:-}" ] || return 0
  mkdir -p "$(dirname "$MYSTRA_PHASE_OUTPUT_FILE")"
  cat >"$MYSTRA_PHASE_OUTPUT_FILE"
}

ensure_workspace() {
  mkdir -p "$WORKSPACE"
  cd "$WORKSPACE"
}

ensure_repo() {
  ensure_workspace
  if [ ! -d "$REPO_DIR/.git" ]; then
    echo "Repository has not been cloned" >&2
    exit 2
  fi
  cd "$REPO_DIR"
}

package_has_script() {
  node -e '
const fs = require("fs");
const script = process.argv[1];
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
process.exit(pkg.scripts && typeof pkg.scripts[script] === "string" ? 0 : 1);
' "$1"
}

repository_url() {
  node <<'NODE'
const repo = process.env.MYSTRA_REPO;
const httpBaseUrl = process.env.MYSTRA_REPOSITORY_HTTP_BASE_URL;
if (!repo) throw new Error("MYSTRA_REPO is required");
const input = new URL(repo.includes("://") ? repo : `https://${repo}`);
const url = input.protocol === "ssh:"
  ? (httpBaseUrl
      ? new URL(input.pathname, new URL(httpBaseUrl))
      : new URL(`https://${input.host}${input.pathname}`))
  : input;
url.username = "";
url.password = "";
process.stdout.write(url.toString());
NODE
}

with_repository_credentials() {
  reference="${MYSTRA_REPOSITORY_AUTH_REFERENCE:-}"
  username="${MYSTRA_REPOSITORY_AUTH_USERNAME:-x-access-token}"
  if [ -z "$reference" ]; then
    echo "MYSTRA_REPOSITORY_AUTH_REFERENCE is required" >&2
    return 2
  fi
  if [ -z "${!reference:-}" ]; then
    echo "Repository credential is unavailable" >&2
    return 2
  fi

  askpass="$(mktemp /tmp/mystra-askpass.XXXXXX)"
  trap 'rm -f "$askpass"' RETURN
  cat >"$askpass" <<'ASKPASS'
#!/usr/bin/env bash
case "$1" in
  *Username*) printf '%s\n' "${MYSTRA_REPOSITORY_AUTH_USERNAME:-x-access-token}" ;;
  *Password*) printf '%s\n' "${!MYSTRA_REPOSITORY_AUTH_REFERENCE}" ;;
  *) exit 1 ;;
esac
ASKPASS
  chmod 700 "$askpass"
  GIT_ASKPASS="$askpass" GIT_TERMINAL_PROMPT=0 "$@"
}

clone_step() {
  ensure_workspace
  clone_url="$(repository_url)"
  if [ -d "$REPO_DIR" ]; then
    rm -rf "$REPO_DIR"
  fi

  if [ -d "${MYSTRA_GIT_REFERENCE_PATH:-}" ]; then
    if ! with_repository_credentials git clone \
      --reference-if-able "$MYSTRA_GIT_REFERENCE_PATH" \
      --dissociate \
      --branch "$MYSTRA_BASE_BRANCH" \
      "$clone_url" \
      "$REPO_DIR"; then
      rm -rf "$REPO_DIR"
      with_repository_credentials git clone \
        --branch "$MYSTRA_BASE_BRANCH" \
        "$clone_url" \
        "$REPO_DIR"
    fi
  else
    with_repository_credentials git clone \
      --branch "$MYSTRA_BASE_BRANCH" \
      "$clone_url" \
      "$REPO_DIR"
  fi

  cd "$REPO_DIR"
  git checkout -B "$MYSTRA_BRANCH_NAME"
  git rev-parse HEAD >"$BASE_COMMIT_FILE"
  node <<'NODE' | write_phase_output
const fs = require("fs");
console.log(JSON.stringify({
  workspacePath: "/mystra/workspace/repo",
  baseCommit: fs.readFileSync("/mystra/workspace/base-commit", "utf8").trim(),
}));
NODE
}

run_agent() {
  node <<'NODE'
const { mkdirSync, readFileSync, writeFileSync } = require("fs");
const { spawn } = require("child_process");
const command = JSON.parse(process.env.MYSTRA_AGENT_COMMAND_JSON || "null");
const agentEnv = JSON.parse(process.env.MYSTRA_AGENT_ENV_JSON || "{}");
const prepareDirs = JSON.parse(process.env.MYSTRA_AGENT_PREPARE_DIRS_JSON || "[]");
const resultFile = process.env.MYSTRA_AGENT_PROCESS_RESULT_FILE;
const stdinFile = process.env.MYSTRA_AGENT_STDIN_FILE || "";
if (!Array.isArray(command) || command.length === 0) {
  throw new Error("MYSTRA_AGENT_COMMAND_JSON must contain a command array");
}
if (!agentEnv || typeof agentEnv !== "object" || Array.isArray(agentEnv)) {
  throw new Error("MYSTRA_AGENT_ENV_JSON must contain an environment object");
}
for (const dir of prepareDirs) {
  if (typeof dir === "string" && dir) mkdirSync(dir, { recursive: true });
}
const stdout = [];
const stderr = [];
const child = spawn(command[0], command.slice(1), {
  cwd: process.env.REPO_DIR || "/mystra/workspace/repo",
  env: { ...process.env, ...agentEnv },
  stdio: ["pipe", "pipe", "pipe"],
});
child.stdin.end(stdinFile ? readFileSync(stdinFile) : undefined);
child.stdout.on("data", (chunk) => {
  stdout.push(Buffer.from(chunk));
  process.stdout.write(chunk);
});
child.stderr.on("data", (chunk) => {
  stderr.push(Buffer.from(chunk));
  process.stderr.write(chunk);
});
child.on("error", (error) => {
  writeFileSync(resultFile, JSON.stringify({
    exitCode: 1,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: String(error.message || error),
  }));
  process.exit(1);
});
child.on("exit", (code, signal) => {
  const exitCode = signal ? 1 : (code ?? 1);
  writeFileSync(resultFile, JSON.stringify({
    exitCode,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8"),
  }));
  process.exit(exitCode);
});
NODE
}

changed_files_json() {
  node <<'NODE'
const { execFileSync } = require("child_process");
const base = require("fs").readFileSync("/mystra/workspace/base-commit", "utf8").trim();
const commands = [
  ["diff", "--name-only", base, "HEAD"],
  ["diff", "--name-only"],
  ["diff", "--cached", "--name-only"],
  ["ls-files", "--others", "--exclude-standard"],
];
const files = new Set();
for (const args of commands) {
  const value = execFileSync("git", args, { encoding: "utf8" });
  for (const file of value.split("\n").filter(Boolean)) files.add(file);
}
console.log(JSON.stringify([...files].sort()));
NODE
}

agent_step() {
  ensure_repo
  if run_agent; then
    exit_code=0
  else
    exit_code=$?
  fi
  changed_files="$(changed_files_json)"
  node - "$changed_files" <<'NODE' | write_phase_output
const fs = require("fs");
const [changedFiles] = process.argv.slice(2);
console.log(JSON.stringify({
  branchName: process.env.MYSTRA_BRANCH_NAME,
  changedFiles: JSON.parse(changedFiles),
  processResult: JSON.parse(fs.readFileSync(process.env.MYSTRA_AGENT_PROCESS_RESULT_FILE, "utf8")),
}));
NODE
  exit "$exit_code"
}

changed_files() {
  {
    git diff --name-only "$(cat "$BASE_COMMIT_FILE")" HEAD
    git diff --name-only
    git diff --cached --name-only
    git ls-files --others --exclude-standard
  } | sort -u
}

docs_only_change() {
  files="$1"
  printf '%s\n' "$files" | awk '
    NF == 0 { next }
    $0 !~ /^(docs\/|.*\.md$|.*\.mdx$)/ { found_non_docs = 1 }
    END { exit found_non_docs ? 1 : 0 }
  '
}

install_dependencies() {
  if [ -f pnpm-lock.yaml ]; then
    pnpm install --frozen-lockfile
  elif [ -f package-lock.json ]; then
    npm ci
  elif [ -f yarn.lock ]; then
    corepack yarn install --immutable
  fi
}

package_command() {
  script="$1"
  if [ -f package.json ] && package_has_script "$script"; then
    if [ -f pnpm-lock.yaml ]; then
      printf 'pnpm %s' "$script"
    elif [ -f yarn.lock ]; then
      printf 'corepack yarn %s' "$script"
    else
      printf 'npm run %s' "$script"
    fi
    return 0
  fi
  return 1
}

write_quality_phase_output() {
  status="$1"
  command="$2"
  duration_ms="$3"
  log_path="$4"
  node - "$status" "$command" "$duration_ms" "$log_path" <<'NODE' | write_phase_output
const [status, command, durationMs, logPath] = process.argv.slice(2);
console.log(JSON.stringify({
  status,
  command,
  durationMs: Number(durationMs),
  logPath,
}));
NODE
}

run_quality_phase() {
  phase="$1"
  log_file="$2"
  ensure_repo
  files="$(changed_files)"
  if [ -n "$files" ] && docs_only_change "$files"; then
    printf 'Docs-only change detected; %s passed without a code command.\n' "$phase" >"$log_file"
    write_quality_phase_output passed "docs-only" 0 "$log_file"
    return 0
  fi

  if command="$(package_command "$phase")"; then
    install_dependencies >>"$log_file" 2>&1
  elif [ "$phase" = "test" ] && [ -f pyproject.toml ]; then
    command="uv run pytest"
  else
    printf 'Required %s command is not defined.\n' "$phase" >"$log_file"
    write_quality_phase_output failed "missing:$phase" 0 "$log_file"
    return 1
  fi

  started="$(date +%s)"
  if sh -lc "$command" >>"$log_file" 2>&1; then
    status=passed
    exit_code=0
  else
    status=failed
    exit_code=$?
  fi
  duration_ms="$(( ($(date +%s) - started) * 1000 ))"
  write_quality_phase_output "$status" "$command" "$duration_ms" "$log_file"
  return "$exit_code"
}

test_step() {
  : >"$TEST_LOG"
  run_quality_phase test "$TEST_LOG"
}

build_step() {
  : >"$BUILD_LOG"
  run_quality_phase build "$BUILD_LOG"
}

preview_step() {
  ensure_repo
  port="${MYSTRA_PREVIEW_PORT:-4173}"
  if package_has_script preview; then
    command="pnpm preview --host 0.0.0.0 --port $port"
  elif package_has_script start; then
    command="pnpm start --host 0.0.0.0 --port $port"
  else
    echo "Repository has no preview or start package script" >&2
    return 1
  fi
  nohup sh -lc "$command" >"$PREVIEW_LOG" 2>&1 &
  preview_pid=$!
  node - "$command" "$preview_pid" "$port" <<'NODE' | write_phase_output
const [command, pid, port] = process.argv.slice(2);
console.log(JSON.stringify({
  command,
  pid: Number(pid),
  port: Number(port),
  logPath: "/mystra/workspace/preview.log",
}));
NODE
}

commit_step() {
  ensure_repo
  git config user.name "${MYSTRA_GIT_AUTHOR_NAME:-Mystra Runner}"
  git config user.email "${MYSTRA_GIT_AUTHOR_EMAIL:-mystra-runner@example.invalid}"
  git add -A
  if ! git diff --cached --quiet; then
    git commit -m "${MYSTRA_COMMIT_MESSAGE:-Mystra task ${MYSTRA_TASK_ID}}"
  fi
  node <<'NODE' | write_phase_output
const { execFileSync } = require("child_process");
console.log(JSON.stringify({
  branchName: process.env.MYSTRA_BRANCH_NAME,
  commitSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
}));
NODE
}

case "${1:-}" in
  clone)
    clone_step
    ;;
  agent)
    agent_step
    ;;
  test)
    test_step
    ;;
  build)
    build_step
    ;;
  preview)
    preview_step
    ;;
  commit)
    commit_step
    ;;
  *)
    echo "Unknown container task command: ${1:-}" >&2
    exit 2
    ;;
esac
