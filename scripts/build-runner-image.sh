#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_CONTEXT="$ROOT_DIR/runner-images/copilot"
IMAGE_TAG="${MYSTRA_RUNNER_IMAGE_TAG:-mystra-copilot-runner:1.0.69-0}"

if [ ! -f "$IMAGE_CONTEXT/Dockerfile" ]; then
  echo "Missing repository-owned runner image context: $IMAGE_CONTEXT" >&2
  exit 1
fi

build_args=()
for name in HTTP_PROXY HTTPS_PROXY ALL_PROXY NO_PROXY http_proxy https_proxy all_proxy no_proxy; do
  value="${!name:-}"
  if [ -n "$value" ]; then
    if [[ "$name" != *NO_PROXY* && "$name" != *no_proxy* ]] \
      && [[ "$value" == *"://127.0.0.1:"* || "$value" == *"://localhost:"* ]]; then
      printf 'Skipping loopback-only build proxy from %s; it is not reachable inside BuildKit.\n' "$name"
      continue
    fi
    build_args+=(--build-arg "$name=$value")
  fi
done

cd "$ROOT_DIR"
printf 'Building generic local Copilot runner image %s from %s.\n' "$IMAGE_TAG" "$IMAGE_CONTEXT"
if [ "${#build_args[@]}" -gt 0 ]; then
  docker build --progress=plain "${build_args[@]}" -t "$IMAGE_TAG" -f "$IMAGE_CONTEXT/Dockerfile" "$IMAGE_CONTEXT"
else
  docker build --progress=plain -t "$IMAGE_TAG" -f "$IMAGE_CONTEXT/Dockerfile" "$IMAGE_CONTEXT"
fi
