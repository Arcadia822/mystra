#!/usr/bin/env bash
#
# Build the Mystra OpenSandbox design sandbox image (MYST-38).
#
# The recipe lives in runner-images/opensandbox-design/Dockerfile. This script pins:
#   - the host architecture (linux/amd64, matching host-c1);
#   - the base image (tag + expected RepoDigest);
#   - every third-party artifact checksum (enforced inside the Dockerfile);
# and then runs scripts/verify-opensandbox-design-image.sh for tool/credential checks.
#
# Usage:
#   scripts/build-opensandbox-design-image.sh
#
# Environment:
#   MYSTRA_DESIGN_IMAGE_TAG      target tag (default mystra-opensandbox-design:20260928)
#   MYSTRA_DESIGN_BASE_IMAGE     base image ref (default node:22-bookworm-slim)
#   MYSTRA_DESIGN_BASE_DIGEST    expected repo digest of the base image (default pinned below)
#   MYSTRA_DESIGN_BASE_MIRROR    registry mirror used only to fetch the base image
#                                (e.g. docker.m.daocloud.io) before it is re-tagged locally
#   MYSTRA_DESIGN_PLATFORM       build platform (default linux/amd64)
#   MYSTRA_DESIGN_SKIP_BASE_PIN  set to 1 to skip the base image digest assertion
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_CONTEXT="$ROOT_DIR/runner-images/opensandbox-design"
VERIFY_SCRIPT="$ROOT_DIR/scripts/verify-opensandbox-design-image.sh"

IMAGE_TAG="${MYSTRA_DESIGN_IMAGE_TAG:-mystra-opensandbox-design:20260928}"
PLATFORM="${MYSTRA_DESIGN_PLATFORM:-linux/amd64}"
BASE_IMAGE="${MYSTRA_DESIGN_BASE_IMAGE:-node:22-bookworm-slim}"
# RepoDigest of the linux/amd64 manifest of node:22-bookworm-slim used for this recipe.
# Empty means "not yet recorded": the build proceeds but reports that the base is unpinned.
BASE_DIGEST="${MYSTRA_DESIGN_BASE_DIGEST:-}"

if [ ! -f "$IMAGE_CONTEXT/Dockerfile" ]; then
  echo "Missing repository-owned image context: $IMAGE_CONTEXT" >&2
  exit 1
fi

if [ -n "${MYSTRA_DESIGN_BASE_MIRROR:-}" ]; then
  mirror_ref="${MYSTRA_DESIGN_BASE_MIRROR}/${BASE_IMAGE}"
  printf 'Fetching base image through mirror %s.\n' "$mirror_ref"
  docker pull --platform "$PLATFORM" "$mirror_ref"
  docker tag "$mirror_ref" "$BASE_IMAGE"
fi

if ! docker image inspect "$BASE_IMAGE" >/dev/null 2>&1; then
  printf 'Pulling base image %s for %s.\n' "$BASE_IMAGE" "$PLATFORM"
  docker pull --platform "$PLATFORM" "$BASE_IMAGE"
fi

actual_base_digest="$(docker image inspect "$BASE_IMAGE" --format '{{index .RepoDigests 0}}' | sed 's/.*@//')"
printf 'Base image %s digest: %s\n' "$BASE_IMAGE" "$actual_base_digest"
if [ "${MYSTRA_DESIGN_SKIP_BASE_PIN:-0}" != "1" ]; then
  if [ -z "$BASE_DIGEST" ]; then
    printf 'WARNING: no reviewed base digest is recorded; set MYSTRA_DESIGN_BASE_DIGEST=%s after review.\n' \
      "$actual_base_digest" >&2
  elif [ "$actual_base_digest" != "$BASE_DIGEST" ]; then
    printf 'Base image digest mismatch: expected %s, got %s\n' "$BASE_DIGEST" "$actual_base_digest" >&2
    printf 'Set MYSTRA_DESIGN_BASE_DIGEST to the reviewed digest (and re-review the recipe), or\n' >&2
    printf 'MYSTRA_DESIGN_SKIP_BASE_PIN=1 for a throwaway local build.\n' >&2
    exit 1
  fi
fi

# Build proxies pass through as build args, mirroring scripts/build-runner-image.sh so a
# host behind an HTTP proxy can still fetch pinned artifacts.
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
printf 'Building %s for %s from %s.\n' "$IMAGE_TAG" "$PLATFORM" "$IMAGE_CONTEXT"
docker build \
  --progress=plain \
  --platform "$PLATFORM" \
  "${build_args[@]}" \
  -t "$IMAGE_TAG" \
  -f "$IMAGE_CONTEXT/Dockerfile" \
  "$IMAGE_CONTEXT"

image_id="$(docker image inspect "$IMAGE_TAG" --format '{{.Id}}')"
image_arch="$(docker image inspect "$IMAGE_TAG" --format '{{.Os}}/{{.Architecture}}')"
printf 'Built %s (%s) image id %s\n' "$IMAGE_TAG" "$image_arch" "$image_id"
docker image inspect "$IMAGE_TAG" --format 'size bytes: {{.Size}}'

if [ -x "$VERIFY_SCRIPT" ]; then
  "$VERIFY_SCRIPT" "$IMAGE_TAG"
else
  printf 'WARNING: %s is missing or not executable; tool and credential checks were skipped.\n' "$VERIFY_SCRIPT" >&2
fi
