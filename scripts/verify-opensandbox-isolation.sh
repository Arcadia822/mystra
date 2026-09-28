#!/usr/bin/env bash
#
# OpenSandbox isolation probes for the MYST-38 deployment gate (host-c1).
#
# Runs disposable containers only: no lifecycle service, no host mounts, no host ports,
# no real credentials. It reproduces the two Gate 0a questions against the exact execd
# build the deployment injects into every sandbox:
#
#   R1  execd started WITHOUT an access token (deployment default): does an unauthenticated
#       POST /command from an unprivileged (uid 65534) in-container process execute, and as
#       which uid?  (Root means the sandbox does not contain its own guest.)
#   R3  cross-sandbox reachability: with the deployment's `network_mode = "bridge"`, can a
#       guest container reach a *different* sandbox's execd on the shared docker bridge?
#   R2  execd started WITH `-access-token`: is the unauthenticated call rejected, does the
#       authenticated call still run as a non-root uid, and can the uid 65534 process read
#       the token from its environment, /proc/1/environ or /proc/1/cmdline?
#
# Usage: verify-opensandbox-isolation.sh [--keep]
# Environment: EXECD_IMAGE, EXECD_PORT, FAKE_TOKEN, PROBE_USER
#
set -euo pipefail

EXECD_IMAGE="${EXECD_IMAGE:-sandbox-registry.cn-zhangjiakou.cr.aliyuncs.com/opensandbox/execd:v1.1.0}"
EXECD_PORT="${EXECD_PORT:-44772}"
FAKE_TOKEN="${FAKE_TOKEN:-fake-isolation-probe-token-do-not-use}"
PROBE_USER="${PROBE_USER:-65534}"
KEEP=0
[ "${1:-}" = "--keep" ] && KEEP=1

verdict=0
result() { printf 'RESULT %-32s %s\n' "$1" "$2"; }
bad() { printf 'FAIL   %s\n' "$1"; verdict=$((verdict + 1)); }

start_execd() { # start_execd <name> [extra execd args...]
  local name="$1"
  shift
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker run -d --name "$name" \
    --network none \
    --cap-drop ALL --cap-add SETUID --cap-add SETGID \
    --security-opt no-new-privileges \
    --entrypoint /execd \
    "$EXECD_IMAGE" "$@" >/dev/null
  local i
  for i in $(seq 1 40); do
    # /health answers 404 on this build; any HTTP status line proves the listener is up.
    if docker exec "$name" wget -q -S -O /dev/null "http://127.0.0.1:${EXECD_PORT}/health" 2>&1 \
        | grep -q 'HTTP/1.1'; then
      return 0
    fi
    sleep 0.5
  done
  printf 'execd in %s did not start listening\n' "$name" >&2
  docker logs "$name" 2>&1 | tail -3 >&2
  return 1
}

command_uid() { # command_uid <container> [token] -> prints "http=<status> uid=<n|none>"
  local name="$1" token="${2:-}"
  local args=(--post-data '{"command":"id"}')
  local out
  args+=(--header "Content-Type: application/json")
  if [ -n "$token" ]; then
    args+=(--header "X-EXECD-ACCESS-TOKEN: ${token}")
  fi
  out="$(docker exec -u "$PROBE_USER" "$name" wget -q -S -O - "${args[@]}" \
    "http://127.0.0.1:${EXECD_PORT}/command" 2>&1 || true)"
  local status uid
  status="$(printf '%s' "$out" | grep -oE 'HTTP/1\.1 [0-9]{3}' | head -1 || true)"
  uid="$(printf '%s' "$out" | grep -oE 'uid=[0-9]+' | head -1 || true)"
  printf '%s uid=%s' "${status:-http=none}" "${uid:-none}"
}

printf '== OpenSandbox offline execd isolation probes ==\n'
printf 'execd image : %s\n' "$EXECD_IMAGE"
printf 'execd digest: %s\n' "$(docker image inspect "$EXECD_IMAGE" --format '{{index .RepoDigests 0}}' 2>/dev/null || echo unknown)"
printf 'execd build : %s\n' "$(docker run --rm --entrypoint /execd "$EXECD_IMAGE" -version 2>&1 \
  | grep -E 'Git Commit|Version ' | tr -d '\r' | paste -sd' ' || true)"

# ---------------------------------------------------------------- R1: no token
if start_execd mystra-probe-notoken; then
  r1="$(command_uid mystra-probe-notoken)"
  printf 'R1 (no token) unauthenticated /command → %s\n' "$r1"
  result "r1.command_result" "$r1"
  if printf '%s' "$r1" | grep -q 'uid=0'; then
    bad "r1: unauthenticated /command in a guest executes as root"
  fi
