#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const DEFAULTS = {
  controlPlaneUrl: process.env.MYSTRA_CONTROL_PLANE_URL ?? "http://localhost:3000",
};

const EXIT_CODES = {
  OK: 0,
  USAGE: 2,
  TRANSPORT_ERROR: 3,
  MISSING: 4,
  UNAVAILABLE: 5,
  INVALID: 6,
  NOT_READY: 7,
};

const TERMINAL_RUN_STATES = new Set(["succeeded", "failed", "canceled", "timed_out", "needs_human_review"]);
const FAILURE_RUN_STATES = new Set(["failed", "canceled", "timed_out", "needs_human_review"]);

function usage() {
  return `Usage:
  pnpm operator:cli -- projects list [--json] [--control-plane-url URL]
  pnpm operator:cli -- projects inspect <slug> [--json] [--control-plane-url URL]
  pnpm operator:cli -- runs list [--json] [--control-plane-url URL]
  pnpm operator:cli -- runs inspect <job-id> [--json] [--control-plane-url URL]
  pnpm operator:cli -- runs result <job-id> [--json] [--control-plane-url URL]
  pnpm operator:cli -- runs failure <job-id> [--json] [--control-plane-url URL]`;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pushLine(lines, value = "") {
  lines.push(value);
}

function contextRefsSummary(refs) {
  if (!Array.isArray(refs) || refs.length === 0) {
    return "none";
  }
  return refs
    .map((ref) => `${ref.slug}${ref.required ? " (required)" : ""}${ref.accessMode ? ` [${ref.accessMode}]` : ""}`)
    .join(", ");
}

function workflowSummary(workflow) {
  if (!isObject(workflow)) {
    return "none";
  }

  const parts = [workflow.provider, workflow.blueprintName, workflow.blueprintVersion].filter(Boolean);
  return parts.length > 0 ? parts.join(" | ") : "present";
}

function previewSummary(result) {
  if (!isObject(result?.metadata)) {
    return "none";
  }
  return result.metadata.frontendPreviewUrl ?? result.metadata.backendPreviewUrl ?? "none";
}

function managementExitCode(code) {
  if (["PROJECT_NOT_FOUND", "JOB_NOT_FOUND", "RUN_NOT_FOUND"].includes(code)) {
    return EXIT_CODES.MISSING;
  }
  if (["PROJECT_ARCHIVED", "RESULT_UNAVAILABLE", "JOB_CANCEL_CONFLICT"].includes(code)) {
    return EXIT_CODES.UNAVAILABLE;
  }
  if (code === "INVALID_SUBMISSION" || code === "INVALID_PROJECT") {
    return EXIT_CODES.INVALID;
  }
  if (code === "RESULT_NOT_READY") {
    return EXIT_CODES.NOT_READY;
  }
  return EXIT_CODES.TRANSPORT_ERROR;
}

function operatorError(code, message, exitCode, payload) {
  return {
    ok: false,
    code,
    message,
    payload,
    exitCode,
  };
}

function parseArgs(argv) {
  const flags = {
    json: false,
    controlPlaneUrl: DEFAULTS.controlPlaneUrl,
  };
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--json") {
      flags.json = true;
      continue;
    }
    if (arg === "--control-plane-url") {
      const value = argv[index + 1];
      if (!value) {
        return { ok: false, message: "Missing value for --control-plane-url" };
      }
      flags.controlPlaneUrl = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--control-plane-url=")) {
      flags.controlPlaneUrl = arg.slice("--control-plane-url=".length);
      continue;
    }
    if (arg.startsWith("--")) {
      return { ok: false, message: `Unknown flag: ${arg}` };
    }
    positionals.push(arg);
  }

  const [group, command, target] = positionals;
  if (!group || !command) {
    return { ok: false, message: "Missing command" };
  }

  const needsTarget = (
    (group === "projects" && command === "inspect") ||
    (group === "runs" && ["inspect", "result", "failure"].includes(command))
  );
  if (needsTarget && !target) {
    return { ok: false, message: `Missing target for ${group} ${command}` };
  }

  if (group === "projects" && !["list", "inspect"].includes(command)) {
    return { ok: false, message: `Unknown projects command: ${command}` };
  }
  if (group === "runs" && !["list", "inspect", "result", "failure"].includes(command)) {
    return { ok: false, message: `Unknown runs command: ${command}` };
  }
  if (!["projects", "runs"].includes(group)) {
    return { ok: false, message: `Unknown command group: ${group}` };
  }

  return {
    ok: true,
    value: {
      group,
      command,
      target,
      json: flags.json,
      controlPlaneUrl: flags.controlPlaneUrl,
    },
  };
}

