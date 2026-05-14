#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="/mystra/workspace"
REPO_DIR="${WORKSPACE}/repo"
RESULT_FILE="${WORKSPACE}/result.json"
PROMPT_FILE="${WORKSPACE}/prompt.txt"
FRONTEND_LOG="${WORKSPACE}/frontend-preview.log"
BACKEND_LOG="${WORKSPACE}/backend-preview.log"
QUALITY_LOG="${WORKSPACE}/quality-gate.log"
BASE_COMMIT_FILE="${WORKSPACE}/base-commit"
AGENT_PROCESS_RESULT_FILE="${WORKSPACE}/agent-process-result.json"
COPILOT_SANDBOX_HOME="${WORKSPACE}/copilot-home"
COPILOT_SANDBOX_CLI_CONFIG_DIR="${COPILOT_SANDBOX_HOME}/.copilot"
COPILOT_SANDBOX_CONFIG_DIR="${COPILOT_SANDBOX_HOME}/.config"
COPILOT_SANDBOX_CACHE_DIR="${COPILOT_SANDBOX_HOME}/.cache"

write_result() {
  node - "$RESULT_FILE" "$1" "$2" "$3" <<'NODE'
const [file, status, summary, errorCode] = process.argv.slice(2);
const result = {
  status,
  summary,
  branch: process.env.MYSTRA_BRANCH_NAME,
};
if (errorCode) {
  result.errorCode = errorCode;
  result.errorMessage = summary;
}
if (errorCode === "quality_gate_failed") {
  result.metadata = {
    qualityGate: {
      status: "failed",
      sequence: ["test", "build"],
      logPath: "/mystra/workspace/quality-gate.log",
    },
  };
}
require("fs").writeFileSync(file, JSON.stringify(result, null, 2));
NODE
}

write_step_output() {
  if [ -z "${MYSTRA_STEP_OUTPUT_FILE:-}" ]; then
    return 0
  fi
  mkdir -p "$(dirname "$MYSTRA_STEP_OUTPUT_FILE")"
  cat >"$MYSTRA_STEP_OUTPUT_FILE"
}

on_error() {
  code=$?
  write_result failed "Container task failed with exit code ${code}" "container_task_failed"
  exit "$code"
}

ensure_workspace() {
  mkdir -p "$WORKSPACE"
  cd "$WORKSPACE"
}

clone_url() {
  node <<'NODE'
const repo = process.env.MYSTRA_REPO;
const token = process.env.MYSTRA_GITLAB_TOKEN;
if (!repo) throw new Error("MYSTRA_REPO is required");
if (!token) throw new Error("MYSTRA_GITLAB_TOKEN is required");
const input = new URL(repo.includes("://") ? repo : "https://" + repo);
let url;
if (input.protocol === "ssh:") {
  if (!process.env.MYSTRA_GITLAB_HTTP_BASE_URL) {
    throw new Error("MYSTRA_GITLAB_HTTP_BASE_URL is required for ssh GitLab remotes");
  }
  const base = new URL(process.env.MYSTRA_GITLAB_HTTP_BASE_URL);
  url = new URL(input.pathname, base);
} else {
  url = input;
}
url.username = "oauth2";
url.password = token;
console.log(url.toString());
NODE
}

configure_package_managers() {
  if [ -n "${NPM_CONFIG_STORE_DIR:-}" ]; then
    pnpm config set store-dir "$NPM_CONFIG_STORE_DIR" --global
  elif [ -n "${PNPM_STORE_DIR:-}" ]; then
    pnpm config set store-dir "$PNPM_STORE_DIR" --global
  fi
}

ensure_repo() {
  ensure_workspace
  if [ ! -d "$REPO_DIR/.git" ]; then
    echo "Repository has not been cloned yet" >&2
    exit 2
  fi
  cd "$REPO_DIR"
}

base_commit() {
  cat "$BASE_COMMIT_FILE"
}