fi

# ---------------------------------------------------------------- R2: with token
if start_execd mystra-probe-token -access-token "$FAKE_TOKEN"; then
  r2_unauth="$(command_uid mystra-probe-token)"
  r2_auth="$(command_uid mystra-probe-token "$FAKE_TOKEN")"
  printf 'R2 (token) unauthenticated /command → %s\n' "$r2_unauth"
  printf 'R2 (token) authenticated   /command → %s\n' "$r2_auth"
  result "r2.unauth_command_result" "$r2_unauth"
  result "r2.auth_command_result" "$r2_auth"
  if printf '%s' "$r2_unauth" | grep -q 'uid=0'; then
    bad "r2: unauthenticated /command still executes"
  fi
  if printf '%s' "$r2_auth" | grep -q 'uid=0'; then
    bad "r2: authenticated /command executes as root"
  fi

  env_dump="$(docker exec -u "$PROBE_USER" mystra-probe-token sh -c 'env' 2>&1 || true)"
  if printf '%s' "$env_dump" | grep -qF "$FAKE_TOKEN"; then
    bad "r2: token readable from a guest process environment"
    result "r2.token_in_env" "readable"
  else
    result "r2.token_in_env" "not readable"
  fi

  environ="$(docker exec -u "$PROBE_USER" mystra-probe-token sh -c 'cat /proc/1/environ 2>&1 | tr "\0" "\n"' 2>&1 || true)"
  if printf '%s' "$environ" | grep -qF "$FAKE_TOKEN"; then
    bad "r2: token readable from /proc/1/environ"
    result "r2.token_in_proc_environ" "readable"
  else
    result "r2.token_in_proc_environ" "not readable ($(printf '%s' "$environ" | head -c 40))"
  fi

  cmdline="$(docker exec -u "$PROBE_USER" mystra-probe-token sh -c 'cat /proc/1/cmdline 2>&1 | tr "\0" " "' 2>&1 || true)"
  if printf '%s' "$cmdline" | grep -qF "$FAKE_TOKEN"; then
    bad "r2: token readable from world-readable /proc/1/cmdline (argv)"
    result "r2.token_in_proc_cmdline" "readable"
  else
    result "r2.token_in_proc_cmdline" "not readable"
  fi

  result "r2.execd_init_mode" "$(docker exec -u "$PROBE_USER" mystra-probe-token sh -c \
    'cat /proc/1/status 2>/dev/null | grep -iE "^(Name|CapEff)" | tr "\n" " "' 2>&1 | head -c 120)"
fi

# ---------------------------------------------------------------- R3: cross-sandbox
docker rm -f mystra-probe-b mystra-probe-a >/dev/null 2>&1 || true
docker run -d --name mystra-probe-b --network bridge \
  --cap-drop ALL --cap-add SETUID --cap-add SETGID --security-opt no-new-privileges \
  --entrypoint /execd "$EXECD_IMAGE" >/dev/null
docker run -d --name mystra-probe-a --network bridge \
  --cap-drop ALL --cap-add SETUID --cap-add SETGID --security-opt no-new-privileges \
  --entrypoint sh "$EXECD_IMAGE" -c 'sleep infinity' >/dev/null
sleep 2
b_ip="$(docker inspect mystra-probe-b --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')"
printf 'R3 sandbox B execd address from sandbox A: %s (port %s)\n' "$b_ip" "$EXECD_PORT"
r3=""
if [ -n "$b_ip" ]; then
  r3="$(docker exec -u "$PROBE_USER" mystra-probe-a sh -c \
    "wget -q -S -O - --header=\"Content-Type: application/json\" --post-data=\"{\\\"command\\\":\\\"id\\\"}\" http://${b_ip}:${EXECD_PORT}/command" 2>&1 || true)"
fi
r3_status="$(printf '%s' "$r3" | grep -oE 'HTTP/1\.1 [0-9]{3}' | head -1 || true)"
r3_uid="$(printf '%s' "$r3" | grep -oE 'uid=[0-9]+' | head -1 || true)"
result "r3.cross_sandbox_command" "${r3_status:-http=none} ${r3_uid:-uid=none}"
if printf '%s' "$r3" | grep -q 'uid=0'; then
  bad "r3: a guest can run a command as root in another sandbox's execd over the shared bridge"
fi

if [ "$KEEP" -eq 0 ]; then
  docker rm -f mystra-probe-notoken mystra-probe-token mystra-probe-a mystra-probe-b >/dev/null 2>&1 || true
fi

printf '== offline probes: %s ==\n' "$([ "$verdict" -eq 0 ] && echo PASS || echo "$verdict FAILURE(S)")"
exit "$verdict"
