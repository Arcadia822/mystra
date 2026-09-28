# every sandbox created here is deleted, and the deployed unit/config are left untouched.
#
set -uo pipefail

IMAGE="${IMAGE:-mystra-opensandbox-design:20260928}"
FAKE_TOKEN="fake-myst38-validation-token"
CFG=/tmp/mystra-validate-config.toml
API=http://127.0.0.1:8080
LOG=/tmp/opensandbox-validate.log
KEY=""

[ "$(id -u)" = "0" ] || { echo "run as root"; exit 1; }

api() { # api <method> <path> [body]
  local m="$1" p="$2" b="${3:-}"
  if [ -n "$b" ]; then
    curl -sS -X "$m" -H "OPEN-SANDBOX-API-KEY: $KEY" -H 'Content-Type: application/json' -d "$b" "$API$p"
  else
    curl -sS -X "$m" -H "OPEN-SANDBOX-API-KEY: $KEY" "$API$p"
  fi
}
create_sandbox() { # create_sandbox <json>
  api POST /v1/sandboxes "$1" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("id",""))
except Exception: print("")'
}
container_of() { # container_of <sandbox-id>
  local cid
  cid="$(docker ps -q --filter "name=^sandbox-$1\$" | head -1)"
  if [ -z "$cid" ]; then
    cid="$(docker ps -q --filter "label=opensandbox.io/sandbox-id=$1" | head -1)"
  fi
  printf '%s' "$cid"
}
probe_command() { # probe_command <container> <token|-> [command]
  local c="$1" tok="$2" cmd="${3:-id}"
  local req
  req="{\"command\":\"$cmd\"}"
  if [ "$tok" != "-" ]; then
    docker exec -u 65534 "$c" curl -sS -m 12 -o - -w '\nhttp=%{http_code}\n' \
      -H 'Content-Type: application/json' -H "X-EXECD-ACCESS-TOKEN: $tok" \
      --data "$req" http://127.0.0.1:44772/command 2>&1 | tail -6
  else
    docker exec -u 65534 "$c" curl -sS -m 12 -o - -w '\nhttp=%{http_code}\n' \
      -H 'Content-Type: application/json' \
      --data "$req" http://127.0.0.1:44772/command 2>&1 | tail -6
  fi
}

cp /etc/opensandbox/config.toml "$CFG"
sed -i 's|^host = .*|host = "127.0.0.1"|' "$CFG"
chmod 600 "$CFG"
KEY="$(sed -n 's/^api_key = "\(.*\)"/\1/p' "$CFG")"
[ -n "$KEY" ] || { echo "no api_key in config"; exit 1; }

pkill -f "opensandbox-server --config $CFG" 2>/dev/null
sleep 1
setsid /opt/opensandbox/bin/opensandbox-server --config "$CFG" >"$LOG" 2>&1 &
for i in $(seq 1 60); do
  code="$(curl -s -o /dev/null -m 2 -w '%{http_code}' "$API/v1/sandboxes" 2>/dev/null)"
  [ "$code" = "401" ] && break
  sleep 0.5
done

echo "=== 1. lifecycle API auth (temporary loopback-only listener) ==="
printf 'unauthenticated /v1/sandboxes → %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$API/v1/sandboxes")"
printf 'authenticated   /v1/sandboxes → %s\n' "$(api GET /v1/sandboxes | head -c 120)"

echo
echo "=== 2. guest → host lifecycle API (shared docker bridge) ==="
GW="$(docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}')"
docker run --rm --network bridge --entrypoint sh "$IMAGE" -c \
  "curl -sS -m 4 -o /dev/null -w 'guest→%{remote_ip}:8080 http=%{http_code}' http://${GW}:8080/health; echo \" exit=\$?\"" 2>&1 | tail -2

echo
echo "=== 3. sandbox A: default deployment env (no execd token) ==="
SB_A="$(create_sandbox "{\"image\":{\"uri\":\"$IMAGE\"},\"resourceLimits\":{\"cpu\":\"1\",\"memory\":\"2Gi\"},\"entrypoint\":[\"tail\",\"-f\",\"/dev/null\"],\"timeout\":900,\"metadata\":{\"owner\":\"myst38-validation\",\"variant\":\"default\"}}")"
printf 'sandbox A id: %s\n' "$SB_A"
CID_A="$(container_of "$SB_A")"
printf 'container A: %s\n' "$CID_A"

echo "--- tools inside sandbox A (as uid 65534)"
docker exec -u 65534 "$CID_A" sh -c '
  echo "uid=$(id -u) pwd=$(pwd)"
  gh --version | head -1
  linctl --version | head -1
  taco-cli --version | head -1
  git --version
  node --version
' 2>&1 | tail -8