run_agent() {
  node <<'NODE'
const { mkdirSync, readFileSync, writeFileSync } = require("fs");
const { spawn } = require("child_process");

const command = JSON.parse(process.env.MYSTRA_AGENT_COMMAND_JSON || "null");
const agentEnv = JSON.parse(process.env.MYSTRA_AGENT_ENV_JSON || "{}");
const prepareDirs = JSON.parse(process.env.MYSTRA_AGENT_PREPARE_DIRS_JSON || "[]");
const processResultFile = process.env.MYSTRA_AGENT_PROCESS_RESULT_FILE || "/mystra/workspace/agent-process-result.json";
const stdinFile = process.env.MYSTRA_AGENT_STDIN_FILE || "";

if (!Array.isArray(command) || command.length === 0) {
  throw new Error("MYSTRA_AGENT_COMMAND_JSON must contain a command array");
}
if (!agentEnv || typeof agentEnv !== "object" || Array.isArray(agentEnv)) {
  throw new Error("MYSTRA_AGENT_ENV_JSON must contain an environment object");
}
if (!Array.isArray(prepareDirs)) {
  throw new Error("MYSTRA_AGENT_PREPARE_DIRS_JSON must contain a directory list");
}

for (const dir of prepareDirs) {
  if (typeof dir === "string" && dir.length > 0) {
    mkdirSync(dir, { recursive: true });
  }
}

const stdoutChunks = [];
const stderrChunks = [];
const child = spawn(command[0], command.slice(1), {
  cwd: process.env.REPO_DIR || "/mystra/workspace/repo",
  env: {
    ...process.env,
    ...agentEnv,
  },
  stdio: ["pipe", "pipe", "pipe"],
});
const stdinBuffer = stdinFile ? readFileSync(stdinFile) : null;

if (stdinBuffer) {
  child.stdin.end(stdinBuffer);
} else {
  child.stdin.end();
}

child.stdout.on("data", (chunk) => {
  stdoutChunks.push(Buffer.from(chunk));
  process.stdout.write(chunk);
});
child.stderr.on("data", (chunk) => {
  stderrChunks.push(Buffer.from(chunk));
  process.stderr.write(chunk);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  writeFileSync(processResultFile, JSON.stringify({
    exitCode: code ?? 1,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(stderrChunks).toString("utf8"),
  }, null, 2));
  process.exit(code ?? 1);
});
child.on("error", (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  writeFileSync(processResultFile, JSON.stringify({
    exitCode: 1,
    stdout: Buffer.concat(stdoutChunks).toString("utf8"),
    stderr: message,
  }, null, 2));
  process.exit(1);
});
NODE
}

package_has_script() {
  node -e '
const fs = require("fs");
const script = process.argv[1];
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
process.exit(pkg.scripts && pkg.scripts[script] ? 0 : 1);
' "$1"
}

run_step() {
  label="$1"
  shift
  {
    printf '\n== %s ==\n' "$label"
    printf '+'
    printf ' %q' "$@"
    printf '\n'
  } >>"$QUALITY_LOG"
  "$@" >>"$QUALITY_LOG" 2>&1
}

run_package_script_if_present() {
  dir="$1"
  script="$2"
  if [ ! -f "$dir/package.json" ]; then
    return 0
  fi
  (
    cd "$dir"
    if package_has_script "$script"; then
      run_step "$dir pnpm $script" pnpm "$script" || exit $?
    else
      printf '\n== %s ==\nmissing package script: %s\n' "$dir" "$script" >>"$QUALITY_LOG"
    fi
  )
}

