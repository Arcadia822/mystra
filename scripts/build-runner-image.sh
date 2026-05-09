#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_CONTEXT="${MYSTRA_RUNNER_IMAGE_CONTEXT:-/tmp/mystra-castrel-runner-image}"
IMAGE_TAG="${MYSTRA_CASTREL_IMAGE_TAG:-mystra-castrel-runner:local}"

if [ ! -f "$IMAGE_CONTEXT/Dockerfile" ]; then
  echo "Missing local runner image context: $IMAGE_CONTEXT" >&2
  echo "This Castrel-oriented image is intentionally not stored in the Mystra git repository." >&2
  exit 1
fi

build_args=()
for name in HTTP_PROXY HTTPS_PROXY ALL_PROXY NO_PROXY http_proxy https_proxy all_proxy no_proxy; do
  if [ -n "${!name:-}" ]; then
    build_args+=(--build-arg "$name=${!name}")
  fi
done

cd "$ROOT_DIR"
printf 'Building local Castrel runner image %s from %s. Projects reference it through Project.runtime.image when desired.\n' "$IMAGE_TAG" "$IMAGE_CONTEXT"
docker build --progress=plain "${build_args[@]}" -t "$IMAGE_TAG" -f "$IMAGE_CONTEXT/Dockerfile" "$IMAGE_CONTEXT"
