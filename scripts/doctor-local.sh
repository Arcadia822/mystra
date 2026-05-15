#!/usr/bin/env bash
set +x
set -euo pipefail

CONTROL_PLANE_URL="${MYSTRA_CONTROL_PLANE_URL:-http://localhost:3000}"
ENV_FILE="${MYSTRA_RUNNER_ENV_FILE:-$HOME/.mystra/runner.env}"

ok() {
  printf 'ok   %s\n' "$1"
}

warn() {
  printf 'warn %s\n' "$1"
}

fail() {
  printf 'fail %s\n' "$1"
}

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  ok "loaded $ENV_FILE"
else
  warn "missing $ENV_FILE"
fi

for name in pnpm docker git node; do
  if command -v "$name" >/dev/null 2>&1; then
    ok "$name: $(command -v "$name")"
  else
    fail "$name not found"
  fi
done

docker_ready=true
if docker info >/dev/null 2>&1; then
  ok "docker daemon reachable"
else
  fail "docker daemon unreachable"
  docker_ready=false
fi

castrel_image="${MYSTRA_CASTREL_IMAGE_TAG:-mystra-castrel-runner:local}"
if [ "$docker_ready" = true ] && docker image inspect "$castrel_image" >/dev/null 2>&1; then
  ok "local Castrel runner image exists: $castrel_image"
elif [ "$docker_ready" = true ]; then
  warn "local Castrel runner image missing: $castrel_image; Projects may reference another Project.runtime.image"
else
  warn "skipping local image check because docker daemon is unavailable"
fi

for var_name in MYSTRA_EXECUTOR MYSTRA_GITLAB_HTTP_BASE_URL MYSTRA_CACHE_ROOT MYSTRA_PREVIEW_HOST; do
  if [ -n "${!var_name:-}" ]; then
    ok "$var_name=${!var_name}"
  else
    warn "$var_name is not set"
  fi
done

for secret_name in MYSTRA_GITLAB_TOKEN COPILOT_GITHUB_TOKEN; do
  if [ -n "${!secret_name:-}" ]; then
    ok "$secret_name=<set>"
  else
    warn "$secret_name is not set"
  fi
done

if curl --noproxy '*' -fsS "$CONTROL_PLANE_URL/api/runners" >/tmp/mystra-runners.json; then
  ok "control plane reachable: $CONTROL_PLANE_URL"
  node <<'NODE'
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("/tmp/mystra-runners.json", "utf8"));
for (const runner of data.runners ?? []) {
  console.log(`ok   runner ${runner.runnerName} executor=${runner.capabilities?.executor ?? "unknown"} active=${runner.activeRunCount}`);
}
if (!data.runners?.length) {
  console.log("warn no runners registered");
}
NODE
else
  fail "control plane unreachable: $CONTROL_PLANE_URL"
fi

cache_root="${MYSTRA_CACHE_ROOT:-$HOME/.mystra/cache}"
for dir in "$cache_root/git" "$cache_root/pnpm-store" "$cache_root/uv" "$cache_root/uv-python"; do
  if [ -d "$dir" ]; then
    ok "cache $(du -sh "$dir" 2>/dev/null | awk '{print $1, $2}')"
  else
    warn "cache missing: $dir"
  fi
done

preview_host="${MYSTRA_PREVIEW_HOST:-}"
if [ -n "$preview_host" ]; then
  ok "preview host configured: $preview_host"
else
  detected="$(node -e 'const os=require("os"); for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family==="IPv4" && !a.internal) { console.log(a.address); process.exit(0); } console.log("localhost")')"
  warn "MYSTRA_PREVIEW_HOST unset; detected preview host would be $detected"
fi

printf '\nPreview containers:\n'
node ./scripts/preview-containers.mjs list 2>/dev/null || true

printf '\nRecent runner log:\n'
tail -240 /tmp/mystra-runner.log 2>/dev/null \
  | grep -E '\[mystra-runner\]|Error:' \
  | tail -40 \
  | sed -E 's/(PRIVATE-TOKEN: )[A-Za-z0-9_:-]+/\1<redacted>/g; s/(oauth2:)[^@]+@/\1<redacted>@/g' || true