run_backend_tests_if_present() {
  changed_files="${1:-}"
  if [ ! -f backend/pyproject.toml ]; then
    return 0
  fi
  (
    cd backend
    if [ -f uv.lock ]; then
      run_step "backend uv sync" uv sync --locked || exit $?
    else
      run_step "backend uv sync" uv sync || exit $?
    fi
    changed_backend_tests="$(printf '%s\n' "$changed_files" | awk '
      /^backend\/tests\/.*\.py$/ {
        sub(/^backend\//, "")
        print
      }
    ' | tr '\n' ' ')"
    if [ -n "$changed_backend_tests" ]; then
      # Some projects have known unrelated collection failures in parts of the full backend suite.
      # Agent tasks are expected to add or update focused tests, so gate those changed tests.
      run_step "backend pytest changed tests" sh -lc "uv run pytest --no-cov $changed_backend_tests" || exit $?
    elif [ -d tests ]; then
      run_step "backend pytest" uv run pytest --no-cov || exit $?
    else
      printf '\n== backend pytest ==\nmissing tests directory\n' >>"$QUALITY_LOG"
    fi
  )
}

docs_only_change() {
  files="$1"
  printf '%s\n' "$files" | awk '
    NF == 0 { next }
    $0 !~ /^(docs\/|.*\.md$|.*\.mdx$)/ { found_non_docs = 1 }
    END { exit found_non_docs ? 1 : 0 }
  '
}

run_quality_gates() {
  gate_attempt="${1:-0}"
  : >"$QUALITY_LOG"
  printf 'Mystra quality gate: test -> build\n' >>"$QUALITY_LOG"
  printf 'Attempt: %s\n' "$gate_attempt" >>"$QUALITY_LOG"

  changed_files="$( {
    git diff --name-only "$(base_commit)" HEAD
    git diff --name-only
    git diff --cached --name-only
    git ls-files --others --exclude-standard
  } | sort -u )"

  if [ -z "$changed_files" ]; then
    printf 'No changed files detected for quality gate.\n' >>"$QUALITY_LOG"
    return 0
  fi

  printf 'Changed files:\n%s\n' "$changed_files" >>"$QUALITY_LOG"

  if docs_only_change "$changed_files"; then
    printf '\nDocs-only change detected. No code test/build gate is required.\n' >>"$QUALITY_LOG"
    printf '\nQuality gate passed.\n' >>"$QUALITY_LOG"
    return 0
  fi

  if printf '%s\n' "$changed_files" | grep -qE '^(frontend/|package.json|pnpm-lock.yaml|pnpm-workspace.yaml)'; then
    run_step "frontend pnpm install" sh -lc "cd frontend && pnpm install --frozen-lockfile --ignore-scripts" || return $?
    run_package_script_if_present frontend test || return $?
    run_package_script_if_present frontend build || return $?
  fi

  if printf '%s\n' "$changed_files" | grep -qE '^(backend/|pyproject.toml|uv.lock)'; then
    run_backend_tests_if_present "$changed_files" || return $?
  fi

  if ! printf '%s\n' "$changed_files" | grep -qE '^(frontend/|backend/)'; then
    run_package_script_if_present . test || return $?
    run_package_script_if_present . build || return $?
  fi

  printf '\nQuality gate passed.\n' >>"$QUALITY_LOG"
}

write_clone_output() {
  [ -n "${MYSTRA_STEP_OUTPUT_FILE:-}" ] || return 0
  node <<'NODE' | write_step_output
const fs = require("fs");
console.log(JSON.stringify({
  workspacePath: "/mystra/workspace/repo",
  baseCommit: fs.readFileSync("/mystra/workspace/base-commit", "utf8").trim(),
}, null, 2));
NODE
}

changed_files_json() {
  node <<'NODE'
const { execSync } = require("child_process");
const baseCommit = require("fs").readFileSync("/mystra/workspace/base-commit", "utf8").trim();
const output = execSync(`
  {
    git diff --name-only ${JSON.stringify(baseCommit)} HEAD
    git diff --name-only
    git diff --cached --name-only
    git ls-files --others --exclude-standard
  } | sort -u
`, { shell: "/bin/bash" }).toString("utf8").trim();
const changedFiles = output ? output.split("\n").filter(Boolean) : [];
console.log(JSON.stringify(changedFiles));
NODE
}

write_agent_output() {
  no_changes="$1"
  changed_files_json="$2"
  process_result_json="$3"
  node - "$no_changes" "$changed_files_json" "$process_result_json" <<'NODE' | write_step_output
const [noChangesRaw, changedFilesRaw, processResultRaw] = process.argv.slice(2);
console.log(JSON.stringify({
  branchName: process.env.MYSTRA_BRANCH_NAME,
  noChanges: noChangesRaw === "1",
  changedFiles: JSON.parse(changedFilesRaw),
  processResult: JSON.parse(processResultRaw),
}, null, 2));
NODE
}

write_quality_gate_output() {
  status="$1"
  summary="${2:-}"
  error_code="${3:-}"
  node - "$status" "$summary" "$error_code" <<'NODE' | write_step_output
const [status, summary, errorCode] = process.argv.slice(2);
const output = {
  status,
  metadata: {
    qualityGate: {
      status,
      sequence: ["test", "build"],
      logPath: "/mystra/workspace/quality-gate.log",
    },
  },
};
if (summary) {
  output.summary = summary;
}
if (errorCode) {
  output.errorCode = errorCode;
  output.errorMessage = summary;
}
console.log(JSON.stringify(output, null, 2));
NODE
}

