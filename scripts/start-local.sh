#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_DIR="$HOME/Library/LaunchAgents"
UID_VALUE="$(id -u)"

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
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd ${ROOT_DIR} &amp;&amp; pnpm dev:control-plane</string>
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
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>sleep 8 &amp;&amp; cd ${ROOT_DIR} &amp;&amp; set -a; if [ -f ~/.mystra/runner.env ]; then source ~/.mystra/runner.env; fi; set +a; MYSTRA_CONTROL_PLANE_URL=http://localhost:3000 pnpm dev:runner</string>
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
