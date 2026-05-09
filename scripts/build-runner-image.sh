#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_TAG="${MYSTRA_RUNNER_IMAGE:-mystra-runner:local}"

build_args=()
for name in HTTP_PROXY HTTPS_PROXY ALL_PROXY NO_PROXY http_proxy https_proxy all_proxy no_proxy; do
  if [ -n "${!name:-}" ]; then
    build_args+=(--build-arg "$name=${!name}")
  fi
done

cd "$ROOT_DIR"
docker build --progress=plain "${build_args[@]}" -t "$IMAGE_TAG" -f packages/runner-image/Dockerfile .
