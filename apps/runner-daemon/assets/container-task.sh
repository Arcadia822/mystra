#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="/mystra/workspace"
REPO_DIR="${WORKSPACE}/repo"
RESULT_FILE="${WORKSPACE}/result.json"
PROMPT_FILE="${WORKSPACE}/prompt.txt"
FRONTEND_LOG="${WORKSPACE}/frontend-preview.log"
BACKEND_LOG="${WORKSPACE}/backend-preview.log"
QUALITY_LOG="${WORKSPACE}/quality-gate.log"
QUALITY_FIX_PROMPT="${WORKSPACE}/quality-fix-prompt.txt"
QUALITY_FIX_ATTEMPTS="${MYSTRA_QUALITY_FIX_ATTEMPTS:-2}"
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
      fixAttempts: Number(process.env.MYSTRA_QUALITY_FIX_ATTEMPTS_USED || 0),
    },
  };
}
require("fs").writeFileSync(file, JSON.stringify(result, null, 2));
NODE
}

on_error() {
  code=$?
  write_result failed "Container task failed with exit code ${code}" "container_task_failed"
  exit "$code"
}
trap on_error ERR

mkdir -p "$WORKSPACE"
cd "$WORKSPACE"

CLONE_URL="$(node <<'NODE'
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
)"

if [ -d "${MYSTRA_GIT_REFERENCE_PATH:-}" ]; then
  git clone --reference-if-able "$MYSTRA_GIT_REFERENCE_PATH" --branch "$MYSTRA_BASE_BRANCH" "$CLONE_URL" "$REPO_DIR"
else
  git clone --branch "$MYSTRA_BASE_BRANCH" "$CLONE_URL" "$REPO_DIR"
fi
cd "$REPO_DIR"
git checkout -B "$MYSTRA_BRANCH_NAME"
BASE_COMMIT="$(git rev-parse HEAD)"

if [ -n "${NPM_CONFIG_STORE_DIR:-}" ]; then
  pnpm config set store-dir "$NPM_CONFIG_STORE_DIR" --global
elif [ -n "${PNPM_STORE_DIR:-}" ]; then
  pnpm config set store-dir "$PNPM_STORE_DIR" --global
fi

run_agent() {
  agent_prompt_file="$1"
  case "$MYSTRA_AGENT" in
    codex)
      codex exec \
        --dangerously-bypass-approvals-and-sandbox \
        --cd "$REPO_DIR" \
        "$(cat "$agent_prompt_file")"
      ;;
    copilot)
      mkdir -p "$COPILOT_SANDBOX_CLI_CONFIG_DIR" "$COPILOT_SANDBOX_CONFIG_DIR" "$COPILOT_SANDBOX_CACHE_DIR"
      env \
        HOME="$COPILOT_SANDBOX_HOME" \
        XDG_CONFIG_HOME="$COPILOT_SANDBOX_CONFIG_DIR" \
        XDG_CACHE_HOME="$COPILOT_SANDBOX_CACHE_DIR" \
        copilot \
        --config-dir "$COPILOT_SANDBOX_CLI_CONFIG_DIR" \
        --disable-mcp-server linear \
        --deny-url mcp.linear.app \
        --prompt "$(cat "$agent_prompt_file")" \
        --allow-all \
        --no-ask-user \
        --no-color \
        --stream off
      ;;
    *)
      echo "Unsupported agent: $MYSTRA_AGENT" >&2
      exit 2
      ;;
  esac
}

run_agent "$PROMPT_FILE"

if [ -z "$(git status --porcelain)" ] && [ "$(git rev-parse HEAD)" = "$BASE_COMMIT" ]; then
  write_result failed "Agent finished without repository changes" "no_changes"
  exit 0
fi

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
    git diff --name-only "$BASE_COMMIT" HEAD
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

write_quality_fix_prompt() {
  fix_attempt="$1"
  {
    printf 'Mystra quality gate failed after the agent implementation.\n\n'
    printf 'This is fix attempt %s of %s.\n\n' "$fix_attempt" "$QUALITY_FIX_ATTEMPTS"
    printf 'Original task:\n'
    cat "$PROMPT_FILE"
    printf '\n\nQuality gate log tail:\n'
    tail -220 "$QUALITY_LOG" 2>/dev/null || true
    printf '\n\nInstructions:\n'
    printf -- '- Fix only failures caused by your implementation.\n'
    printf -- '- Do not fix or rewrite unrelated pre-existing tests or features.\n'
    printf -- '- If a failure is clearly unrelated to this task, leave the implementation unchanged and summarize that blocker.\n'
    printf -- '- Run the smallest relevant verification after your fix.\n'
    printf -- '- Do not create the MR yourself; Mystra will only create it after the quality gate passes.\n'
  } >"$QUALITY_FIX_PROMPT"
}