echo "--- in-sandbox execd, unauthenticated /command from uid 65534"
probe_command "$CID_A" -
echo "--- execd pid1 inside sandbox A"
docker exec "$CID_A" sh -c 'ls -l /proc/1/exe 2>/dev/null; cat /proc/1/cmdline 2>/dev/null | tr "\0" " "; echo'
echo "--- sandbox A security posture"
docker inspect "$CID_A" --format 'net={{.HostConfig.NetworkMode}} capDrop={{json .HostConfig.CapDrop}} capAdd={{json .HostConfig.CapAdd}} secOpt={{.HostConfig.SecurityOpt}} binds={{json .HostConfig.Binds}} publishHostIP={{.HostConfig.PortBindings}}'

echo
echo "=== 4. sandbox B: per-sandbox execd access token supplied via env ==="
SB_B="$(create_sandbox "{\"image\":{\"uri\":\"$IMAGE\"},\"resourceLimits\":{\"cpu\":\"1\",\"memory\":\"2Gi\"},\"entrypoint\":[\"tail\",\"-f\",\"/dev/null\"],\"timeout\":900,\"env\":{\"EXECD_ACCESS_TOKEN\":\"$FAKE_TOKEN\"},\"metadata\":{\"owner\":\"myst38-validation\",\"variant\":\"token\"}}")"
printf 'sandbox B id: %s\n' "$SB_B"
CID_B="$(container_of "$SB_B")"
printf 'container B: %s\n' "$CID_B"
if [ -n "$CID_B" ]; then
  echo "--- unauthenticated /command from uid 65534 (expect rejection)"
  probe_command "$CID_B" -
  echo "--- authenticated /command from uid 65534"
  probe_command "$CID_B" "$FAKE_TOKEN"
  echo "--- workload spawned *by execd*: does it inherit the token?"
  probe_command "$CID_B" "$FAKE_TOKEN" 'env | grep -c EXECD_ACCESS_TOKEN; cat /proc/1/cmdline | tr "\\0" " "'
  echo "--- direct uid 65534 read of /proc/1/environ and /proc/1/cmdline in sandbox B"
  docker exec -u 65534 "$CID_B" sh -c 'cat /proc/1/cmdline | tr "\0" " "; echo; cat /proc/1/environ 2>&1 | head -c 120; echo'
fi

echo
echo "=== 5. cross-sandbox reachability (shared bridge) ==="
if [ -n "$CID_A" ] && [ -n "$CID_B" ]; then
  IP_B="$(docker inspect "$CID_B" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')"
  printf 'sandbox B execd ip from sandbox A: %s\n' "$IP_B"
  docker exec -u 65534 "$CID_A" sh -c \
    "curl -sS -m 8 -o - -w '\nhttp=%{http_code}\n' -H 'Content-Type: application/json' --data '{\"command\":\"id\"}' http://${IP_B}:44772/command" 2>&1 | tail -6
fi

echo
echo "=== 6. cleanup ==="
for sb in "$SB_A" "$SB_B"; do
  [ -n "$sb" ] || continue
  printf 'DELETE %s → %s\n' "$sb" "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE -H "OPEN-SANDBOX-API-KEY: $KEY" "$API/v1/sandboxes/$sb")"
done
sleep 3
printf 'containers left: %s\n' "$(docker ps --format '{{.Names}}' | tr '\n' ' ')"
printf 'sandboxes listed: %s\n' "$(api GET /v1/sandboxes | head -c 200)"

echo
echo "=== 7. deployed binding exposure: same server with host = 0.0.0.0 (config as deployed) ==="
pkill -f "opensandbox-server --config $CFG" 2>/dev/null
sleep 1
cp /etc/opensandbox/config.toml "$CFG"
chmod 600 "$CFG"
grep -E '^host = ' "$CFG" | sed 's/^/deployed config: /'
setsid /opt/opensandbox/bin/opensandbox-server --config "$CFG" >"$LOG" 2>&1 &
for i in $(seq 1 60); do
  [ "$(curl -s -o /dev/null -m 2 -w '%{http_code}' "$API/v1/sandboxes")" = "401" ] && break
  sleep 0.5
done
printf 'host-side authenticated /v1/sandboxes → %s\n' "$(api GET /v1/sandboxes | head -c 60)"
printf 'guest (bridge) → %s:8080/health: ' "$GW"
docker run --rm --network bridge --entrypoint sh "$IMAGE" -c \
  "curl -sS -m 4 -o /dev/null -w 'http=%{http_code}' http://${GW}:8080/health; echo \" exit=\$?\"" 2>&1 | tail -1

echo
echo "=== 8. stop validation server and report unit state ==="
pkill -f "opensandbox-server --config $CFG" 2>/dev/null
sleep 1
printf 'validation server processes: %s\n' "$(pgrep -fc "opensandbox-server --config $CFG" || echo 0)"
printf 'opensandbox.service active=%s enabled=%s\n' "$(systemctl is-active opensandbox.service)" "$(systemctl is-enabled opensandbox.service)"
rm -f "$CFG"
