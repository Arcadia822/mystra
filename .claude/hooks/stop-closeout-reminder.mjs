#!/usr/bin/env node

import {
  getProjectDir,
  isHarnessGovernedPath,
  listModifiedPaths,
  readHookInput,
  readSessionCache,
  summarizePaths,
  writeSessionCache,
} from './harness-utils.mjs';

const input = readHookInput();
const projectDir = getProjectDir(input);

const governedChanges = listModifiedPaths(projectDir)
  .filter(isHarnessGovernedPath)
  .sort();

if (governedChanges.length === 0) {
  process.exit(0);
}

const signature = governedChanges.join('\n');
const previousSignature = readSessionCache(input.session_id, 'stop-governed-signature');

if (signature === previousSignature) {
  process.exit(0);
}

writeSessionCache(input.session_id, 'stop-governed-signature', signature);

process.stdout.write(
  JSON.stringify({
    systemMessage: `Harness closeout reminder: governed surfaces changed in this worktree (${summarizePaths(
      governedChanges,
      6,
    )}). Before closeout, update the matching 5xP/spec/quickstart/task or review artifacts and rerun focused verification for the touched surfaces.`,
  }),
);
