import {
  assertRunStateTransition,
  jobSpecSchema,
  platformCapabilitiesSchema,
  runEventSchema,
  runResultSchema,
  type JobSpec,
  type PlatformCapabilities,
  type RunEvent,
  type RunResult,
  type RunState,
} from "@mystra/shared";

export interface LocalJobRecord {
  id: string;
  spec: JobSpec;
  createdAt: string;
  updatedAt: string;
}

export interface LocalRunRecord {
  id: string;
  jobId: string;
  state: RunState;
  attempt: number;
  assignedRunnerSessionId?: string;
  result?: RunResult;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface LocalRunnerSession {
  id: string;
  token: string;
  runnerName: string;
  capabilities: PlatformCapabilities;
  maxConcurrency: number;
  activeRunCount: number;
  lastHeartbeatAt: string;
  createdAt: string;
}

export type PublicRunnerSession = Omit<LocalRunnerSession, "token">;

export interface LocalJobSnapshot {
  job: LocalJobRecord;
  run: LocalRunRecord;
  events: RunEvent[];
}

interface LocalStoreState {
  jobs: Map<string, LocalJobRecord>;
  runs: Map<string, LocalRunRecord>;
  runners: Map<string, LocalRunnerSession>;
  events: RunEvent[];
}

const globalStore = globalThis as typeof globalThis & {
  __mystraLocalStore?: LocalStoreState;
};

function state(): LocalStoreState {
  globalStore.__mystraLocalStore ??= {
    events: [],
    jobs: new Map(),
    runners: new Map(),
    runs: new Map(),
  };

  return globalStore.__mystraLocalStore;
}

function now(): string {
  return new Date().toISOString();
}

function appendEvent(input: Omit<RunEvent, "timestamp"> & { timestamp?: string }): RunEvent {
  const event = runEventSchema.parse({
    ...input,
    timestamp: input.timestamp ?? now(),
  });
  state().events.push(event);
  return event;
}

function transitionRun(run: LocalRunRecord, nextState: RunState): LocalRunRecord {
  assertRunStateTransition(run.state, nextState);
  run.state = nextState;
  run.updatedAt = now();

  if (nextState === "running" && !run.startedAt) {
    run.startedAt = run.updatedAt;
  }

  if (["succeeded", "failed", "canceled", "timed_out", "needs_human_review"].includes(nextState)) {
    run.finishedAt = run.updatedAt;
  }

  return run;
}

export function createLocalJob(input: unknown): LocalJobSnapshot {
  const spec = jobSpecSchema.parse(input);
  const timestamp = now();
  const job: LocalJobRecord = {
    id: crypto.randomUUID(),
    spec,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const run: LocalRunRecord = {
    id: crypto.randomUUID(),
    jobId: job.id,
    state: "queued",
    attempt: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const store = state();
  store.jobs.set(job.id, job);
  store.runs.set(run.id, run);
  appendEvent({
    runId: run.id,
    jobId: job.id,
    type: "job.created",
    severity: "info",
    data: { taskId: spec.taskId },
  });
  appendEvent({
    runId: run.id,
    jobId: job.id,
    type: "run.queued",
    severity: "info",
    data: {},
  });

  return getLocalJob(job.id) ?? { job, run, events: [] };
}

export function getLocalJob(jobId: string): LocalJobSnapshot | undefined {
  const store = state();
  const job = store.jobs.get(jobId);
  if (!job) {
    return undefined;
  }

  const run = [...store.runs.values()].find((candidate) => candidate.jobId === jobId);
  if (!run) {
    return undefined;
  }

  return {
    job,
    run,
    events: store.events.filter((event) => event.jobId === jobId),
  };
}

export function listLocalJobs(): LocalJobSnapshot[] {
  return [...state().jobs.values()]
    .map((job) => getLocalJob(job.id))
    .filter((snapshot): snapshot is LocalJobSnapshot => Boolean(snapshot))
    .sort((a, b) => b.job.createdAt.localeCompare(a.job.createdAt));
}

function publicRunner(runner: LocalRunnerSession): PublicRunnerSession {
  const { token: _token, ...publicSession } = runner;
  void _token;
  return publicSession;
}

export function listLocalRunners(): PublicRunnerSession[] {
  return [...state().runners.values()].map(publicRunner);
}

export function registerLocalRunner(input: {
  runnerName: string;
  capabilities?: PlatformCapabilities;
  maxConcurrency?: number;
}): LocalRunnerSession {
  const timestamp = now();
  const session: LocalRunnerSession = {
    id: crypto.randomUUID(),
    token: crypto.randomUUID(),
    runnerName: input.runnerName,
    capabilities: platformCapabilitiesSchema.parse(
      input.capabilities ?? { agents: ["codex", "copilot"], executor: "fake" },
    ),
    maxConcurrency: input.maxConcurrency ?? 1,
    activeRunCount: 0,
    lastHeartbeatAt: timestamp,
    createdAt: timestamp,
  };
  state().runners.set(session.id, session);
  return session;
}

export function authenticateRunner(token: string | null): LocalRunnerSession | undefined {
  if (!token) {
    return undefined;
  }

  return [...state().runners.values()].find((runner) => runner.token === token);
}

export function heartbeatRunner(runner: LocalRunnerSession): LocalRunnerSession {
  runner.lastHeartbeatAt = now();
  return runner;
}

export function claimNextLocalRun(runner: LocalRunnerSession): LocalJobSnapshot | undefined {
  const store = state();
  const run = [...store.runs.values()].find((candidate) => candidate.state === "queued");
  if (!run) {
    return undefined;
  }

  transitionRun(run, "assigned");
  run.assignedRunnerSessionId = runner.id;
  runner.activeRunCount += 1;
  appendEvent({
    runId: run.id,
    jobId: run.jobId,
    type: "run.assigned",
    severity: "info",
    data: { runnerSessionId: runner.id },
  });

  return getLocalJob(run.jobId);
}

export function appendLocalRunEvent(runner: LocalRunnerSession, runId: string, input: unknown): RunEvent {
  const run = state().runs.get(runId);
  if (!run || run.assignedRunnerSessionId !== runner.id) {
    throw new Error("Run is not assigned to this runner");
  }

  const event = runEventSchema.parse({
    ...input as Record<string, unknown>,
    runId,
    jobId: run.jobId,
    timestamp: now(),
  });
  state().events.push(event);

  if (event.type === "container.started" && run.state === "assigned") {
    transitionRun(run, "starting");
  }
  if (event.type === "agent.started" && ["assigned", "starting"].includes(run.state)) {
    transitionRun(run, "running");
  }

  return event;
}

export function completeLocalRun(runner: LocalRunnerSession, runId: string, input: unknown): LocalJobSnapshot {
  const run = state().runs.get(runId);
  if (!run || run.assignedRunnerSessionId !== runner.id) {
    throw new Error("Run is not assigned to this runner");
  }

  const result = runResultSchema.parse(input);
  run.result = result;
  transitionRun(run, result.status);
  runner.activeRunCount = Math.max(0, runner.activeRunCount - 1);
  appendEvent({
    runId,
    jobId: run.jobId,
    type: `run.${result.status}`,
    severity: result.status === "succeeded" ? "info" : "error",
    data: { summary: result.summary },
  });

  const snapshot = getLocalJob(run.jobId);
  if (!snapshot) {
    throw new Error("Completed run has no job snapshot");
  }

  return snapshot;
}

export function cancelLocalJob(jobId: string): LocalJobSnapshot | undefined {
  const snapshot = getLocalJob(jobId);
  if (!snapshot) {
    return undefined;
  }

  transitionRun(snapshot.run, "canceled");
  appendEvent({
    runId: snapshot.run.id,
    jobId,
    type: "run.canceled",
    severity: "warn",
    data: {},
  });

  return getLocalJob(jobId);
}