write_push_output() {
  node <<'NODE' | write_step_output
console.log(JSON.stringify({
  branchName: process.env.MYSTRA_BRANCH_NAME,
}, null, 2));
NODE
}

clone_step() {
  ensure_workspace
  CLONE_URL="$(clone_url)"
  if [ -d "$REPO_DIR" ]; then
    rm -rf "$REPO_DIR"
  fi

  if [ -d "${MYSTRA_GIT_REFERENCE_PATH:-}" ]; then
    git clone --reference-if-able "$MYSTRA_GIT_REFERENCE_PATH" --branch "$MYSTRA_BASE_BRANCH" "$CLONE_URL" "$REPO_DIR"
  else
    git clone --branch "$MYSTRA_BASE_BRANCH" "$CLONE_URL" "$REPO_DIR"
  fi
  cd "$REPO_DIR"
  git checkout -B "$MYSTRA_BRANCH_NAME"
  git rev-parse HEAD >"$BASE_COMMIT_FILE"
  configure_package_managers
  write_clone_output
}

agent_step() {
  ensure_repo
  if run_agent "$PROMPT_FILE"; then
    run_agent_status=0
  else
    run_agent_status=$?
  fi

  process_result_json="$(cat "$AGENT_PROCESS_RESULT_FILE")"
  changed_files="$(changed_files_json)"
  if [ -z "$(git status --porcelain)" ] && [ "$changed_files" = "[]" ]; then
    if [ -n "${MYSTRA_STEP_OUTPUT_FILE:-}" ]; then
      write_agent_output 1 "$changed_files" "$process_result_json"
      return 0
    fi
    write_result failed "Agent finished without repository changes" "no_changes"
    exit 0
  fi

  write_agent_output 0 "$changed_files" "$process_result_json"
  if [ "$run_agent_status" -ne 0 ]; then
    exit "$run_agent_status"
  fi
}

quality_gate_step() {
  ensure_repo
  if run_quality_gates 0; then
    write_quality_gate_output passed
    return 0
  fi

  if [ -n "${MYSTRA_STEP_OUTPUT_FILE:-}" ]; then
    write_quality_gate_output failed "Quality gate failed during test -> build. See quality-gate.log in the retained workspace." "quality_gate_failed"
    exit 1
  fi

  write_result failed "Quality gate failed during test -> build. See quality-gate.log in the retained workspace." "quality_gate_failed"
  exit 0
}

push_step() {
  ensure_repo
  git config user.name "${MYSTRA_GIT_AUTHOR_NAME:-Mystra Runner}"
  git config user.email "${MYSTRA_GIT_AUTHOR_EMAIL:-mystra-runner@example.invalid}"
  if ! git diff --quiet || ! git diff --cached --quiet; then
    git add -A
    git commit -m "${MYSTRA_COMMIT_MESSAGE:-Mystra task ${MYSTRA_TASK_ID}}"
  fi
  write_push_output
}

