#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const defaults = {
  agent: "codex",
  controlPlaneUrl: process.env.MYSTRA_CONTROL_PLANE_URL ?? "http://localhost:3000",
  source: "api",
  timeoutSeconds: Number(process.env.MYSTRA_WAIT_TIMEOUT_SECONDS ?? 1800),
};

function usage() {
  console.error(`Usage:
scripts/submit-job.mjs --project <slug> --task-id TASK-123 --branch mystra/TASK-123-name --title "MR title" --body "MR body" --prompt-file /tmp/prompt.md [--agent codex|copilot] [--no-wait]`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--no-wait") {
      out["no-wait"] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      usage();
    }
    out[key.slice(2)] = value;
    index += 1;
  }
  return out;
}

async function readJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${url} failed ${response.status}: ${text}`);
  }
  return JSON.parse(text);
}

function summarize(snapshot) {
  const result = snapshot.run.result ?? {};
  return {
    state: snapshot.run.state,
    jobId: snapshot.job.id,
    runId: snapshot.run.id,
    taskId: snapshot.job.spec.taskId,
    branch: result.branch ?? snapshot.job.spec.branchName,
    mrUrl: result.mrUrl ?? null,
    mrIid: result.mrIid ?? null,
    frontendPreviewUrl: result.metadata?.frontendPreviewUrl ?? null,
    backendPreviewUrl: result.metadata?.backendPreviewUrl ?? null,
    previewLogin: result.metadata?.frontendPreviewUrl
      ? {
          email: "preview@mystra.local",
          password: "mystra-preview",
        }
      : null,
    qualityGate: result.metadata?.qualityGate ?? null,
    summary: result.summary ?? null,
    errorCode: result.errorCode ?? null,
    errorMessage: result.errorMessage ?? null,
    events: snapshot.events.map((event) => event.type),
  };
}

const args = parseArgs(process.argv.slice(2).filter((arg) => arg !== "--"));
for (const required of ["project", "task-id", "branch", "title", "body", "prompt-file"]) {
  if (!args[required]) {
    usage();
  }
}

const prompt = await readFile(args["prompt-file"], "utf8");
const controlPlaneUrl = args["control-plane-url"] ?? defaults.controlPlaneUrl;
const project = await readJson(new URL(`/api/projects/${encodeURIComponent(args.project)}`, controlPlaneUrl));
const payload = {
  taskId: args["task-id"],
  source: defaults.source,
  projectId: project.project.id,
  branchName: args.branch,
  agent: args.agent ?? defaults.agent,
  prompt,
  mergeRequest: {
    title: args.title,
    body: args.body,
  },
};

const created = await readJson(new URL("/api/jobs", controlPlaneUrl), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
});

console.log(JSON.stringify({
  submitted: true,
  jobId: created.job.id,
  runId: created.run.id,
  state: created.run.state,
  branch: created.job.spec.branchName,
}, null, 2));

if (args["no-wait"]) {
  process.exit(0);
}

const terminal = new Set(["succeeded", "failed", "canceled", "timed_out", "waiting_for_review"]);
const started = Date.now();
let lastState = created.run.state;

while (true) {
  const snapshot = await readJson(new URL(`/api/jobs/${created.job.id}`, controlPlaneUrl));
  if (snapshot.run.state !== lastState) {
    lastState = snapshot.run.state;
    console.error(`${new Date().toISOString()} ${lastState}`);
  }

  if (terminal.has(snapshot.run.state)) {
    const summary = summarize(snapshot);
    console.log(JSON.stringify(summary, null, 2));
    process.exit(
      snapshot.run.state === "succeeded" || snapshot.run.state === "waiting_for_review"
        ? 0
        : 1,
    );
  }

  if ((Date.now() - started) / 1000 > defaults.timeoutSeconds) {
    console.error(`Timed out waiting for ${created.job.id}`);
    process.exit(124);
  }

  await new Promise((resolve) => setTimeout(resolve, 5000));
}
