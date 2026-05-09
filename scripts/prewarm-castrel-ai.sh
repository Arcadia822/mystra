#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${MYSTRA_PROJECT_REPO_DIR:-}"
CACHE_ROOT="${MYSTRA_CACHE_ROOT:-$HOME/.mystra/cache}"
PNPM_STORE="$CACHE_ROOT/pnpm-store"
UV_CACHE="$CACHE_ROOT/uv"
UV_PYTHON_INSTALL_DIR="$CACHE_ROOT/uv-python"

mkdir -p "$CACHE_ROOT/git" "$PNPM_STORE" "$UV_CACHE" "$UV_PYTHON_INSTALL_DIR"

if [ -n "${MYSTRA_PROJECT_REPO_URL:-}" ]; then
  remote="$MYSTRA_PROJECT_REPO_URL"
elif [ -n "$REPO_DIR" ] && [ -d "$REPO_DIR/.git" ]; then
  remote="$(git -C "$REPO_DIR" remote get-url origin)"
else
  echo "Set MYSTRA_PROJECT_REPO_URL or MYSTRA_PROJECT_REPO_DIR to prewarm" >&2
  exit 1
fi

if [ -n "${MYSTRA_GITLAB_TOKEN:-}" ] && [[ "$remote" == https://git.cloudwise.com/* ]]; then
  export GIT_CONFIG_COUNT=1
  export GIT_CONFIG_KEY_0="url.https://oauth2:${MYSTRA_GITLAB_TOKEN}@git.cloudwise.com/.insteadOf"
  export GIT_CONFIG_VALUE_0="https://git.cloudwise.com/"
fi

if command -v sha256sum >/dev/null 2>&1; then
  cache_key="$(printf '%s' "$remote" | sha256sum | awk '{print substr($1, 1, 16)}')"
else
  cache_key="$(printf '%s' "$remote" | shasum -a 256 | awk '{print substr($1, 1, 16)}')"
fi
MIRROR_DIR="$CACHE_ROOT/git/${cache_key}.git"
FRIENDLY_MIRROR="$CACHE_ROOT/git/project.git"

if [ -d "$MIRROR_DIR" ]; then
  git -C "$MIRROR_DIR" remote set-url origin "$remote"
  git -C "$MIRROR_DIR" remote update --prune
else
  git clone --mirror "$remote" "$MIRROR_DIR"
fi
ln -sfn "$MIRROR_DIR" "$FRIENDLY_MIRROR"

tmp_worktree="$(mktemp -d "$CACHE_ROOT/prewarm-project.XXXXXX")"
cleanup() {
  rm -rf "$tmp_worktree"
}
trap cleanup EXIT

git clone --reference-if-able "$MIRROR_DIR" --branch "${MYSTRA_PREWARM_BRANCH:-main}" "$remote" "$tmp_worktree/repo"

if command -v pnpm >/dev/null 2>&1; then
  if [ -f "$tmp_worktree/repo/pnpm-lock.yaml" ]; then
    (
      cd "$tmp_worktree/repo"
      PNPM_STORE_DIR="$PNPM_STORE" NPM_CONFIG_STORE_DIR="$PNPM_STORE" npm_config_store_dir="$PNPM_STORE" \
        pnpm install --frozen-lockfile --ignore-scripts
    )
  fi
  if [ -f "$tmp_worktree/repo/frontend/pnpm-lock.yaml" ]; then
    (
      cd "$tmp_worktree/repo/frontend"
      PNPM_STORE_DIR="$PNPM_STORE" NPM_CONFIG_STORE_DIR="$PNPM_STORE" npm_config_store_dir="$PNPM_STORE" \
        pnpm install --frozen-lockfile --ignore-scripts
    )
  fi
else
  echo "pnpm not found on host; skipped pnpm store prewarm" >&2
fi

if command -v uv >/dev/null 2>&1; then
  if [ -f "$tmp_worktree/repo/backend/uv.lock" ]; then
    (
      cd "$tmp_worktree/repo/backend"
      UV_CACHE_DIR="$UV_CACHE" UV_PYTHON_INSTALL_DIR="$UV_PYTHON_INSTALL_DIR" uv sync --locked \
        || UV_CACHE_DIR="$UV_CACHE" UV_PYTHON_INSTALL_DIR="$UV_PYTHON_INSTALL_DIR" uv sync
    )
  fi
  if [ -f "$tmp_worktree/repo/proxy/uv.lock" ]; then
    (
      cd "$tmp_worktree/repo/proxy"
      UV_CACHE_DIR="$UV_CACHE" UV_PYTHON_INSTALL_DIR="$UV_PYTHON_INSTALL_DIR" uv sync --locked \
        || UV_CACHE_DIR="$UV_CACHE" UV_PYTHON_INSTALL_DIR="$UV_PYTHON_INSTALL_DIR" uv sync
    )
  fi
else
  echo "uv not found on host; skipped uv cache prewarm" >&2
fi

cat >"$CACHE_ROOT/project.env" <<ENV
MYSTRA_CACHE_ROOT=$CACHE_ROOT
MYSTRA_PROJECT_REPO=$remote
MYSTRA_PROJECT_GIT_MIRROR=$MIRROR_DIR
ENV

echo "Prewarmed project caches:"
echo "  git mirror: $MIRROR_DIR"
echo "  pnpm store: $PNPM_STORE"
echo "  uv cache: $UV_CACHE"
echo "  uv python: $UV_PYTHON_INSTALL_DIR"