start_preview_services() {
  ensure_repo
  if [ -f frontend/package.json ]; then
    (
      cd frontend
      export MYSTRA_PREVIEW_AUTH="${MYSTRA_PREVIEW_AUTH:-1}"
      export MYSTRA_PREVIEW_USER_EMAIL="${MYSTRA_PREVIEW_USER_EMAIL:-preview@mystra.local}"
      export MYSTRA_PREVIEW_USER_PASSWORD="${MYSTRA_PREVIEW_USER_PASSWORD:-mystra-preview}"
      export LOGIN_METHODS="${LOGIN_METHODS:-form}"
      if [ -n "${MYSTRA_FRONTEND_PREVIEW_URL:-}" ]; then
        export NEXTAUTH_URL="${NEXTAUTH_URL:-$MYSTRA_FRONTEND_PREVIEW_URL}"
        export AUTH_URL="${AUTH_URL:-$MYSTRA_FRONTEND_PREVIEW_URL}"
      fi
      node <<'NODE'
const fs = require("fs");

const previewUrl = process.env.MYSTRA_FRONTEND_PREVIEW_URL;
if (!previewUrl) {
  process.exit(0);
}

const host = new URL(previewUrl).hostname;
const candidates = [
  "next.config.mjs",
  "next.config.js",
  "next.config.cjs",
  "next.config.ts",
];
const file = candidates.find((candidate) => fs.existsSync(candidate));
if (!file) {
  process.exit(0);
}

let text = fs.readFileSync(file, "utf8");
if (text.includes("allowedDevOrigins") && text.includes(host)) {
  process.exit(0);
}

if (text.includes("allowedDevOrigins")) {
  text = text.replace(/allowedDevOrigins:\s*\[([^\]]*)\]/, (match, inner) => {
    const trimmed = inner.trim();
    return `allowedDevOrigins: [${trimmed ? `${trimmed}, ` : ""}'${host}']`;
  });
} else if (text.includes("const nextConfig = {")) {
  text = text.replace("const nextConfig = {", `const nextConfig = {\n  allowedDevOrigins: ['${host}'],`);
} else if (text.includes("module.exports = {")) {
  text = text.replace("module.exports = {", `module.exports = {\n  allowedDevOrigins: ['${host}'],`);
} else {
  process.exit(0);
}

fs.writeFileSync(file, text);
NODE
      node <<'NODE'
const fs = require("fs");

const file = "lib/auth/config.ts";
if (!fs.existsSync(file)) {
  process.exit(0);
}

let text = fs.readFileSync(file, "utf8");
if (text.includes("MYSTRA_PREVIEW_AUTH")) {
  process.exit(0);
}

const marker = "        if (!isSmsLogin && !isEmailCodeLogin && !isPasswordLogin) {";
const patch = `        if (process.env.MYSTRA_PREVIEW_AUTH === '1' && isPasswordLogin) {
          const previewEmail = process.env.MYSTRA_PREVIEW_USER_EMAIL || 'preview@mystra.local';
          const previewPassword = process.env.MYSTRA_PREVIEW_USER_PASSWORD || 'mystra-preview';
          if (email === previewEmail && password === previewPassword) {
            return {
              id: 'mystra-preview-user',
              email: previewEmail,
              name: 'Mystra Preview',
              avatar_url: null,
              email_verified: true,
              workspace_id: 'mystra-preview-workspace',
              user_id: 'mystra-preview-user',
              access_token: 'mystra-preview-access-token',
              refresh_token: 'mystra-preview-refresh-token',
              action: 'login_success',
            };
          }
          throw new Error('Invalid preview credentials');
        }

`;

if (text.includes(marker)) {
  text = text.replace(marker, `${patch}${marker}`);
  fs.writeFileSync(file, text);
}
NODE
      node <<'NODE'
const fs = require("fs");

const envRoute = "app/api/docs/env/route.ts";
if (fs.existsSync(envRoute)) {
  let text = fs.readFileSync(envRoute, "utf8");
  if (!text.includes("MYSTRA_PREVIEW_USER_EMAIL")) {
    const marker = "    WORKSPACE_COMPANY_NAME_REQUIRED: process.env.WORKSPACE_COMPANY_NAME_REQUIRED,";
    const patch = `    WORKSPACE_COMPANY_NAME_REQUIRED: process.env.WORKSPACE_COMPANY_NAME_REQUIRED,
    ...(process.env.MYSTRA_PREVIEW_AUTH === '1' && {
      MYSTRA_PREVIEW_AUTH: process.env.MYSTRA_PREVIEW_AUTH,
      MYSTRA_PREVIEW_USER_EMAIL: process.env.MYSTRA_PREVIEW_USER_EMAIL,
      MYSTRA_PREVIEW_USER_PASSWORD: process.env.MYSTRA_PREVIEW_USER_PASSWORD,
    }),`;
    text = text.replace(marker, patch);
    fs.writeFileSync(envRoute, text);
  }
}

const passwordForm = "components/pages/auth/components/PasswordLoginForm.tsx";
if (fs.existsSync(passwordForm)) {
  let text = fs.readFileSync(passwordForm, "utf8");
  if (!text.includes("MYSTRA_PREVIEW_USER_PASSWORD")) {
    text = text.replace(
      "import { createLoginSchema, LoginFormData } from '@/lib/validate/auth';",
      "import { getRuntimeEnvString } from '@/lib/config/runtimeEnv';\nimport { createLoginSchema, LoginFormData } from '@/lib/validate/auth';",
    );
    text = text.replace(
      "  const [showPassword, setShowPassword] = useState(false);",
      `  const [showPassword, setShowPassword] = useState(false);
  const previewAuthEnabled = getRuntimeEnvString('MYSTRA_PREVIEW_AUTH') === '1';
  const previewEmail = getRuntimeEnvString('MYSTRA_PREVIEW_USER_EMAIL') || 'preview@mystra.local';
  const previewPassword = getRuntimeEnvString('MYSTRA_PREVIEW_USER_PASSWORD') || 'mystra-preview';`,
    );
    text = text.replace(
      "      email: '',\n      password: '',",
      "      email: previewAuthEnabled ? previewEmail : '',\n      password: previewAuthEnabled ? previewPassword : '',",
    );
    text = text.replace(
      "        <form onSubmit={form.handleSubmit(onSubmit)} className=\"space-y-6\">",
      `        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {previewAuthEnabled && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <div className="font-medium">Preview login</div>
              <div className="mt-1 font-mono break-all">
                {previewEmail} / {previewPassword}
              </div>
            </div>
          )}`,
    );
    fs.writeFileSync(passwordForm, text);
  }
}
NODE
      pnpm install --frozen-lockfile --ignore-scripts
      nohup pnpm dev --hostname 0.0.0.0 --port 3000 >"$FRONTEND_LOG" 2>&1 &
    ) || true
  fi

  if [ -f backend/pyproject.toml ]; then
    (
      cd backend
      if [ -f uv.lock ]; then
        uv sync --locked || uv sync
      else
        uv sync
      fi
      nohup uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 >"$BACKEND_LOG" 2>&1 &
    ) || true
  fi
}

