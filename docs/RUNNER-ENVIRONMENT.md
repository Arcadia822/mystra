# Runner Environment Notes

These notes document the current preparation done on the development runner host (`$MYSTRA_DEV_HOST`). Use this as input when building the future runner image and provisioning scripts.

## Runner Enrollment And Session Protocol

The control plane and Runner daemon must receive the same
`MYSTRA_RUNNER_REGISTRATION_SECRET`. A Runner enrolls with its stable name and
capabilities; registering the same name preserves the Runner ID and rotates the
issued credential. Only that credential may send heartbeats, claim Sessions, or
complete Session results.

Runner protocol endpoints are internal execution transport. They carry Task
context into a claimed Session and accept internal execution facts plus the
terminal result, but they do not make those facts separate business resources.
The management model exposes only Task, Session, and stable Runner projections.

Example daemon configuration:

```sh
MYSTRA_CONTROL_PLANE_URL=http://127.0.0.1:3000 \
MYSTRA_RUNNER_REGISTRATION_SECRET=shared-enrollment-secret \
MYSTRA_RUNNER_NAME=runner-debian-01 \
pnpm --filter @mystra/runner-daemon start
```

## Host

- Host: `$MYSTRA_DEV_HOST`
- User used during setup: `root`
- OS: Debian GNU/Linux 12 `bookworm`
- Architecture: `x86_64`
- Kernel observed: Linux 6.1 Debian kernel
- SSH key auth: local `~/.ssh/id_rsa.pub` was added to root `authorized_keys`

Rotate the password that was used during initial setup. It was sent through chat during setup, so it should be considered exposed.

## Existing Host Tools

Observed on the host before additional setup:

- Docker: `/usr/bin/docker`, version `29.4.1`
- Node.js: `/usr/bin/node`
- curl: `/usr/bin/curl`
- systemd: available
- tar/gzip: available

## Installed Agent CLIs

### GitHub Copilot CLI

`COPILOT_GITHUB_TOKEN` is an Agent credential only. Repository clone, push, and
pull-request creation receive a short-lived GitHub App installation credential
from the control plane; `MYSTRA_GITHUB_TOKEN` is not a supported Runner input.

- Installed path: `/usr/local/bin/copilot`
- Installed version: `GitHub Copilot CLI 1.0.39`
- Install source used during setup:
  - downloaded `copilot-linux-x64.tar.gz` from GitHub releases on the local machine
  - copied it to the runner because direct runner download was slow
  - installed the extracted binary to `/usr/local/bin/copilot`

Validation:

```sh
/usr/local/bin/copilot --version
set -a
. /root/.mystra/copilot.env
set +a
/usr/local/bin/copilot -p "Reply with exactly: copilot-pat-ok" \
  --silent --stream off --log-level none --no-auto-update \
  --secret-env-vars=COPILOT_GITHUB_TOKEN
```

Container validation:

```sh
docker run --rm \
  --env-file /root/.mystra/copilot.env \
  -v /usr/local/bin/copilot:/usr/local/bin/copilot:ro \
  debian:12 \
  /usr/local/bin/copilot -p "Reply with exactly: copilot-container-ok" \
    --silent --stream off --log-level none --no-auto-update \
    --secret-env-vars=COPILOT_GITHUB_TOKEN
```

Result observed: `copilot-container-ok`.

Notes for image build:

- Runner image should include `ca-certificates`; the minimal Debian container test succeeded but warned that `/etc/ssl/certs` was missing.
- Use `COPILOT_GITHUB_TOKEN` for headless/container use.
- The tested token type was a personal fine-grained GitHub PAT with `Copilot Requests` permission.
- Store the token in a runner secret file or secret manager, not in the image.

### OpenAI Codex CLI

- Installed path: `/usr/local/bin/codex`
- Installed version: `codex-cli 0.125.0`
- Install source used during setup:
  - downloaded `codex-x86_64-unknown-linux-musl.tar.gz` from OpenAI Codex GitHub releases on the local machine
  - copied it to the runner
  - installed the extracted binary to `/usr/local/bin/codex`

Validation:

```sh
/usr/local/bin/codex --version
HOME=/root/.mystra/codex-home /usr/local/bin/codex login status
```

