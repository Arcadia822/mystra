#!/usr/bin/env bash
set +x
set -euo pipefail

HOST="${MYSTRA_DEV_HOST:-localhost}"
USER_NAME="${MYSTRA_DEV_USER:-root}"
REMOTE="${USER_NAME}@${HOST}"
REMOTE_DIR="${MYSTRA_REMOTE_DIR:-/opt/mystra}"
REMOTE_ENV_DIR="${MYSTRA_REMOTE_ENV_DIR:-/root/.mystra}"
LOCAL_ENV_FILE="${MYSTRA_RUNNER_ENV_FILE:-$HOME/.mystra/runner.env}"

if [ ! -f "$LOCAL_ENV_FILE" ]; then
  echo "Missing local runner env: $LOCAL_ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$LOCAL_ENV_FILE"
set +a

if [ -z "${MYSTRA_GITLAB_TOKEN:-}" ]; then
  echo "MYSTRA_GITLAB_TOKEN is missing in $LOCAL_ENV_FILE" >&2
  exit 1
fi

echo "Deploying Mystra to $REMOTE:$REMOTE_DIR"

write_env() {
  local key="$1"
  local value="$2"
  printf '%s=%q\n' "$key" "$value"
}

ssh "$REMOTE" "mkdir -p '$REMOTE_DIR' '$REMOTE_ENV_DIR' '$REMOTE_ENV_DIR/cache' '$REMOTE_ENV_DIR/workspaces'"

rsync -az --delete \
  --exclude '.git/' \
  --exclude '.next/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude '.turbo/' \
  --exclude '.DS_Store' \
  --exclude '.secrets/' \
  ./ "$REMOTE:$REMOTE_DIR/"

tmp_env="$(mktemp)"
chmod 600 "$tmp_env"
{
  write_env MYSTRA_EXECUTOR docker
  write_env MYSTRA_RUNNER_IMAGE mystra-runner:local
  write_env MYSTRA_GITLAB_TOKEN "$MYSTRA_GITLAB_TOKEN"
  write_env MYSTRA_GITLAB_HTTP_BASE_URL "${MYSTRA_GITLAB_HTTP_BASE_URL:-https://git.cloudwise.com}"
  write_env MYSTRA_CACHE_ROOT "${REMOTE_ENV_DIR}/cache"
  write_env MYSTRA_WORKSPACE_ROOT "${REMOTE_ENV_DIR}/workspaces"
  write_env MYSTRA_CODEX_AUTH_DIR "${REMOTE_ENV_DIR}/codex-home/.codex"
  write_env MYSTRA_PREVIEW_HOST "$HOST"
  write_env MYSTRA_GIT_AUTHOR_NAME "${MYSTRA_GIT_AUTHOR_NAME:-Mystra Runner}"
  write_env MYSTRA_GIT_AUTHOR_EMAIL "${MYSTRA_GIT_AUTHOR_EMAIL:-mystra-runner@example.invalid}"
} >"$tmp_env"

if [ -n "${COPILOT_GITHUB_TOKEN:-}" ]; then
  write_env COPILOT_GITHUB_TOKEN "$COPILOT_GITHUB_TOKEN" >>"$tmp_env"
fi

scp -q "$tmp_env" "$REMOTE:$REMOTE_ENV_DIR/runner.env"
rm -f "$tmp_env"
ssh "$REMOTE" "chmod 600 '$REMOTE_ENV_DIR/runner.env'"

ssh "$REMOTE" "cat >/etc/systemd/system/mystra-control-plane.service <<'UNIT'
[Unit]
Description=Mystra local control plane
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$REMOTE_DIR
Environment=HOME=/root
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=LC_ALL=C.UTF-8
ExecStart=/usr/bin/bash -lc 'set -a; if [ -f /root/.mystra/proxy.env ]; then source /root/.mystra/proxy.env; fi; if [ -f /root/.mystra/sentry.env ]; then source /root/.mystra/sentry.env; fi; set +a; export SENTRY_DSN="\${SENTRY_CONTROL_PLANE_DSN:-\${SENTRY_DSN:-}}"; export SENTRY_ORG="\${SENTRY_ORG:-mystra}"; export SENTRY_PROJECT="\${SENTRY_PROJECT:-mystra-control-plane}"; export SENTRY_TRACES_SAMPLE_RATE="\${SENTRY_TRACES_SAMPLE_RATE:-1.0}"; export SENTRY_ENABLE_LOGS="\${SENTRY_ENABLE_LOGS:-1}"; export MYSTRA_ENABLE_DEBUG_ENDPOINTS="\${MYSTRA_ENABLE_DEBUG_ENDPOINTS:-1}"; pnpm --filter @mystra/control-plane exec next dev -H 0.0.0.0 -p 3000'
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

cat >/etc/systemd/system/mystra-runner.service <<'UNIT'
[Unit]
Description=Mystra local runner daemon
After=network-online.target docker.service mystra-control-plane.service
Wants=network-online.target docker.service

[Service]
Type=simple
WorkingDirectory=$REMOTE_DIR
Environment=HOME=/root
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=LC_ALL=C.UTF-8
ExecStart=/usr/bin/bash -lc 'set -a; source /root/.mystra/runner.env; if [ -f /root/.mystra/proxy.env ]; then source /root/.mystra/proxy.env; fi; if [ -f /root/.mystra/copilot.env ]; then source /root/.mystra/copilot.env; fi; if [ -f /root/.mystra/sentry.env ]; then source /root/.mystra/sentry.env; fi; set +a; export SENTRY_DSN="\${SENTRY_RUNNER_DSN:-\${SENTRY_DSN:-}}"; export SENTRY_ORG="\${SENTRY_ORG:-mystra}"; export SENTRY_PROJECT="\${SENTRY_PROJECT:-mystra-runner}"; export SENTRY_TRACES_SAMPLE_RATE="\${SENTRY_TRACES_SAMPLE_RATE:-1.0}"; export SENTRY_ENABLE_LOGS="\${SENTRY_ENABLE_LOGS:-1}"; MYSTRA_CONTROL_PLANE_URL=http://127.0.0.1:3000 pnpm dev:runner'
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload"

ssh "$REMOTE" "cd '$REMOTE_DIR' && pnpm install --frozen-lockfile"
ssh "$REMOTE" "cd '$REMOTE_DIR' && set -a; if [ -f '$REMOTE_ENV_DIR/proxy.env' ]; then source '$REMOTE_ENV_DIR/proxy.env'; fi; source '$REMOTE_ENV_DIR/runner.env'; set +a; ./scripts/build-runner-image.sh"

ssh "$REMOTE" "systemctl enable mystra-control-plane mystra-runner >/dev/null && systemctl restart mystra-control-plane && sleep 3 && systemctl restart mystra-runner"

echo "Deployment finished."
echo "Control plane: http://$HOST:3000"
echo "Doctor: ssh $REMOTE 'cd $REMOTE_DIR && MYSTRA_CONTROL_PLANE_URL=http://127.0.0.1:3000 pnpm run doctor'"