quality_fix_attempt=0
while true; do
  if run_quality_gates "$quality_fix_attempt"; then
    break
  fi

  if [ "$quality_fix_attempt" -ge "$QUALITY_FIX_ATTEMPTS" ]; then
    export MYSTRA_QUALITY_FIX_ATTEMPTS_USED="$quality_fix_attempt"
    write_result failed "Quality gate failed during test -> build after ${quality_fix_attempt} fix attempt(s). See quality-gate.log in the retained workspace." "quality_gate_failed"
    exit 0
  fi

  quality_fix_attempt=$((quality_fix_attempt + 1))
  write_quality_fix_prompt "$quality_fix_attempt"
  run_agent "$QUALITY_FIX_PROMPT"
done

git config user.name "${MYSTRA_GIT_AUTHOR_NAME:-Mystra Runner}"
git config user.email "${MYSTRA_GIT_AUTHOR_EMAIL:-mystra-runner@example.invalid}"
if ! git diff --quiet || ! git diff --cached --quiet; then
  git add -A
  git commit -m "${MYSTRA_COMMIT_MESSAGE:-Mystra task ${MYSTRA_TASK_ID}}"
fi
git push -u origin "$MYSTRA_BRANCH_NAME"

start_preview_services() {
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

start_preview_services

node <<'NODE'
const fs = require("fs");
const repo = process.env.MYSTRA_REPO;
const token = process.env.MYSTRA_GITLAB_TOKEN;
const sourceBranch = process.env.MYSTRA_BRANCH_NAME;
const targetBranch = process.env.MYSTRA_BASE_BRANCH;
const title = process.env.MYSTRA_MR_TITLE || `Mystra task ${process.env.MYSTRA_TASK_ID}`;
const qualityNote = "\n- Quality gate: passed (`test -> build`)";
const input = new URL(repo.includes("://") ? repo : "https://" + repo);
const repoUrl = input.protocol === "ssh:"
  ? new URL(input.pathname, new URL(process.env.MYSTRA_GITLAB_HTTP_BASE_URL))
  : input;
const projectPath = repoUrl.pathname.replace(/^\/+/, "").replace(/\.git$/, "");
const apiBase = `${repoUrl.protocol}//${repoUrl.host}/api/v4`;
const endpoint = `${apiBase}/projects/${encodeURIComponent(projectPath)}/merge_requests`;

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
  const backendNote = backendPreviewUrl
    ? "\n- Backend note: the backend port is reserved in the retained container. It may still require repository-specific DB/Redis environment before the backend process stays up."
    : "";
  const loginNote = frontendPreviewUrl
    ? "\n- Preview login: `preview@mystra.local` / `mystra-preview`"
    : "";
  const previewBlock = frontendPreviewUrl
    ? `\n\n---\n\nMystra preview:\n\n- Frontend: ${frontendPreviewUrl}\n- Backend: ${backendPreviewUrl || "not exposed"}\n- Container: ${process.env.HOSTNAME || "unknown"}${loginNote}${qualityNote}${backendNote}\n`
    : "";
  const description = `${process.env.MYSTRA_MR_BODY || process.env.MYSTRA_PROMPT || ""}${previewBlock}`;
  const body = new URLSearchParams({
    source_branch: sourceBranch,
    target_branch: targetBranch,
    title,
    description,
    remove_source_branch: "false",
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "PRIVATE-TOKEN": token,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GitLab MR create failed ${response.status}: ${text}`);
  }
  const mr = JSON.parse(text);
  if (frontendPreviewUrl) {
    const noteBody = new URLSearchParams({
      body: `Mystra preview status:\n\n- Frontend: ${frontendPreviewUrl}\n- Backend port: ${backendPreviewUrl || "not exposed"}\n- Login: preview@mystra.local / mystra-preview\n- Quality gate: passed (test -> build)\n\nThe task container is intentionally kept running for review. Backend may still require repository-specific DB/Redis environment before the process stays up.`,
    });
    await fetch(`${endpoint}/${mr.iid}/notes`, {
      method: "POST",
      headers: {
        "PRIVATE-TOKEN": token,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: noteBody,
    });
  }
  fs.writeFileSync(process.env.RESULT_FILE || "/mystra/workspace/result.json", JSON.stringify({
    status: "succeeded",
    summary: `Created GitLab MR !${mr.iid}`,
    branch: sourceBranch,
    mrUrl: mr.web_url,
    mrIid: mr.iid,
    metadata: {
      repo: projectPath,
      targetBranch,
      frontendPreviewUrl: frontendPreviewUrl || null,
      backendPreviewUrl: backendPreviewUrl || null,
      qualityGate: {
        status: "passed",
        sequence: ["test", "build"],
        logPath: "/mystra/workspace/quality-gate.log",
      },
    },
  }, null, 2));
})().catch((error) => {
  fs.writeFileSync(process.env.RESULT_FILE || "/mystra/workspace/result.json", JSON.stringify({
    status: "failed",
    summary: "GitLab MR creation failed",
    branch: sourceBranch,
    errorCode: "mr_create_failed",
    errorMessage: String(error.message || error),
  }, null, 2));
  process.exit(0);
});
NODE