Result observed: `Logged in using ChatGPT`.

Container auth-cache validation:

```sh
docker run --rm \
  -v /usr/local/bin/codex:/usr/local/bin/codex:ro \
  -v /root/.mystra/codex-home/.codex:/root/.codex:ro \
  debian:12 \
  /usr/local/bin/codex login status
```

Result observed: `Logged in using ChatGPT`.

Full execution validation after proxy setup:

```sh
set -a
. /root/.mystra/proxy.env
set +a
HOME=/root/.mystra/codex-home \
  /usr/local/bin/codex exec --dangerously-bypass-approvals-and-sandbox \
  "Reply with exactly: codex-clash-final-ok"
```

Result observed: `codex-clash-final-ok`.

Notes for image build:

- Direct `codex login --device-auth` from this runner failed before proxy setup because `auth.openai.com` returned 403 and `chatgpt.com` timed out.
- Copying local ChatGPT auth cache into `/root/.mystra/codex-home/.codex/auth.json` allowed `codex login status` on Linux and in Docker.
- Codex full execution needs proxy environment variables on this host.
- Do not bake `auth.json` into images. Mount or copy it at runtime as a secret.

## Secrets

Current runner secret directory:

```text
/root/.mystra/
```

Files:

```text
/root/.mystra/copilot.env
/root/.mystra/codex-home/.codex/auth.json
/root/.mystra/proxy.env
```

Expected permissions:

```sh
chmod 700 /root/.mystra
chmod 600 /root/.mystra/copilot.env
chmod 600 /root/.mystra/proxy.env
chmod 600 /root/.mystra/codex-home/.codex/auth.json
```

Do not commit or bake these files into images.

## Proxy / Clash / Mihomo

Installed Mihomo as the Clash-compatible proxy runtime.

- Binary: `/usr/local/bin/mihomo`
- Version: `Mihomo Meta v1.19.23`
- Config directory: `/etc/mihomo`
- Runtime config: `/etc/mihomo/runtime.yaml`
- systemd service: `/etc/systemd/system/mihomo.service`
- Service name: `mihomo.service`
- Mixed proxy listen address: `127.0.0.1:8081`
- Controller listen address: `127.0.0.1:54351`
- `allow-lan`: `false`

Source config:

- Copied local Clash config from `~/.config/clash`
- Generated `/etc/mihomo/runtime.yaml` from profile `1764570123810.yml`
- Set `mixed-port: 8081`
- Set `allow-lan: false`
- Set `external-controller: 127.0.0.1:54351`
- Removed desktop controller secret from runtime config
- Selected proxy groups:
  - `GLOBAL`
  - `♻️ 手动切换`
  - `🧲 OpenAI`
  - `🧲 Claude`
- Current selected node: `🇸🇬 新加坡 01丨1x SG`

Service commands:

```sh
systemctl status mihomo
systemctl restart mihomo
journalctl -u mihomo -n 100 --no-pager
```

Proxy env file:

```text
/root/.mystra/proxy.env
```

Contents shape:

```sh
HTTP_PROXY=http://127.0.0.1:8081
HTTPS_PROXY=http://127.0.0.1:8081
ALL_PROXY=http://127.0.0.1:8081
http_proxy=http://127.0.0.1:8081
https_proxy=http://127.0.0.1:8081
all_proxy=http://127.0.0.1:8081
NO_PROXY=localhost,127.0.0.1,::1
no_proxy=localhost,127.0.0.1,::1
```

Validation:

```sh
curl -x http://127.0.0.1:8081 -I -L --connect-timeout 15 https://api.github.com
curl -x http://127.0.0.1:8081 -I -L --connect-timeout 15 https://chatgpt.com
```

Observed:

- GitHub API through proxy returns HTTP 200.
- ChatGPT through proxy connects, but the website endpoint may return Cloudflare 403 challenge.
- Codex backend execution works when proxy env is sourced.

## Image-Build Implications

Runner image should include at minimum:

- `ca-certificates`

## Sentry Self-Hosted

Sentry was installed on the development host for control-plane and runner debugging.