async function readJson(url, fetchImpl) {
  let response;
  let text;
  try {
    response = await fetchImpl(url, { headers: { accept: "application/json" } });
    text = await response.text();
  } catch (error) {
    return operatorError(
      "TRANSPORT_ERROR",
      error instanceof Error ? error.message : "Request failed",
      EXIT_CODES.TRANSPORT_ERROR,
      { url: String(url) },
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return operatorError(
      "TRANSPORT_ERROR",
      `Invalid JSON from ${url}`,
      EXIT_CODES.TRANSPORT_ERROR,
      { url: String(url), status: response.status },
    );
  }

  if (!response.ok) {
    if (isObject(parsed?.error) && typeof parsed.error.code === "string" && typeof parsed.error.message === "string") {
      return operatorError(parsed.error.code, parsed.error.message, managementExitCode(parsed.error.code), parsed);
    }
    return operatorError(
      "TRANSPORT_ERROR",
      `Request failed with status ${response.status}`,
      EXIT_CODES.TRANSPORT_ERROR,
      { url: String(url), status: response.status, body: parsed },
    );
  }

  return { ok: true, data: parsed };
}

function resultView(snapshot) {
  const result = snapshot.run.result;
  if (!TERMINAL_RUN_STATES.has(snapshot.run.state)) {
    return operatorError("RESULT_NOT_READY", "Run result is not ready yet.", EXIT_CODES.NOT_READY, {
      jobId: snapshot.job.id,
      runState: snapshot.run.state,
    });
  }
  if (!isObject(result)) {
    return operatorError("RESULT_UNAVAILABLE", "Run result is unavailable.", EXIT_CODES.UNAVAILABLE, {
      jobId: snapshot.job.id,
      runState: snapshot.run.state,
    });
  }

  return {
    ok: true,
    payload: {
      jobId: snapshot.job.id,
      runId: snapshot.run.id,
      runState: snapshot.run.state,
      projectSlug: snapshot.project?.slug ?? snapshot.lane?.projectSlug ?? null,
      workflow: snapshot.workflow ?? null,
      result,
    },
  };
}

function failureView(snapshot) {
  const result = snapshot.run.result;
  if (!TERMINAL_RUN_STATES.has(snapshot.run.state)) {
    return operatorError("RESULT_NOT_READY", "Failure context is not ready yet.", EXIT_CODES.NOT_READY, {
      jobId: snapshot.job.id,
      runState: snapshot.run.state,
    });
  }
  if (!FAILURE_RUN_STATES.has(snapshot.run.state) || !isObject(result)) {
    return operatorError("RESULT_UNAVAILABLE", "Failure context is unavailable for this run.", EXIT_CODES.UNAVAILABLE, {
      jobId: snapshot.job.id,
      runState: snapshot.run.state,
    });
  }

  return {
    ok: true,
    payload: {
      jobId: snapshot.job.id,
      runId: snapshot.run.id,
      runState: snapshot.run.state,
      projectSlug: snapshot.project?.slug ?? snapshot.lane?.projectSlug ?? null,
      workflow: snapshot.workflow ?? null,
      result,
    },
  };
}

function formatProjectsList(payload) {
  const lines = [];
  pushLine(lines, "Projects");
  if (!Array.isArray(payload.projects) || payload.projects.length === 0) {
    pushLine(lines, "  none");
    return lines.join("\n");
  }
  for (const project of payload.projects) {
    pushLine(
      lines,
      `  - ${project.slug} | repo=${project.repo} | base=${project.baseBranch} | agent=${project.defaultAgent}${project.archivedAt ? " | archived" : ""}`,
    );
  }
  return lines.join("\n");
}

function formatProjectInspect(payload) {
  const project = payload.project;
  const lines = [];
  pushLine(lines, `Project ${project.slug}`);
  pushLine(lines, `  repo: ${project.repo}`);
  pushLine(lines, `  baseBranch: ${project.baseBranch}`);
  pushLine(lines, `  defaultAgent: ${project.defaultAgent}`);
  pushLine(lines, `  runtime: ${project.runtime.provider} | image=${project.runtime.image}`);
  pushLine(lines, `  workflow: ${workflowSummary(project.lane?.workflow)}`);
  pushLine(lines, `  contextBundles: ${contextRefsSummary(project.lane?.contextBundleRefs)}`);
  pushLine(lines, `  prewarmKeys: ${Object.keys(project.prewarmConfig ?? {}).join(", ") || "none"}`);
  return lines.join("\n");
}

function formatRunsList(payload) {
  const lines = [];
  pushLine(lines, "Runs");
  if (!Array.isArray(payload.jobs) || payload.jobs.length === 0) {
    pushLine(lines, "  none");
    return lines.join("\n");
  }
  for (const snapshot of payload.jobs) {
    pushLine(
      lines,
      `  - ${snapshot.job.id} | state=${snapshot.run.state} | project=${snapshot.project?.slug ?? snapshot.lane?.projectSlug ?? "n/a"} | branch=${snapshot.job.spec.branchName} | updated=${snapshot.run.updatedAt ?? snapshot.job.updatedAt ?? "n/a"}`,
    );
  }
  return lines.join("\n");
}

function formatRunInspect(snapshot) {
  const lines = [];
  pushLine(lines, `Run ${snapshot.job.id}`);
  pushLine(lines, `  state: ${snapshot.run.state}`);
  pushLine(lines, `  branch: ${snapshot.job.spec.branchName}`);
  pushLine(lines, `  project: ${snapshot.project?.slug ?? snapshot.lane?.projectSlug ?? "n/a"}`);
  pushLine(lines, `  workflow: ${workflowSummary(snapshot.workflow)}`);
  pushLine(lines, `  currentLaneContext: ${contextRefsSummary(snapshot.project?.lane?.contextBundleRefs)}`);
  pushLine(lines, `  submittedLaneContext: ${contextRefsSummary(snapshot.lane?.contextBundleRefs)}`);
  pushLine(lines, `  runtime: ${snapshot.runtime?.environment?.image ?? snapshot.project?.runtime?.image ?? "n/a"}`);
  pushLine(lines, `  resultStatus: ${snapshot.run.result?.status ?? "none"}`);
  return lines.join("\n");
}

function formatResult(payload) {
  const lines = [];
  pushLine(lines, `Result ${payload.jobId}`);
  pushLine(lines, `  state: ${payload.runState}`);
  pushLine(lines, `  project: ${payload.projectSlug ?? "n/a"}`);
  pushLine(lines, `  summary: ${payload.result.summary}`);
  pushLine(lines, `  branch: ${payload.result.branch ?? "n/a"}`);
  pushLine(lines, `  review: ${payload.result.mrUrl ?? "n/a"}`);
  pushLine(lines, `  preview: ${previewSummary(payload.result)}`);
  pushLine(lines, `  workflow: ${workflowSummary(payload.workflow)}`);
  return lines.join("\n");
}

function formatFailure(payload) {
  const lines = [];
  pushLine(lines, `Failure ${payload.jobId}`);
  pushLine(lines, `  state: ${payload.runState}`);
  pushLine(lines, `  project: ${payload.projectSlug ?? "n/a"}`);
  pushLine(lines, `  summary: ${payload.result.summary}`);
  pushLine(lines, `  errorCode: ${payload.result.errorCode ?? "n/a"}`);
  pushLine(lines, `  errorMessage: ${payload.result.errorMessage ?? "n/a"}`);
  pushLine(lines, `  workflow: ${workflowSummary(payload.workflow)}`);
  return lines.join("\n");
}

function formatError(outcome, jsonMode) {
  if (jsonMode) {
    return `${JSON.stringify({
      ok: false,
      code: outcome.code,
      message: outcome.message,
      payload: outcome.payload,
    }, null, 2)}\n`;
  }

  const lines = [`ERROR ${outcome.code}: ${outcome.message}`];
  if (isObject(outcome.payload)) {
    for (const [key, value] of Object.entries(outcome.payload)) {
      lines.push(`${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function formatSuccess(command, payload, jsonMode) {
  if (jsonMode) {
    return `${JSON.stringify(payload, null, 2)}\n`;
  }

  if (command.group === "projects" && command.command === "list") {
    return `${formatProjectsList(payload)}\n`;
  }
  if (command.group === "projects" && command.command === "inspect") {
    return `${formatProjectInspect(payload)}\n`;
  }
  if (command.group === "runs" && command.command === "list") {
    return `${formatRunsList(payload)}\n`;
  }
  if (command.group === "runs" && command.command === "inspect") {
    return `${formatRunInspect(payload)}\n`;
  }
  if (command.group === "runs" && command.command === "result") {
    return `${formatResult(payload)}\n`;
  }
  if (command.group === "runs" && command.command === "failure") {
    return `${formatFailure(payload)}\n`;
  }
  return `${JSON.stringify(payload, null, 2)}\n`;
}

async function executeCommand(command, fetchImpl) {
  const baseUrl = command.controlPlaneUrl;

  if (command.group === "projects" && command.command === "list") {
    return await readJson(new URL("/api/projects", baseUrl), fetchImpl);
  }
  if (command.group === "projects" && command.command === "inspect") {
    return await readJson(new URL(`/api/projects/${encodeURIComponent(command.target)}`, baseUrl), fetchImpl);
  }
  if (command.group === "runs" && command.command === "list") {
    return await readJson(new URL("/api/jobs", baseUrl), fetchImpl);
  }

  const snapshot = await readJson(new URL(`/api/jobs/${encodeURIComponent(command.target)}`, baseUrl), fetchImpl);
  if (!snapshot.ok) {
    return snapshot;
  }

  if (command.group === "runs" && command.command === "inspect") {
    return snapshot;
  }
  if (command.group === "runs" && command.command === "result") {
    return resultView(snapshot.data);
  }
  if (command.group === "runs" && command.command === "failure") {
    return failureView(snapshot.data);
  }

  return operatorError("TRANSPORT_ERROR", "Unsupported command", EXIT_CODES.USAGE, { command });
}

export async function run(argv, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const stdout = deps.stdout ?? ((text) => process.stdout.write(text));
  const stderr = deps.stderr ?? ((text) => process.stderr.write(text));

  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    stderr(`${parsed.message}\n${usage()}\n`);
    return EXIT_CODES.USAGE;
  }

  const result = await executeCommand(parsed.value, fetchImpl);
  if (!result.ok) {
    stderr(formatError(result, parsed.value.json));
    return result.exitCode ?? EXIT_CODES.TRANSPORT_ERROR;
  }

  const payload = result.data ?? result.payload;
  stdout(formatSuccess(parsed.value, payload, parsed.value.json));
  return EXIT_CODES.OK;
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMain) {
  const exitCode = await run(process.argv.slice(2));
  process.exit(exitCode);
}

export {
  EXIT_CODES,
  parseArgs,
  resultView,
  failureView,
};
