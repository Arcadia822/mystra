#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT_HARNESS_FILES = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'PRODUCT.md',
  'PLATFORM.md',
  'PROCESS.md',
  'PROFILE.md',
]);

export function readHookInput() {
  const raw = fs.readFileSync(0, 'utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

export function getProjectDir(input) {
  return path.resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
}

export function toProjectRelativePath(projectDir, filePath) {
  if (!filePath) {
    return null;
  }

  const absolute = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(projectDir, filePath);

  const relative = path.relative(projectDir, absolute);
  if (relative === '' || relative === '.') {
    return '.';
  }

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return relative.replaceAll(path.sep, '/');
}

export function runGit(projectDir, args) {
  try {
    return execFileSync('git', args, {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function normalizePorcelainPath(entry) {
  const trimmed = entry.trim().replace(/^"+|"+$/g, '');
  if (trimmed.includes(' -> ')) {
    return trimmed.split(' -> ').at(-1);
  }
  return trimmed;
}

export function listModifiedPaths(projectDir) {
  const output = runGit(projectDir, ['status', '--short', '--untracked-files=all']);
  if (!output) {
    return [];
  }

  return output
    .split('\n')
    .map((line) => normalizePorcelainPath(line.slice(3)))
    .filter(Boolean)
    .map((filePath) => filePath.replaceAll(path.sep, '/'));
}

export function isLocalInstructionSurface(filePath) {
  return /^(apps|packages)\/[^/]+\/(AGENTS|CLAUDE)\.md$/.test(filePath);
}

export function isHookSurface(filePath) {
  return filePath === '.claude/settings.json' || filePath.startsWith('.claude/hooks/');
}

export function isSkillOrPromptSurface(filePath) {
  return (
    filePath.startsWith('.agents/skills/') ||
    filePath.startsWith('.claude/skills/') ||
    filePath.startsWith('.codex/prompts/')
  );
}

export function isHarnessGovernedPath(filePath) {
  return (
    ROOT_HARNESS_FILES.has(filePath) ||
    isLocalInstructionSurface(filePath) ||
    isHookSurface(filePath) ||
    isSkillOrPromptSurface(filePath)
  );
}

export function summarizePaths(paths, limit = 5) {
  const unique = [...new Set(paths)];
  if (unique.length === 0) {
    return 'none';
  }

  if (unique.length <= limit) {
    return unique.join(', ');
  }

  const shown = unique.slice(0, limit).join(', ');
  return `${shown}, +${unique.length - limit} more`;
}

export function findNearestAgents(projectDir, cwd) {
  const root = path.resolve(projectDir);
  let current = path.resolve(cwd);

  while (current.startsWith(root)) {
    const candidate = path.join(current, 'AGENTS.md');
    if (fs.existsSync(candidate)) {
      const relative = path.relative(root, candidate).replaceAll(path.sep, '/');
      return relative || 'AGENTS.md';
    }

    if (current === root) {
      break;
    }

    current = path.dirname(current);
  }

  return 'none';
}

function getSessionCachePath(sessionId, name) {
  const safeSessionId = (sessionId || 'unknown-session').replaceAll(/[^a-zA-Z0-9._-]/g, '_');
  const directory = path.join(os.tmpdir(), 'mystra-claude-hooks');
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, `${safeSessionId}-${name}.txt`);
}

export function readSessionCache(sessionId, name) {
  const cachePath = getSessionCachePath(sessionId, name);
  try {
    return fs.readFileSync(cachePath, 'utf8');
  } catch {
    return '';
  }
}

export function writeSessionCache(sessionId, name, value) {
  const cachePath = getSessionCachePath(sessionId, name);
  fs.writeFileSync(cachePath, value, 'utf8');
}
