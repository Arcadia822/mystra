#!/usr/bin/env node

import {
  getProjectDir,
  isHarnessGovernedPath,
  isHookSurface,
  readHookInput,
  toProjectRelativePath,
} from './harness-utils.mjs';

const input = readHookInput();
const projectDir = getProjectDir(input);
const filePath = toProjectRelativePath(projectDir, input.tool_input?.file_path);

if (!filePath) {
  process.exit(0);
}

let additionalContext = '';

if (filePath === 'AGENTS.md' || /\/AGENTS\.md$/.test(filePath)) {
  additionalContext =
    'This edit changed a canonical instruction surface. The matching CLAUDE.md should remain a thin compatibility shim, and durable behavior changes should stay aligned with the relevant root docs and feature artifacts.';
} else if (filePath === 'CLAUDE.md' || /\/CLAUDE\.md$/.test(filePath)) {
  additionalContext =
    'This edit changed a compatibility instruction surface. Keep AGENTS.md canonical, keep the shim thin, and make sure durable policy still lives in the corresponding canonical surface.';
} else if (isHookSurface(filePath)) {
  additionalContext =
    'This edit changed project hook behavior. Hooks in this repo stay deterministic, scoped, and non-mutating; durable hook behavior changes should be reflected in the matching docs, quickstart steps, and feature artifacts.';
} else if (isHarnessGovernedPath(filePath)) {
  additionalContext =
    'This edit changed a harness-governed surface. Closeout for governed-surface changes usually includes updating the relevant spec, tasks, quickstart, or review artifact and preserving the repo-first source-of-truth boundary.';
}

if (!additionalContext) {
  process.exit(0);
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext,
    },
  }),
);