- Install directory: `/opt/sentry-self-hosted`
- Version: self-hosted `26.4.1`
- Bind address: `0.0.0.0:9000`
- Browser URL: `http://$MYSTRA_DEV_HOST:9000`
- Compose profile: `feature-complete`
- Event retention: `7` days
- Admin credential file: `/root/.mystra/sentry-admin.env`
- Mystra SDK env file: `/root/.mystra/sentry.env`
- `system.url-prefix`: `http://$MYSTRA_DEV_HOST:9000`
- `CSRF_TRUSTED_ORIGINS`: `http://$MYSTRA_DEV_HOST:9000`

Projects:

- `mystra-control-plane`
- `mystra-runner`

Host changes made for Sentry:

- Added `/swapfile` with `16G` swap and persisted it in `/etc/fstab`.
- Installed `socat`.
- Replaced the Docker daemon mirror config with an empty `/etc/docker/daemon.json`; the previous file was saved as `/etc/docker/daemon.json.before-sentry`.
- Added Docker daemon proxy config in `/etc/systemd/system/docker.service.d/http-proxy.conf`.
- Added `mystra-docker-proxy-forward.service`, forwarding `172.17.0.1:18081` to the host proxy on `127.0.0.1:8081` for Docker build/install traffic.
- Configured Sentry CSRF trusted origins for browser access through `http://$MYSTRA_DEV_HOST:9000`.
- Switched Sentry from `errors-only` to `feature-complete` so performance traces and transactions are consumed.
- Enabled Sentry structured logs for the control-plane and runner. Console `log/info/warn/error` calls are forwarded as Sentry logs when `SENTRY_ENABLE_LOGS` is not `0`.

Operational commands:

```sh
cd /opt/sentry-self-hosted
docker compose ps
docker compose up -d
docker compose logs -f web
docker compose restart web nginx taskworker taskscheduler
```

Mystra deployment reads `/root/.mystra/sentry.env` when present. The control-plane receives `SENTRY_CONTROL_PLANE_DSN` as `SENTRY_DSN`; the runner receives `SENTRY_RUNNER_DSN` as `SENTRY_DSN`. These service DSNs use `127.0.0.1:9000` on the development host so SDK traffic bypasses the outbound proxy. Human browser access still uses `http://$MYSTRA_DEV_HOST:9000`.

Control-plane test event:

```sh
curl -sS -X POST http://$MYSTRA_DEV_HOST:3000/api/debug/sentry
```

Sentry logs are available in the `logs` dataset. A local read-only API token may be stored on the operator machine, not on the development host, in `~/.mystra/sentry-api.env`.

```sh
set -a
source ~/.mystra/sentry-api.env
set +a

curl -sS -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "$SENTRY_BASE_URL/api/0/organizations/$SENTRY_ORG/events/?dataset=logs&project=2&field=timestamp&field=message&field=severity&field=trace&statsPeriod=1h&per_page=20"
```
- `git`
- `openssh-client`
- `curl`
- `tar`
- `gzip`
- `bash`
- Node.js 24
- Python 3
- `uv`
- `codex`
- `copilot`

Claude CLI is not part of the MVP runner image or adapter requirement.

Runtime injection:

- Inject `GITLAB_TOKEN` as env var or read-only secret file.
- Inject `COPILOT_GITHUB_TOKEN` as env var or read-only secret file.
- Mount Codex auth cache as read-only directory.
- Source proxy env or pass proxy env vars into containers that run Codex.

Runner-local prewarm caches:

- Maintain a repo mirror/worktree seed cache keyed by repo and base branch.
- Maintain a pnpm store cache in a dedicated runner cache directory.
- Maintain a uv cache in a dedicated runner cache directory.
- Treat all caches as disposable performance hints; fall back to cold clone/install on cache miss or corruption.
- Do not share `node_modules` between Session workspaces.

Container networking:

- Current Mihomo proxy listens only on host loopback.
- Containers can use it if they run with host networking.
- If bridge-networked containers need proxy access, either:
  - expose Mihomo to a bridge-reachable host IP with `allow-lan: true`, or
  - run a sidecar/proxy inside the same container network.

Security boundaries:

- Do not mount host Docker socket into task containers.
- Do not mount host home into task containers.
- Mount only per-run workspace, selected secret files, and controlled cache directories.
- Destroy per-run workspace and copied secrets after container exit.