review_create_step() {
  ensure_repo
  start_preview_services
  OUTPUT_FILE="${MYSTRA_STEP_OUTPUT_FILE:-$RESULT_FILE}" node <<'NODE'
const fs = require("fs");
const outputFile = process.env.OUTPUT_FILE || process.env.RESULT_FILE || "/mystra/workspace/result.json";

async function portIsReachable(url) {
  if (!url) {
    return false;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

(async () => {
  const frontendPreviewUrl =
    fs.existsSync("frontend/package.json") && await portIsReachable("http://127.0.0.1:3000")
      ? process.env.MYSTRA_FRONTEND_PREVIEW_URL
      : "";
  const backendPreviewUrl =
    fs.existsSync("backend/pyproject.toml") && await portIsReachable("http://127.0.0.1:8000")
      ? process.env.MYSTRA_BACKEND_PREVIEW_URL
      : "";
  fs.writeFileSync(outputFile, JSON.stringify({
    frontendPreviewUrl: frontendPreviewUrl || null,
    backendPreviewUrl: backendPreviewUrl || null,
    previewContainer: process.env.HOSTNAME || null,
  }, null, 2));
})().catch((error) => {
  fs.writeFileSync(outputFile, JSON.stringify({
    status: "failed",
    summary: "Review preparation failed",
    branch: process.env.MYSTRA_BRANCH_NAME,
    errorCode: "review_prepare_failed",
    errorMessage: String(error.message || error),
  }, null, 2));
  process.exit(1);
});
NODE
}

run_command() {
  case "${1:-}" in
    clone)
      clone_step
      ;;
    agent)
      agent_step
      ;;
    quality-gate)
      quality_gate_step
      ;;
    push)
      push_step
      ;;
    review-create)
      review_create_step
      ;;
    *)
      echo "Unknown container workflow command: ${1:-}" >&2
      return 2
      ;;
  esac
}

compat_main() {
  echo "Deprecated container workflow entrypoint: use explicit workflow step commands instead of 'main'." >&2
  trap on_error ERR
  run_command clone
  run_command agent
  run_command quality-gate
  run_command push
  run_command review-create
}

case "${1:-}" in
  "")
    echo "Missing container workflow command. Use one of: clone, agent, quality-gate, push, review-create." >&2
    exit 2
    ;;
  clone)
    run_command clone
    ;;
  agent)
    run_command agent
    ;;
  quality-gate)
    run_command quality-gate
    ;;
  push)
    run_command push
    ;;
  review-create)
    run_command review-create
    ;;
  main)
    compat_main
    ;;
  *)
    echo "Unknown container workflow command: ${1}" >&2
    exit 2
    ;;
esac
