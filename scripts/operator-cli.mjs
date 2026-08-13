#!/usr/bin/env node

import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
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

const TERMINAL_SESSION_STATES = new Set(["succeeded", "failed", "canceled", "timed_out", "waiting_for_review"]);
const FAILURE_SESSION_STATES = new Set(["failed", "canceled", "timed_out"]);
const OPERATOR_STATE_VERSION = 1;

function operatorStatePath() {
  return process.env.MYSTRA_OPERATOR_STATE_PATH
    ?? join(homedir(), ".mystra", "operator-session.json");
}

function createSessionStore(filePath = operatorStatePath()) {
  return {
    async read() {
      let parsed;
      try {
        parsed = JSON.parse(await readFile(filePath, "utf8"));
      } catch (error) {
        if (error && typeof error === "object" && error.code === "ENOENT") {
          return undefined;
        }
        throw new Error("Unable to read the operator session state.");
      }
      if (
        !isObject(parsed)
        || parsed.version !== OPERATOR_STATE_VERSION
        || typeof parsed.controlPlaneUrl !== "string"
        || typeof parsed.sessionToken !== "string"
        || !/^[A-Za-z0-9_-]{16,}$/.test(parsed.sessionToken)
      ) {
        throw new Error("The operator session state is invalid.");
      }
      try {
        new URL(parsed.controlPlaneUrl);
      } catch {
        throw new Error("The operator session state is invalid.");
      }
      return parsed;
    },
    async write(state) {
      await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
      await chmod(dirname(filePath), 0o700);
      await writeFile(filePath, `${JSON.stringify(state)}\n`, { mode: 0o600 });
      await chmod(filePath, 0o600);
    },
    async clear() {
      await rm(filePath, { force: true });
    },
  };
}

function normalizeControlPlaneUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new TypeError("Control-plane URL must use HTTP or HTTPS.");
  }
  return url.toString().replace(/\/$/, "");
}

function sessionTokenFromSetCookie(header) {
  const match = /(?:^|,\s*)mystra_session=([^;,\s]+)/.exec(header ?? "");
  if (!match) return undefined;
  try {
    const token = decodeURIComponent(match[1]);
    return /^[A-Za-z0-9_-]{16,}$/.test(token) ? token : undefined;
  } catch {
    return undefined;
  }
}

