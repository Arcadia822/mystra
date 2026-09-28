#!/usr/bin/env bash
#
# Verify a built Mystra OpenSandbox design sandbox image (MYST-38).
#
# Checks, against the image itself rather than the Dockerfile text:
#   1. platform is linux/amd64;
#   2. gh, linctl, taco-cli (plus git/node/bash) exist and are executable with no network;
#   3. no credential material is baked in: no auth files, no credential-bearing env vars,
#      no host keys or tokens anywhere in the image filesystem.
#
# Usage: scripts/verify-opensandbox-design-image.sh <image-ref>
#
set -euo pipefail

IMAGE="${1:-mystra-opensandbox-design:20260928}"
failures=0

report() { printf '%-52s %s\n' "$1" "$2"; }
check() { # check <label> <expected> <actual>
  if [ "$2" = "$3" ]; then
    report "$1" "OK ($3)"
  else
    report "$1" "FAIL (expected $2, got $3)"
    failures=$((failures + 1))
  fi
}

printf '== Verifying %s ==\n' "$IMAGE"

check "platform os/arch" "linux/amd64" \
  "$(docker image inspect "$IMAGE" --format '{{.Os}}/{{.Architecture}}')"

# --- tools ---------------------------------------------------------------
tool_report="$(docker run --rm --network none --entrypoint sh "$IMAGE" -c '
  gh --version 2>/dev/null | head -1
  linctl --version 2>/dev/null | head -1
  taco-cli --version 2>/dev/null | sed -n "s/.*\"binaryVersion\": \"\([^\"]*\)\".*/taco-cli \1/p"
  git --version 2>/dev/null | head -1
  node --version 2>/dev/null | head -1
' 2>&1)"
printf '%s\n' "$tool_report" | sed 's/^/  /'

for tool in gh linctl taco-cli git node; do
  if printf '%s\n' "$tool_report" | grep -q "^${tool}"; then
    report "tool present: $tool" "OK"
  else
    report "tool present: $tool" "FAIL (missing)"
    failures=$((failures + 1))
  fi
done

# --- credential absence --------------------------------------------------
env_secrets="$(docker image inspect "$IMAGE" --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -Ei '(^|_)(API_KEY|ACCESS_TOKEN|AUTH_TOKEN|SECRET|PASSWORD|CREDENTIALS)=' || true)"
if [ -z "$env_secrets" ]; then
  report "no credential-bearing ENV in image config" "OK"
else
  report "no credential-bearing ENV in image config" "FAIL"
  printf '%s\n' "$env_secrets" | sed 's/=.*/=<redacted>/' | sed 's/^/  /'
  failures=$((failures + 1))
fi

credential_files="$(docker run --rm --network none --entrypoint sh "$IMAGE" -c '
  for p in /root/.linctl-auth.json /root/.config/linctl/config.json /root/.config/gh/hosts.yml \
           /root/.netrc /root/.npmrc /root/.ssh/id_rsa /root/.ssh/id_ed25519 /root/.git-credentials \
           /root/.docker/config.json; do
    [ -e "$p" ] && echo "$p"
  done
  find / -xdev \( -name "hosts.yml" -o -name "id_rsa" -o -name "id_ed25519" -o -name ".netrc" \
       -o -name ".git-credentials" -o -name "*-auth.json" -o -name "credentials.json" \) \
       -not -path "/proc/*" -not -path "/sys/*" 2>/dev/null
  true
' 2>&1)"
if [ -z "$credential_files" ]; then
  report "no credential files in image filesystem" "OK"
else
  report "no credential files in image filesystem" "FAIL"
  printf '%s\n' "$credential_files" | sed 's/^/  /'
  failures=$((failures + 1))
fi

# Token-shaped strings outside the toolchain's own code (the CLI implementations contain
# placeholder text, so the version/help paths of the installed CLIs are excluded).
token_hits="$(docker run --rm --network none --entrypoint sh "$IMAGE" -c '
  grep -rIlE "gho_[A-Za-z0-9]{30,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|lin_api_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{32,}" \
    /root /home /etc /workspace /usr/local/bin /var/lib 2>/dev/null || true
' 2>&1)"
if [ -z "$token_hits" ]; then
  report "no token-shaped strings in writable/config paths" "OK"
else
  report "no token-shaped strings in writable/config paths" "FAIL"
  printf '%s\n' "$token_hits" | sed 's/^/  /'
  failures=$((failures + 1))
fi

printf '== %s: %s ==\n' "$IMAGE" "$([ "$failures" -eq 0 ] && echo PASS || echo "$failures CHECK(S) FAILED")"
exit "$failures"
