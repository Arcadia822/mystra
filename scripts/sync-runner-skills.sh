#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_CONTEXT="${MYSTRA_RUNNER_IMAGE_CONTEXT:-/tmp/mystra-castrel-runner-image}"
SOURCE_ROOT="${MYSTRA_AGENT_SKILLS_SOURCE:-$ROOT_DIR/.agents/skills}"
TARGET_ROOT="$IMAGE_CONTEXT/skills/agent-skills"
TARGET_SKILLS="$IMAGE_CONTEXT/skills"

if [ ! -d "$IMAGE_CONTEXT" ]; then
  echo "Missing local runner image context: $IMAGE_CONTEXT" >&2
  echo "This Castrel-oriented image is intentionally not stored in the Mystra git repository." >&2
  exit 1
fi

skills=(
  aaa-spec-kit
  product-requirements
  plan-eng-review
  idea-refine
  spec-driven-development
  planning-and-task-breakdown
  context-engineering
  source-driven-development
  incremental-implementation
  test-driven-development
  debugging-and-error-recovery
  frontend-ui-engineering
  api-and-interface-design
  browser-testing-with-devtools
  code-review-and-quality
  security-and-hardening
  performance-optimization
  git-workflow-and-versioning
  ci-cd-and-automation
  documentation-and-adrs
  shipping-and-launch
)

mkdir -p "$TARGET_ROOT" "$TARGET_SKILLS"

for skill in "${skills[@]}"; do
  source_dir="$SOURCE_ROOT/$skill"
  target_dir="$TARGET_SKILLS/$skill"
  if [ ! -d "$source_dir" ]; then
    echo "Missing skill directory: $source_dir" >&2
    exit 1
  fi

  rm -rf "$target_dir"
  mkdir -p "$target_dir"
  rsync -a --delete \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude '.DS_Store' \
    "$source_dir/" "$target_dir/"
done

rm -rf "$TARGET_ROOT/skills"
rm -rf "$TARGET_SKILLS/using-agent-skills"

echo "Synced ${#skills[@]} runner skills into $TARGET_SKILLS"
