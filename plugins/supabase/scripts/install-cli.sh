#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Install Supabase CLI in a supported mode.

Usage:
  install-cli.sh npm   # npm install supabase --save-dev
  install-cli.sh brew  # brew install supabase/tap/supabase
USAGE
}

mode="${1:-npm}"

case "$mode" in
  npm)
    if ! command -v node >/dev/null 2>&1; then
      echo "Node.js is required for npm-based Supabase CLI installs." >&2
      exit 1
    fi
    major="$(node -p 'process.versions.node.split(".")[0]')"
    if [ "$major" -lt 20 ]; then
      echo "Supabase CLI requires Node.js 20 or later when run through npm/npx." >&2
      exit 1
    fi
    npm install supabase --save-dev
    npx supabase --version
    ;;
  brew)
    if ! command -v brew >/dev/null 2>&1; then
      echo "Homebrew is required for brew mode." >&2
      exit 1
    fi
    brew install supabase/tap/supabase
    supabase --version
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac

