#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_DIR="$HOME/Library/LaunchAgents"
UID_VALUE="$(id -u)"
NODE_VERSION="$(tr -d '[:space:]' < "$ROOT_DIR/.nvmrc")"

if [ -x "$HOME/.nvm/versions/node/v${NODE_VERSION}/bin/node" ]; then
  NODE_BIN="$HOME/.nvm/versions/node/v${NODE_VERSION}/bin"
elif [ -x "$HOME/.local/share/fnm/node-versions/v${NODE_VERSION}/installation/bin/node" ]; then
  NODE_BIN="$HOME/.local/share/fnm/node-versions/v${NODE_VERSION}/installation/bin"
else
  echo "Missing repository-pinned Node v${NODE_VERSION}; install it before starting Mystra." >&2
  exit 1
fi

COREPACK="$NODE_BIN/corepack"
SERVICE_PATH="$NODE_BIN:$HOME/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

mkdir -p "$AGENT_DIR"

cat >"$AGENT_DIR/com.mystra.control-plane.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.mystra.control-plane</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>cd ${ROOT_DIR} &amp;&amp; PATH=${SERVICE_PATH} ${COREPACK} pnpm dev:control-plane</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/mystra-control-plane.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/mystra-control-plane.log</string>
</dict>
</plist>
PLIST

cat >"$AGENT_DIR/com.mystra.runner.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.mystra.runner</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>sleep 8 &amp;&amp; cd ${ROOT_DIR} &amp;&amp; set -a; if [ -f ~/.mystra/runner.env ]; then . ~/.mystra/runner.env; fi; set +a; PATH=${SERVICE_PATH} MYSTRA_CODEX_PATH=$HOME/bin/codex MYSTRA_COPILOT_PATH=$HOME/.local/bin/copilot MYSTRA_CONTROL_PLANE_URL=http://localhost:3000 ${COREPACK} pnpm dev:runner</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/mystra-runner.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/mystra-runner.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/${UID_VALUE}" "$AGENT_DIR/com.mystra.runner.plist" >/dev/null 2>&1 || true
launchctl bootout "gui/${UID_VALUE}" "$AGENT_DIR/com.mystra.control-plane.plist" >/dev/null 2>&1 || true
launchctl bootstrap "gui/${UID_VALUE}" "$AGENT_DIR/com.mystra.control-plane.plist"
sleep 2
launchctl bootstrap "gui/${UID_VALUE}" "$AGENT_DIR/com.mystra.runner.plist"

echo "Mystra local services started."
echo "Control plane: http://localhost:3000"
echo "Logs: /tmp/mystra-control-plane.log /tmp/mystra-runner.log"