function usage() {
  return `Usage:
  pnpm operator:cli -- auth login --username USERNAME --password-stdin [--control-plane-url URL] [--json]
  pnpm operator:cli -- auth logout [--json]
  pnpm operator:cli -- auth session [--json]
  pnpm operator:cli -- teams use <team-id> [--json]
  pnpm operator:cli -- control-plane inspect [--json] [--control-plane-url URL]
  pnpm operator:cli -- integrations list [--json] [--control-plane-url URL]
  pnpm operator:cli -- repositories list --integration NAME [--limit N] [--cursor TOKEN] [--json]
  pnpm operator:cli -- repositories get <owner/repository> --integration NAME [--json]
  pnpm operator:cli -- projects list [--json] [--control-plane-url URL]
  pnpm operator:cli -- projects inspect <slug> [--json] [--control-plane-url URL]
  pnpm operator:cli -- agents list [--limit N] [--cursor ID] [--include-archived] [--json]
  pnpm operator:cli -- agents inspect <agent-id> [--json]
  pnpm operator:cli -- agents create --name NAME --system-prompt TEXT [--json]
  pnpm operator:cli -- agents update <agent-id> --expected-revision N [--name NAME] [--system-prompt TEXT] [--json]
  pnpm operator:cli -- agents archive <agent-id> --expected-revision N [--json]
  pnpm operator:cli -- runners list [--json] [--control-plane-url URL]
  pnpm operator:cli -- runners inspect <runner-id> [--json] [--control-plane-url URL]
  pnpm operator:cli -- issues list --integration NAME [--repository IDENTIFIER] [--limit N] [--cursor TOKEN] [--json]
  pnpm operator:cli -- issues get <identifier> --integration NAME [--repository IDENTIFIER] [--json]
  pnpm operator:cli -- issues dispatch <identifier> --integration NAME --project SLUG --provider copilot --branch NAME [--json]
  pnpm operator:cli -- tasks list [--json] [--control-plane-url URL]
  pnpm operator:cli -- tasks create --title TEXT [--description TEXT] [--project PROJECT_ID] [--idempotency-key UUID] [--json]
  pnpm operator:cli -- tasks inspect <task-id> [--json] [--control-plane-url URL]
  pnpm operator:cli -- tasks update <task-id> [--title TEXT] [--description TEXT] [--json]
  pnpm operator:cli -- tasks start <task-id> --runtime-id UUID --provider NAME [--agent-context-id UUID] --expected-revision N --idempotency-key KEY [--json]
  pnpm operator:cli -- sessions list <task-id> [--json] [--control-plane-url URL]
  pnpm operator:cli -- sessions create <task-id> --title TITLE --objective TEXT [--provider NAME] [--branch NAME] [--json]
  pnpm operator:cli -- sessions inspect <session-id> [--json] [--control-plane-url URL]
  pnpm operator:cli -- sessions wait <session-id> [--interval-seconds N] [--timeout-seconds N] [--json]
  pnpm operator:cli -- sessions cancel <session-id> [--json] [--control-plane-url URL]
  pnpm operator:cli -- sessions result <session-id> [--json] [--control-plane-url URL]
  pnpm operator:cli -- sessions failure <session-id> [--json] [--control-plane-url URL]`;
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

function previewSummary(result) {
  if (typeof result?.preview?.url === "string") {
    return result.preview.url;
  }
  if (!isObject(result?.metadata)) {
    return "none";
  }
  return result.metadata.frontendPreviewUrl ?? result.metadata.backendPreviewUrl ?? "none";
}

function managementExitCode(code) {
  if ([
    "AGENT_NOT_FOUND",
    "PROJECT_NOT_FOUND",
    "TASK_NOT_FOUND",
    "SESSION_NOT_FOUND",
    "RUNNER_NOT_FOUND",
    "INTEGRATION_NOT_FOUND",
    "REPOSITORY_NOT_FOUND",
    "ISSUE_NOT_FOUND",
  ].includes(code)) {
    return EXIT_CODES.MISSING;
  }
  if ([
    "AGENT_ARCHIVED",
    "AGENT_REVISION_CONFLICT",
    "PROJECT_ARCHIVED",
    "RESULT_UNAVAILABLE",
    "SESSION_CANCEL_CONFLICT",
    "ISSUE_CAPABILITY_UNAVAILABLE",
    "REPOSITORY_CAPABILITY_UNAVAILABLE",
    "INTEGRATION_NOT_CONFIGURED",
    "DISPATCH_CONFLICT",
  ].includes(code)) {
    return EXIT_CODES.UNAVAILABLE;
  }
  if ([
    "INVALID_AGENT",
    "INVALID_SUBMISSION",
    "INVALID_PROJECT",
    "INVALID_REQUEST",
    "INVALID_DISPATCH",
    "INVALID_GITHUB_REPOSITORY",
    "REPOSITORY_SCOPE_REQUIRED",
  ].includes(code)) {
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
    controlPlaneUrl: undefined,
    username: undefined,
    passwordStdin: false,
    integration: undefined,
    limit: undefined,
    cursor: undefined,
    project: undefined,
    provider: undefined,
    branch: undefined,
    name: undefined,
    slug: undefined,
    repository: undefined,
    repositoryIntegration: undefined,
    title: undefined,
    objective: undefined,
    description: undefined,
    idempotencyKey: undefined,
    systemPrompt: undefined,
    expectedRevision: undefined,
    runtimeId: undefined,
    agentContextId: undefined,
    includeArchived: false,
    intervalSeconds: 2,
    timeoutSeconds: 3600,
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
    if (arg === "--password-stdin") {
      flags.passwordStdin = true;
      continue;
    }
    if (arg === "--include-archived") {
      flags.includeArchived = true;
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
    const valueFlags = new Map([
      ["--integration", "integration"],
      ["--limit", "limit"],
      ["--cursor", "cursor"],
      ["--project", "project"],
      ["--provider", "provider"],
      ["--branch", "branch"],
      ["--name", "name"],
      ["--slug", "slug"],
      ["--repository", "repository"],
      ["--repository-integration", "repositoryIntegration"],
      ["--title", "title"],
      ["--objective", "objective"],
      ["--description", "description"],
      ["--idempotency-key", "idempotencyKey"],
      ["--system-prompt", "systemPrompt"],
      ["--expected-revision", "expectedRevision"],
      ["--runtime-id", "runtimeId"],
      ["--agent-context-id", "agentContextId"],
      ["--username", "username"],
      ["--interval-seconds", "intervalSeconds"],
      ["--timeout-seconds", "timeoutSeconds"],
    ]);
    if (valueFlags.has(arg)) {
      const value = argv[index + 1];
      if (!value) {
        return { ok: false, message: `Missing value for ${arg}` };
      }
      flags[valueFlags.get(arg)] = value;
      index += 1;
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
    (group === "repositories" && command === "get") ||
    (group === "runners" && command === "inspect") ||
    (group === "issues" && ["get", "dispatch"].includes(command)) ||
    (group === "tasks" && ["inspect", "update", "start"].includes(command)) ||
    (group === "agents" && ["inspect", "update", "archive"].includes(command)) ||
    (group === "teams" && command === "use") ||
    (group === "sessions" && ["list", "create", "inspect", "wait", "cancel", "result", "failure"].includes(command))
  );
  if (needsTarget && !target) {
    return { ok: false, message: `Missing target for ${group} ${command}` };
  }

  if (group === "control-plane" && command !== "inspect") {
    return { ok: false, message: `Unknown control-plane command: ${command}` };
  }
  if (group === "auth" && !["login", "logout", "session"].includes(command)) {
    return { ok: false, message: `Unknown auth command: ${command}` };
  }
  if (group === "teams" && command !== "use") {
    return { ok: false, message: `Unknown teams command: ${command}` };
  }
  if (group === "integrations" && command !== "list") {
    return { ok: false, message: `Unknown integrations command: ${command}` };
  }
  if (group === "repositories" && !["list", "get"].includes(command)) {
    return { ok: false, message: `Unknown repositories command: ${command}` };
  }
  if (group === "projects" && !["list", "inspect"].includes(command)) {
    return { ok: false, message: `Unknown projects command: ${command}` };
  }
  if (group === "runners" && !["list", "inspect"].includes(command)) {
    return { ok: false, message: `Unknown runners command: ${command}` };
  }
  if (group === "agents" && !["list", "inspect", "create", "update", "archive"].includes(command)) {
    return { ok: false, message: `Unknown agents command: ${command}` };
  }
  if (group === "tasks" && !["list", "create", "inspect", "update", "start"].includes(command)) {
    return { ok: false, message: `Unknown ${group} command: ${command}` };
  }
  if (group === "sessions" && !["list", "create", "inspect", "wait", "cancel", "result", "failure"].includes(command)) {
    return { ok: false, message: `Unknown ${group} command: ${command}` };
  }
  if (group === "issues" && !["list", "get", "dispatch"].includes(command)) {
    return { ok: false, message: `Unknown issues command: ${command}` };
  }
  if (![
    "control-plane",
    "auth",
    "teams",
    "integrations",
    "repositories",
    "projects",
    "runners",
    "agents",
    "issues",
    "tasks",
    "sessions",
  ].includes(group)) {
    return { ok: false, message: `Unknown command group: ${group}` };
  }
  if (group === "auth" && command === "login" && (!flags.username || !flags.passwordStdin)) {
    return { ok: false, message: "auth login requires --username and --password-stdin" };
  }
  if (["issues", "repositories"].includes(group) && !flags.integration) {
    return { ok: false, message: `Missing --integration for ${group} command` };
  }
  if (["issues", "repositories", "agents"].includes(group) && flags.limit !== undefined) {
    const limit = Number(flags.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return { ok: false, message: "--limit must be an integer between 1 and 100" };
    }
    flags.limit = limit;
  }
  if (
    group === "issues"
    && command === "dispatch"
    && (!flags.project || !flags.provider || !flags.branch)
  ) {
    return {
      ok: false,
      message: "issues dispatch requires --project, --provider, and --branch",
    };
  }
  if (group === "tasks" && command === "create" && !flags.title) {
    return { ok: false, message: "tasks create requires --title" };
  }
  if (group === "tasks" && command === "update" && !flags.title && flags.description === undefined) {
    return { ok: false, message: "tasks update requires --title or --description" };
  }
  if (group === "tasks" && command === "start") {
    const revision = Number(flags.expectedRevision);
    if (!flags.runtimeId || !flags.provider || !flags.idempotencyKey || !Number.isInteger(revision) || revision < 1) {
      return { ok: false, message: "tasks start requires --runtime-id, --provider, positive --expected-revision, and --idempotency-key" };
    }
    flags.expectedRevision = revision;
  }
  if (group === "sessions" && command === "create" && (!flags.title || !flags.objective)) {
    return { ok: false, message: "sessions create requires --title and --objective" };
  }
  if (group === "agents" && command === "create" && (!flags.name || !flags.systemPrompt)) {
    return { ok: false, message: "agents create requires --name and --system-prompt" };
  }
  if (group === "agents" && ["update", "archive"].includes(command)) {
    const revision = Number(flags.expectedRevision);
    if (!Number.isInteger(revision) || revision < 1) {
      return { ok: false, message: `${group} ${command} requires a positive --expected-revision` };
    }
    flags.expectedRevision = revision;
  }
  if (group === "agents" && command === "update" && !flags.name && !flags.systemPrompt) {
    return { ok: false, message: "agents update requires --name or --system-prompt" };
  }
  if (group === "sessions" && command === "wait") {
    for (const [flag, value] of [
      ["--interval-seconds", flags.intervalSeconds],
      ["--timeout-seconds", flags.timeoutSeconds],
    ]) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { ok: false, message: `${flag} must be a positive number` };
      }
    }
    flags.intervalSeconds = Number(flags.intervalSeconds);
    flags.timeoutSeconds = Number(flags.timeoutSeconds);
  }

  return {
    ok: true,
    value: {
      group,
      command,
      target,
      json: flags.json,
      ...(flags.controlPlaneUrl ? { controlPlaneUrl: flags.controlPlaneUrl } : {}),
      ...(flags.username ? { username: flags.username } : {}),
      ...(flags.integration ? { integration: flags.integration } : {}),
      ...(flags.limit !== undefined ? { limit: flags.limit } : {}),
      ...(flags.cursor ? { cursor: flags.cursor } : {}),
      ...(flags.project ? { project: flags.project } : {}),
      ...(flags.provider ? { provider: flags.provider } : {}),
      ...(flags.branch ? { branch: flags.branch } : {}),
      ...(flags.name ? { name: flags.name } : {}),
      ...(flags.slug ? { slug: flags.slug } : {}),
      ...(flags.repository ? { repository: flags.repository } : {}),
      ...(flags.repositoryIntegration
        ? { repositoryIntegration: flags.repositoryIntegration }
        : {}),
      ...(flags.title ? { title: flags.title } : {}),
      ...(flags.objective ? { objective: flags.objective } : {}),
      ...(flags.description !== undefined ? { description: flags.description } : {}),
      ...(flags.idempotencyKey ? { idempotencyKey: flags.idempotencyKey } : {}),
      ...(flags.systemPrompt ? { systemPrompt: flags.systemPrompt } : {}),
      ...(flags.expectedRevision !== undefined ? { expectedRevision: flags.expectedRevision } : {}),
      ...(flags.runtimeId ? { runtimeId: flags.runtimeId } : {}),
      ...(flags.agentContextId ? { agentContextId: flags.agentContextId } : {}),
      ...(flags.includeArchived ? { includeArchived: true } : {}),
      ...(group === "sessions" && command === "wait"
        ? {
            intervalSeconds: flags.intervalSeconds,
            timeoutSeconds: flags.timeoutSeconds,
          }
        : {}),
    },
  };
}

async function readJson(url, fetchImpl, init = {}) {
  let response;
  let text;
  try {
    response = await fetchImpl(url, {
      ...init,
      headers: {
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
    text = await response.text();
  } catch (error) {
    return operatorError(
      "TRANSPORT_ERROR",
      error instanceof Error ? error.message : "Request failed",
      EXIT_CODES.TRANSPORT_ERROR,
      { url: String(url) },
    );
  }

  if (response.status === 204) {
    return { ok: true, data: undefined, headers: response.headers };
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

  return { ok: true, data: parsed, headers: response.headers };
}

function resultView(snapshot) {
  const result = snapshot.session.result;
  if (!TERMINAL_SESSION_STATES.has(snapshot.session.state)) {
    return operatorError("RESULT_NOT_READY", "Session result is not ready yet.", EXIT_CODES.NOT_READY, {
      sessionId: snapshot.session.id,
      sessionState: snapshot.session.state,
    });
  }
  if (!isObject(result)) {
    return operatorError("RESULT_UNAVAILABLE", "Session result is unavailable.", EXIT_CODES.UNAVAILABLE, {
      sessionId: snapshot.session.id,
      sessionState: snapshot.session.state,
    });
  }

  return {
    ok: true,
    payload: {
      taskId: snapshot.task.id,
      sessionId: snapshot.session.id,
      sessionState: snapshot.session.state,
      projectSlug: snapshot.project?.slug ?? null,
      result,
    },
  };
}

function failureView(snapshot) {
  const result = snapshot.session.result;
  if (!TERMINAL_SESSION_STATES.has(snapshot.session.state)) {
    return operatorError("RESULT_NOT_READY", "Failure context is not ready yet.", EXIT_CODES.NOT_READY, {
      sessionId: snapshot.session.id,
      sessionState: snapshot.session.state,
    });
  }
  if (!FAILURE_SESSION_STATES.has(snapshot.session.state) || !isObject(result)) {
    return operatorError("RESULT_UNAVAILABLE", "Failure context is unavailable for this Session.", EXIT_CODES.UNAVAILABLE, {
      sessionId: snapshot.session.id,
      sessionState: snapshot.session.state,
    });
  }

  return {
    ok: true,
    payload: {
      taskId: snapshot.task.id,
      sessionId: snapshot.session.id,
      sessionState: snapshot.session.state,
      projectSlug: snapshot.project?.slug ?? null,
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
      `  - ${project.slug} | repository=${project.repository?.fullName ?? "n/a"} | provider=${project.repository?.provider ?? "n/a"} | base=${project.baseBranch}${project.archivedAt ? " | archived" : ""}`,
    );
  }
  return lines.join("\n");
}

function formatControlPlane(payload) {
  const controlPlane = payload.controlPlane;
  const lines = [`Control Plane ${controlPlane.status}`];
  pushLine(lines, `  checkedAt: ${controlPlane.checkedAt}`);
  pushLine(lines, `  tasks: ${controlPlane.tasks.total} total | ${controlPlane.tasks.withoutSessions} without Sessions`);
  pushLine(lines, `  sessions: ${controlPlane.sessions.total} total | ${controlPlane.sessions.queued} queued | ${controlPlane.sessions.active} active | ${controlPlane.sessions.waitingForReview} waiting review | ${controlPlane.sessions.failed} failed`);
  pushLine(
    lines,
    `  runners: ${controlPlane.runners.online}/${controlPlane.runners.total} online | ${controlPlane.runners.activeSessions}/${controlPlane.runners.maxConcurrency} active | ${controlPlane.runners.availableCapacity} available`,
  );
  return lines.join("\n");
}

function formatRunnersList(payload) {
  const lines = ["Runners"];
  if (!Array.isArray(payload.runners) || payload.runners.length === 0) {
    pushLine(lines, "  none");
    return lines.join("\n");
  }
  for (const runner of payload.runners) {
    pushLine(
      lines,
      `  - ${runner.id} | ${runner.name} | ${runner.health} | active=${runner.activeSessionCount}/${runner.maxConcurrency} | executor=${runner.capabilities.executor}`,
    );
  }
  return lines.join("\n");
}

function formatRunnerInspect(payload) {
  const { runner } = payload;
  const lines = [`Runner ${runner.name}`];
  pushLine(lines, `  id: ${runner.id}`);
  pushLine(lines, `  status: ${runner.health}`);
  pushLine(lines, `  heartbeat: ${runner.lastHeartbeatAt}`);
  pushLine(lines, `  concurrency: ${runner.activeSessionCount}/${runner.maxConcurrency}`);
  pushLine(lines, `  executor: ${runner.capabilities.executor}`);
  pushLine(lines, `  executionProviders: ${runner.capabilities.executionProviders.join(", ")}`);
  pushLine(lines, `  image: ${runner.capabilities.image ?? "n/a"}`);
  pushLine(lines, `  assignments: ${runner.currentAssignments.map((assignment) => `${assignment.taskId}/${assignment.sessionId}`).join(", ") || "none"}`);
  return lines.join("\n");
}

function formatProjectInspect(payload) {
  const project = payload.project;
  const lines = [];
  pushLine(lines, `Project ${project.slug}`);
  pushLine(lines, `  repository: ${project.repository?.fullName ?? "n/a"}`);
  pushLine(lines, `  repositoryProvider: ${project.repository?.provider ?? "n/a"}`);
  pushLine(lines, `  cloneUrl: ${project.repository?.cloneUrl ?? "n/a"}`);
  pushLine(lines, `  baseBranch: ${project.baseBranch}`);
  pushLine(lines, `  runtime: ${project.runtime.provider} | image=${project.runtime.image}`);
  pushLine(lines, `  contextBundles: ${contextRefsSummary(project.lane?.contextBundleRefs)}`);
  pushLine(lines, `  prewarmKeys: ${Object.keys(project.prewarmConfig ?? {}).join(", ") || "none"}`);
  return lines.join("\n");
}

function formatTasksList(payload) {
  const lines = [];
  pushLine(lines, "Tasks");
  if (!Array.isArray(payload.tasks) || payload.tasks.length === 0) {
    pushLine(lines, "  none");
    return lines.join("\n");
  }
  for (const task of payload.tasks) {
    pushLine(
      lines,
      `  - ${task.id} | project=${task.projectId} | sessions=${task.sessionCount} | active=${task.activeSessionCount} | updated=${task.updatedAt}`,
    );
  }
  return lines.join("\n");
}

function formatAgentsList(payload) {
  const lines = ["Agents"];
  if (!Array.isArray(payload.agents) || payload.agents.length === 0) {
    pushLine(lines, "  none");
  } else {
    for (const agent of payload.agents) {
      pushLine(lines, `  - ${agent.id} | ${agent.name} | revision=${agent.revision} | ${agent.status}`);
    }
  }
  if (payload.nextCursor) pushLine(lines, `nextCursor: ${payload.nextCursor}`);
  return lines.join("\n");
}

function formatAgent(payload) {
  const agent = payload.agent;
  const lines = [`Agent ${agent.name}`];
  pushLine(lines, `  id: ${agent.id}`);
  pushLine(lines, `  teamId: ${agent.teamId}`);
  pushLine(lines, `  revision: ${agent.revision}`);
  pushLine(lines, `  status: ${agent.status}`);
  pushLine(lines, `  systemPrompt: ${agent.systemPrompt}`);
  return lines.join("\n");
}

function formatSessionsList(payload) {
  const lines = [`Sessions for ${payload.taskId}`];
  if (!Array.isArray(payload.sessions) || payload.sessions.length === 0) {
    pushLine(lines, "  none");
    return lines.join("\n");
  }
  for (const session of payload.sessions) {
    pushLine(lines, `  - ${session.id} | state=${session.state} | provider=${session.provider} | branch=${session.branch} | updated=${session.updatedAt}`);
  }
  return lines.join("\n");
}

function formatIssuesList(payload) {
  const lines = ["Issues"];
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    pushLine(lines, "  none");
  } else {
    for (const issue of payload.items) {
      pushLine(
        lines,
        `  - ${issue.reference.identifier} | ${issue.state.name} | ${issue.title} | ${issue.reference.url}`,
      );
    }
  }
  if (payload.pageInfo?.hasNextPage) {
    pushLine(lines, `nextCursor: ${payload.pageInfo.endCursor ?? "unavailable"}`);
  }
  return lines.join("\n");
}

function formatIntegrations(payload) {
  const lines = ["Integrations"];
  for (const integration of payload.integrations ?? []) {
    pushLine(lines, `  - ${integration.name} | ${integration.capabilities.join(", ")}`);
  }
  if (!payload.integrations?.length) {
    pushLine(lines, "  none");
  }
  return lines.join("\n");
}

function formatRepositories(payload) {
  const repositories = payload.items ?? (payload.repository ? [payload.repository] : []);
  const lines = [payload.repository ? "Repository" : "Repositories"];
  for (const repository of repositories) {
    pushLine(
      lines,
      `  - ${repository.fullName} | ${repository.visibility ?? "unknown"} | base=${repository.defaultBranch}${repository.isArchived ? " | archived" : ""}`,
    );
  }
  if (repositories.length === 0) {
    pushLine(lines, "  none");
  }
  if (payload.pageInfo?.hasNextPage) {
    pushLine(lines, `nextCursor: ${payload.pageInfo.endCursor ?? "unavailable"}`);
  }
  return lines.join("\n");
}

function formatIssue(payload) {
  const issue = payload.issue;
  const lines = [`Issue ${issue.reference.identifier}`];
  pushLine(lines, `  title: ${issue.title}`);
  pushLine(lines, `  state: ${issue.state.name}`);
  pushLine(lines, `  url: ${issue.reference.url}`);
  pushLine(lines, `  description: ${issue.description ?? "none"}`);
  return lines.join("\n");
}

function formatIssueDispatch(snapshot) {
  const lines = [`Dispatched ${snapshot.task.issue?.reference?.identifier ?? snapshot.task.id}`];
  pushLine(lines, `  taskId: ${snapshot.task.id}`);
  pushLine(lines, `  sessionId: ${snapshot.session.id}`);
  pushLine(lines, `  state: ${snapshot.session.state}`);
  pushLine(lines, `  branch: ${snapshot.session.branch}`);
  return lines.join("\n");
}

function formatSessionCancel(payload) {
  const lines = [`Cancel ${payload.session.id}`];
  pushLine(lines, `  outcome: ${payload.outcome}`);
  pushLine(lines, `  state: ${payload.session.state}`);
  return lines.join("\n");
}

function formatSessionWait(snapshot) {
  const result = snapshot.session.result ?? {};
  const issueIdentifier =
    snapshot.task.issue?.reference?.identifier
    ?? result.issue?.identifier
    ?? snapshot.task.id;
  const reviewUrl = result.reviewResult?.review?.url ?? "n/a";
  const sandbox = result.sandboxOutcome?.session;
  const agent = result.agentExecution;
  const lines = [`Waiting for review ${issueIdentifier}`];
  pushLine(lines, `  taskId: ${snapshot.task.id}`);
  pushLine(lines, `  sessionId: ${snapshot.session.id}`);
  pushLine(lines, `  branch: ${result.branch ?? snapshot.session.branch}`);
  pushLine(
    lines,
    `  test: ${result.quality?.test?.status ?? "n/a"} | ${result.quality?.test?.command ?? "n/a"}`,
  );
  pushLine(
    lines,
    `  build: ${result.quality?.build?.status ?? "n/a"} | ${result.quality?.build?.command ?? "n/a"}`,
  );
  pushLine(lines, `  preview: ${result.preview?.url ?? "n/a"}`);
  pushLine(lines, `  review: ${reviewUrl}`);
  pushLine(
    lines,
    `  sandbox: ${sandbox?.provider ?? "n/a"} | ${sandbox?.sessionId ?? "n/a"} | ${sandbox?.status ?? "n/a"}`,
  );
  pushLine(
    lines,
    `  image: ${snapshot.runtime?.environment?.image ?? snapshot.project?.runtime?.image ?? "n/a"}`,
  );
  pushLine(
    lines,
    `  provider: ${agent?.provider ?? "n/a"} ${agent?.cliVersion ?? "n/a"} | ${agent?.mode ?? "n/a"} | cap=${agent?.maxAutopilotContinues ?? "n/a"}`,
  );
  return lines.join("\n");
}

function formatSessionInspect(snapshot) {
  const lines = [];
  pushLine(lines, `Session ${snapshot.session.id}`);
  pushLine(lines, `  taskId: ${snapshot.task.id}`);
  pushLine(lines, `  state: ${snapshot.session.state}`);
  pushLine(lines, `  branch: ${snapshot.session.branch}`);
  pushLine(lines, `  project: ${snapshot.project?.slug ?? snapshot.task.projectId}`);
  pushLine(lines, `  context: ${contextRefsSummary(snapshot.project?.lane?.contextBundleRefs)}`);
  pushLine(lines, `  runtime: ${snapshot.session.resolvedRuntime?.environment?.image ?? snapshot.project?.runtime?.image ?? "n/a"}`);
  pushLine(lines, `  resultStatus: ${snapshot.session.result?.status ?? "none"}`);
  return lines.join("\n");
}

function formatTaskInspect(payload) {
  const lines = [`Task ${payload.task.id}`];
  pushLine(lines, `  title: ${payload.task.title}`);
  pushLine(lines, `  project: ${payload.task.projectId ?? "none"}`);
  pushLine(lines, `  issue: ${payload.task.issue?.identifier ?? "none"}`);
  pushLine(lines, `  description: ${payload.task.description ?? "none"}`);
  return lines.join("\n");
}

function formatResult(payload) {
  const lines = [];
  pushLine(lines, `Result ${payload.sessionId}`);
  pushLine(lines, `  state: ${payload.sessionState}`);
  pushLine(lines, `  project: ${payload.projectSlug ?? "n/a"}`);
  pushLine(lines, `  summary: ${payload.result.summary}`);
  pushLine(lines, `  branch: ${payload.result.branch ?? "n/a"}`);
  pushLine(lines, `  review: ${payload.result.reviewResult?.review?.url ?? "n/a"}`);
  pushLine(lines, `  preview: ${previewSummary(payload.result)}`);
  return lines.join("\n");
}

function formatFailure(payload) {
  const lines = [];
  pushLine(lines, `Failure ${payload.sessionId}`);
  pushLine(lines, `  state: ${payload.sessionState}`);
  pushLine(lines, `  project: ${payload.projectSlug ?? "n/a"}`);
  pushLine(lines, `  summary: ${payload.result.summary}`);
  pushLine(lines, `  errorCode: ${payload.result.errorCode ?? "n/a"}`);
  pushLine(lines, `  errorMessage: ${payload.result.errorMessage ?? "n/a"}`);
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

  if (command.group === "auth" && command.command === "login") {
    return `Logged in as ${payload.user?.username ?? "operator"}\n`;
  }
  if (command.group === "auth" && command.command === "logout") {
    return "Logged out\n";
  }
  if (command.group === "auth" && command.command === "session") {
    return `Session for ${payload.user?.username ?? "operator"}\n`;
  }
  if (command.group === "teams" && command.command === "use") {
    return `Active Team ${payload.team?.displayName ?? payload.team?.id ?? "selected"}\n`;
  }
  if (command.group === "control-plane") {
    return `${formatControlPlane(payload)}\n`;
  }
  if (command.group === "integrations") {
    return `${formatIntegrations(payload)}\n`;
  }
  if (command.group === "repositories") {
    return `${formatRepositories(payload)}\n`;
  }
  if (command.group === "projects" && command.command === "list") {
    return `${formatProjectsList(payload)}\n`;
  }
  if (command.group === "projects" && command.command === "inspect") {
    return `${formatProjectInspect(payload)}\n`;
  }
  if (command.group === "runners" && command.command === "list") {
    return `${formatRunnersList(payload)}\n`;
  }
  if (command.group === "runners" && command.command === "inspect") {
    return `${formatRunnerInspect(payload)}\n`;
  }
  if (command.group === "agents" && command.command === "list") {
    return `${formatAgentsList(payload)}\n`;
  }
  if (command.group === "agents") {
    return `${formatAgent(payload)}\n`;
  }
  if (command.group === "issues" && command.command === "list") {
    return `${formatIssuesList(payload)}\n`;
  }
  if (command.group === "issues" && command.command === "get") {
    return `${formatIssue(payload)}\n`;
  }
  if (command.group === "issues" && command.command === "dispatch") {
    return `${formatIssueDispatch(payload)}\n`;
  }
  if (command.group === "tasks" && command.command === "list") {
    return `${formatTasksList(payload)}\n`;
  }
  if (command.group === "tasks" && ["inspect", "create", "update", "start"].includes(command.command)) {
    return `${formatTaskInspect(payload)}\n`;
  }
  if (command.group === "sessions" && command.command === "list") {
    return `${formatSessionsList(payload)}\n`;
  }
  if (command.group === "sessions" && command.command === "inspect") {
    return `${formatSessionInspect(payload)}\n`;
  }
  if (command.group === "sessions" && command.command === "wait") {
    return `${formatSessionWait(payload)}\n`;
  }
  if (command.group === "sessions" && command.command === "cancel") {
    return `${formatSessionCancel(payload)}\n`;
  }
  if (command.group === "sessions" && command.command === "result") {
    return `${formatResult(payload)}\n`;
  }
  if (command.group === "sessions" && command.command === "failure") {
    return `${formatFailure(payload)}\n`;
  }
  return `${JSON.stringify(payload, null, 2)}\n`;
}

async function executeCommand(command, fetchImpl, deps = {}) {
  const sessionStore = deps.sessionStore ?? createSessionStore();
  const readPassword = deps.readPassword ?? (async () => await readFile(0, "utf8"));
  let baseUrl;
  const sleep = deps.sleep ?? (async (milliseconds) => {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  });
  const now = deps.now ?? Date.now;

  if (command.group === "auth" && command.command === "login") {
    try {
      baseUrl = normalizeControlPlaneUrl(command.controlPlaneUrl ?? DEFAULTS.controlPlaneUrl);
    } catch {
      return operatorError("INVALID_CONTROL_PLANE_URL", "Control-plane URL must use HTTP or HTTPS.", EXIT_CODES.INVALID);
    }
    let password;
    try {
      password = (await readPassword()).replace(/\r?\n$/, "");
    } catch {
      return operatorError("PASSWORD_INPUT_FAILED", "Unable to read password from stdin.", EXIT_CODES.INVALID);
    }
    if (!password) {
      return operatorError("INVALID_CREDENTIALS", "Password input must not be empty.", EXIT_CODES.INVALID);
    }
    const login = await readJson(new URL("/api/auth/login", baseUrl), fetchImpl, {
      method: "POST",
      body: JSON.stringify({ username: command.username, password }),
    });
    if (!login.ok) return login;
    const sessionToken = sessionTokenFromSetCookie(login.headers.get("set-cookie"));
    if (!sessionToken) {
      return operatorError(
        "INVALID_LOGIN_RESPONSE",
        "Login response did not establish a human session.",
        EXIT_CODES.TRANSPORT_ERROR,
      );
    }
    try {
      await sessionStore.write({
        version: OPERATOR_STATE_VERSION,
        controlPlaneUrl: baseUrl,
        sessionToken,
      });
    } catch {
      return operatorError(
        "SESSION_STORE_FAILED",
        "Unable to persist the local human session.",
        EXIT_CODES.TRANSPORT_ERROR,
      );
    }
    return { ok: true, payload: { user: login.data?.user ?? { username: command.username } } };
  }

  let session;
  try {
    session = await sessionStore.read();
  } catch {
    return operatorError(
      "INVALID_OPERATOR_SESSION",
      "The local human session is invalid. Log in again.",
      EXIT_CODES.UNAVAILABLE,
    );
  }
  if (!session) {
    return operatorError(
      "UNAUTHENTICATED",
      "No local human session. Run auth login first.",
      EXIT_CODES.UNAVAILABLE,
    );
  }
  if (command.controlPlaneUrl) {
    let requestedUrl;
    try {
      requestedUrl = normalizeControlPlaneUrl(command.controlPlaneUrl);
    } catch {
      return operatorError("INVALID_CONTROL_PLANE_URL", "Control-plane URL must use HTTP or HTTPS.", EXIT_CODES.INVALID);
    }
    if (requestedUrl !== session.controlPlaneUrl) {
      return operatorError(
        "CONTROL_PLANE_MISMATCH",
        "The requested control-plane URL does not match the local human session.",
        EXIT_CODES.INVALID,
      );
    }
  }
  try {
    baseUrl = normalizeControlPlaneUrl(session.controlPlaneUrl);
  } catch {
    return operatorError("INVALID_OPERATOR_SESSION", "The local human session is invalid. Log in again.", EXIT_CODES.UNAVAILABLE);
  }
  const transport = fetchImpl;
  const authenticatedFetch = async (url, init = {}) => await transport(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${session.sessionToken}`,
    },
  });
  fetchImpl = authenticatedFetch;

  if (command.group === "auth" && command.command === "logout") {
    const logout = await readJson(new URL("/api/auth/logout", baseUrl), fetchImpl, { method: "POST" });
    if (!logout.ok) return logout;
    try {
      await sessionStore.clear();
    } catch {
      return operatorError("SESSION_STORE_FAILED", "Unable to clear the local human session.", EXIT_CODES.TRANSPORT_ERROR);
    }
    return { ok: true, payload: { loggedOut: true } };
  }
  if (command.group === "auth" && command.command === "session") {
    return await readJson(new URL("/api/auth/session", baseUrl), fetchImpl);
  }
  if (command.group === "teams" && command.command === "use") {
    const selected = await readJson(new URL("/api/teams/switch", baseUrl), fetchImpl, {
      method: "POST",
      body: JSON.stringify({ teamId: command.target }),
    });
    if (!selected.ok) return selected;
    try {
      await sessionStore.write({ ...session, activeTeamId: command.target });
    } catch {
      return operatorError("SESSION_STORE_FAILED", "Unable to persist the active Team context.", EXIT_CODES.TRANSPORT_ERROR);
    }
    return selected;
  }

  if (command.group === "control-plane") {
    return await readJson(new URL("/api/control-plane", baseUrl), fetchImpl);
  }
  if (command.group === "integrations") {
    return await readJson(new URL("/api/integrations", baseUrl), fetchImpl);
  }
  if (command.group === "repositories" && command.command === "list") {
    const url = new URL(
      `/api/integrations/${encodeURIComponent(command.integration)}/repositories`,
      baseUrl,
    );
    if (command.limit !== undefined) {
      url.searchParams.set("limit", String(command.limit));
    }
    if (command.cursor) {
      url.searchParams.set("cursor", command.cursor);
    }
    return await readJson(url, fetchImpl);
  }
  if (command.group === "repositories" && command.command === "get") {
    const url = new URL(
      `/api/integrations/${encodeURIComponent(command.integration)}/repositories/resolve`,
      baseUrl,
    );
    url.searchParams.set("identifier", command.target);
    return await readJson(url, fetchImpl);
  }
  if (command.group === "projects" && command.command === "list") {
    return await readJson(new URL("/api/projects", baseUrl), fetchImpl);
  }
  if (command.group === "projects" && command.command === "inspect") {
    return await readJson(new URL(`/api/projects/${encodeURIComponent(command.target)}`, baseUrl), fetchImpl);
  }
  if (command.group === "agents" && command.command === "list") {
    const url = new URL("/api/agents", baseUrl);
    if (command.limit !== undefined) url.searchParams.set("limit", String(command.limit));
    if (command.cursor) url.searchParams.set("cursor", command.cursor);
    if (command.includeArchived) url.searchParams.set("includeArchived", "true");
    return await readJson(url, fetchImpl);
  }
  if (command.group === "agents" && command.command === "inspect") {
    return await readJson(new URL(`/api/agents/${encodeURIComponent(command.target)}`, baseUrl), fetchImpl);
  }
  if (command.group === "agents" && command.command === "create") {
    return await readJson(new URL("/api/agents", baseUrl), fetchImpl, {
      method: "POST",
      body: JSON.stringify({ name: command.name, systemPrompt: command.systemPrompt }),
    });
  }
  if (command.group === "agents" && command.command === "update") {
    return await readJson(new URL(`/api/agents/${encodeURIComponent(command.target)}`, baseUrl), fetchImpl, {
      method: "PATCH",
      body: JSON.stringify({
        expectedRevision: command.expectedRevision,
        ...(command.name ? { name: command.name } : {}),
        ...(command.systemPrompt ? { systemPrompt: command.systemPrompt } : {}),
      }),
    });
  }
  if (command.group === "agents" && command.command === "archive") {
    return await readJson(new URL(`/api/agents/${encodeURIComponent(command.target)}/archive`, baseUrl), fetchImpl, {
      method: "POST",
      body: JSON.stringify({ expectedRevision: command.expectedRevision }),
    });
  }
  if (command.group === "runners" && command.command === "list") {
    return await readJson(new URL("/api/runners", baseUrl), fetchImpl);
  }
  if (command.group === "runners" && command.command === "inspect") {
    return await readJson(
      new URL(`/api/runners/${encodeURIComponent(command.target)}`, baseUrl),
      fetchImpl,
    );
  }
  if (command.group === "issues" && command.command === "list") {
    const url = new URL(
      `/api/integrations/${encodeURIComponent(command.integration)}/issues`,
      baseUrl,
    );
    if (command.limit !== undefined) {
      url.searchParams.set("limit", String(command.limit));
    }
    if (command.cursor) {
      url.searchParams.set("cursor", command.cursor);
    }
    if (command.repository) {
      url.searchParams.set("repository", command.repository);
    }
    return await readJson(url, fetchImpl);
  }
  if (command.group === "issues" && command.command === "get") {
    const url = new URL(
        `/api/integrations/${encodeURIComponent(command.integration)}/issues/${encodeURIComponent(command.target)}`,
        baseUrl,
    );
    if (command.repository) {
      url.searchParams.set("repository", command.repository);
    }
    return await readJson(url, fetchImpl);
  }
  if (command.group === "issues" && command.command === "dispatch") {
    const project = await readJson(
      new URL(`/api/projects/${encodeURIComponent(command.project)}`, baseUrl),
      fetchImpl,
    );
    if (!project.ok) {
      return project;
    }
    if (typeof project.data?.project?.id !== "string") {
      return operatorError(
        "INVALID_RESPONSE",
        "Project response did not include an id",
        EXIT_CODES.INVALID,
        { project: command.project },
      );
    }
    return await readJson(
      new URL(
        `/api/integrations/${encodeURIComponent(command.integration)}/issues/${encodeURIComponent(command.target)}/dispatch`,
        baseUrl,
      ),
      fetchImpl,
      {
        method: "POST",
        body: JSON.stringify({
          projectId: project.data.project.id,
          provider: command.provider,
          branch: command.branch,
        }),
      },
    );
  }
  if (command.group === "tasks" && command.command === "list") {
    return await readJson(new URL("/api/tasks", baseUrl), fetchImpl);
  }
  if (command.group === "tasks" && command.command === "create") {
    return await readJson(new URL("/api/tasks", baseUrl), fetchImpl, {
      method: "POST",
      body: JSON.stringify({
        title: command.title,
        ...(command.description !== undefined ? { description: command.description } : {}),
        ...(command.project ? { projectId: command.project } : {}),
        idempotencyKey: command.idempotencyKey ?? crypto.randomUUID(),
      }),
    });
  }
  if (command.group === "tasks" && command.command === "inspect") {
    return await readJson(new URL(`/api/tasks/${encodeURIComponent(command.target)}`, baseUrl), fetchImpl);
  }
  if (command.group === "tasks" && command.command === "update") {
    return await readJson(new URL(`/api/tasks/${encodeURIComponent(command.target)}`, baseUrl), fetchImpl, {
      method: "PATCH",
      body: JSON.stringify({
        ...(command.title ? { title: command.title } : {}),
        ...(command.description !== undefined ? { description: command.description } : {}),
      }),
    });
  }
  if (command.group === "tasks" && command.command === "start") {
    return await readJson(new URL(`/api/tasks/${encodeURIComponent(command.target)}/production/start`, baseUrl), fetchImpl, {
      method: "POST",
      body: JSON.stringify({
        runtimeId: command.runtimeId,
        providerKey: command.provider,
        expectedRevision: command.expectedRevision,
        idempotencyKey: command.idempotencyKey,
        ...(command.agentContextId ? { agentId: command.agentContextId } : {}),
      }),
    });
  }
  if (command.group === "sessions" && command.command === "list") {
    return await readJson(new URL(`/api/tasks/${encodeURIComponent(command.target)}/sessions`, baseUrl), fetchImpl);
  }
  if (command.group === "sessions" && command.command === "create") {
    return await readJson(new URL(`/api/tasks/${encodeURIComponent(command.target)}/sessions`, baseUrl), fetchImpl, {
      method: "POST",
      body: JSON.stringify({
        title: command.title,
        objective: command.objective,
        ...(command.provider ? { provider: command.provider } : {}),
        ...(command.branch ? { branch: command.branch } : {}),
      }),
    });
  }

  if (command.group === "sessions" && command.command === "wait") {
    const deadline = now() + command.timeoutSeconds * 1_000;
    const url = new URL(`/api/sessions/${encodeURIComponent(command.target)}`, baseUrl);
    while (true) {
      const snapshot = await readJson(url, fetchImpl);
      if (!snapshot.ok) {
        return snapshot;
      }
      const state = snapshot.data?.session?.state;
      if (TERMINAL_SESSION_STATES.has(state)) {
        if (state === "succeeded" || state === "waiting_for_review") {
          return snapshot;
        }
        return operatorError(
          "SESSION_TERMINAL_FAILURE",
          `Session reached terminal state ${state}.`,
          EXIT_CODES.UNAVAILABLE,
          snapshot.data,
        );
      }
      if (now() >= deadline) {
        return operatorError(
          "WAIT_TIMEOUT",
          "Session did not reach a terminal state before the local timeout.",
          EXIT_CODES.NOT_READY,
          {
            sessionId: command.target,
            timeoutSeconds: command.timeoutSeconds,
          },
        );
      }
      await sleep(command.intervalSeconds * 1_000);
    }
  }

  if (command.group === "sessions" && command.command === "cancel") {
    return await readJson(
      new URL(`/api/sessions/${encodeURIComponent(command.target)}/cancel`, baseUrl),
      fetchImpl,
      { method: "POST", body: JSON.stringify({ reason: "Canceled by operator" }) },
    );
  }

  const snapshot = await readJson(new URL(`/api/sessions/${encodeURIComponent(command.target)}`, baseUrl), fetchImpl);
  if (!snapshot.ok) {
    return snapshot;
  }

  if (command.group === "sessions" && command.command === "inspect") {
    return snapshot;
  }
  if (command.group === "sessions" && command.command === "result") {
    return resultView(snapshot.data);
  }
  if (command.group === "sessions" && command.command === "failure") {
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

  const result = await executeCommand(parsed.value, fetchImpl, {
    ...(deps.sleep ? { sleep: deps.sleep } : {}),
    ...(deps.now ? { now: deps.now } : {}),
    ...(deps.sessionStore ? { sessionStore: deps.sessionStore } : {}),
    ...(deps.readPassword ? { readPassword: deps.readPassword } : {}),
  });
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
  createSessionStore,
  EXIT_CODES,
  parseArgs,
  resultView,
  failureView,
};
