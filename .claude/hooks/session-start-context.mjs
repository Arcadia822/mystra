#!/usr/bin/env node

import {
  findNearestAgents,
  getProjectDir,
  listModifiedPaths,
  readHookInput,
  runGit,
  summarizePaths,
  isHarnessGovernedPath,
} from './harness-utils.mjs';

const input = readHookInput();
const projectDir = getProjectDir(input);
const cwd = input.cwd || projectDir;

const branch = runGit(projectDir, ['rev-parse', '--abbrev-ref', 'HEAD']) || 'unknown';
const governedChanges = listModifiedPaths(projectDir).filter(isHarnessGovernedPath);
const nearestAgents = findNearestAgents(projectDir, cwd);

const lines = [
  'Session refresh:',
  `- source: ${input.source || 'unknown'}`,
  `- current branch: ${branch}`,
  `- nearest AGENTS.md from cwd: ${nearestAgents}`,
  `- open harness-surface changes: ${summarizePaths(governedChanges, 6)}`,
];

process.stdout.write(lines.join('\n'));
