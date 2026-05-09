#!/usr/bin/env bash
set -euo pipefail

AGENT_DIR="$HOME/Library/LaunchAgents"
UID_VALUE="$(id -u)"

launchctl bootout "gui/${UID_VALUE}" "$AGENT_DIR/com.mystra.runner.plist" >/dev/null 2>&1 || true
launchctl bootout "gui/${UID_VALUE}" "$AGENT_DIR/com.mystra.control-plane.plist" >/dev/null 2>&1 || true

echo "Mystra local services stopped."
