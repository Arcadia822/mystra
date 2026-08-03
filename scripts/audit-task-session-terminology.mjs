#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const allowMarker = "legacy-term-audit: allow";
const ignoredDirectoryNames = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);
const inspectedExtensions = new Set([
  ".cjs",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sh",
  ".sql",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const inspectionTargets = [
  "apps",
  "packages",
  "scripts",
  ".specify/memory/constitution.md",
  "AGENTS.md",
  "PRODUCT.md",
  "PLATFORM.md",
  "PROCESS.md",
  "PROFILE.md",
  "README.md",
  "specs/025-webui",
  "specs/spec-status.md",
];
const ignoredFiles = new Set([
  "apps/control-plane/next-env.d.ts",
  "scripts/audit-task-session-terminology.mjs",
]);
const legacyPatterns = [
  /\bJob(?:InlineContextBundlePayload|Snapshot|Submission|Spec|Source|Record)?s?\b/,
  /\bRun(?:ProjectView|Result|State|Event|Record)s?\b/,
  /[`'\"]Runs?[`'\"]/,
  /\bRuns\b/,
  /\bRunnerSession\b/,
  /\b(?:activeRunCount|assignedRunnerSessionId|jobId|runId|runnerSessionId|staleRunIds)\b/,
  /\b(?:jobs|runs|runner_sessions|run_events)\b/,
  /[\"'`](?:job|run)\.[a-z][a-z0-9_.-]*[\"'`]/,
  /\/api\/(?:runner\/)?jobs(?:\/|\b)/,
];
const legacyPathSegment = /(^|[-_.\/])(?:job|jobs|run|runs|runner-session|runner-sessions)(?=$|[-_.\/])/i;

async function collectFiles(targetPath) {
  const absolutePath = path.join(repositoryRoot, targetPath);
  let targetStat;
  try {
    targetStat = await stat(absolutePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  if (targetStat.isFile()) {
    return [targetPath];
  }

  const files = [];
  for (const entry of await readdir(absolutePath, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) {
      continue;
    }
    const childPath = path.posix.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(childPath));
    } else if (entry.isFile() && inspectedExtensions.has(path.extname(entry.name))) {
      files.push(childPath);
    }
  }
  return files;
}

function lineViolations(relativePath, content) {
  const violations = [];
  const lines = content.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (line.includes(allowMarker) || lines[index - 1]?.includes(allowMarker)) {
      continue;
    }
    const matchedPattern = legacyPatterns.find((pattern) => pattern.test(line));
    if (matchedPattern) {
      violations.push({
        path: relativePath,
        line: index + 1,
        text: line.trim().slice(0, 240),
      });
    }
  }
  return violations;
}

async function main() {
  const files = (await Promise.all(inspectionTargets.map(collectFiles)))
    .flat()
    .filter((filePath, index, all) => all.indexOf(filePath) === index)
    .filter((filePath) => !ignoredFiles.has(filePath))
    .sort();
  const violations = [];

  for (const relativePath of files) {
    if (legacyPathSegment.test(relativePath)) {
      violations.push({ path: relativePath, line: 0, text: "legacy business term in active file path" });
    }
    const content = await readFile(path.join(repositoryRoot, relativePath), "utf8");
    violations.push(...lineViolations(relativePath, content));
  }

  if (violations.length === 0) {
    console.log(`Task/Session terminology audit passed (${files.length} files inspected).`);
    return;
  }

  console.error(`Task/Session terminology audit failed: ${violations.length} violation(s) in ${files.length} inspected files.`);
  for (const violation of violations) {
    const location = violation.line > 0 ? `${violation.path}:${violation.line}` : violation.path;
    console.error(`${location}: ${violation.text}`);
  }
  console.error(`Use \"${allowMarker}\" only on an intentional negative compatibility assertion.`);
  process.exitCode = 1;
}

await main();
