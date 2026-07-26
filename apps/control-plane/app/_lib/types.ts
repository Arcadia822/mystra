export interface RunnerCapabilities {
  agents: string[];
  executor: string;
  image?: string;
}

export interface RunnerSession {
  id: string;
  runnerName: string;
  capabilities: RunnerCapabilities;
  maxConcurrency: number;
  activeRunCount: number;
  staleAfterSeconds: number;
  lastHeartbeatAt: string;
  createdAt: string;
  eligibleProjectIds?: string[];
  eligibleRuntimeProviders?: string[];
}

export interface IssueSnapshot {
  reference: {
    provider: string;
    externalId: string;
    identifier: string;
    url: string;
  };
  title: string;
  description?: string | null;
  state: {
    name: string;
    type?: string;
  };
  fetchedAt?: string;
}

export interface JobSnapshot {
  job: {
    id: string;
    spec: {
      taskId: string;
      source: string;
      projectId?: string;
      repo?: string;
      baseBranch?: string;
      branchName: string;
      agent?: string;
      prompt: string;
      issue?: IssueSnapshot;
      metadata?: Record<string, unknown>;
    };
    createdAt: string;
    updatedAt: string;
  };
  run: {
    id: string;
    jobId?: string;
    state: string;
    attempt: number;
    assignedRunnerSessionId?: string;
    result?: RunResult;
    createdAt: string;
    updatedAt: string;
    startedAt?: string;
    finishedAt?: string;
  };
  events: Array<{
    timestamp: string;
    type: string;
    severity: string;
    data: Record<string, unknown>;
  }>;
  project?: {
    id: string;
    name: string;
    slug: string;
    repo: string;
    baseBranch: string;
    defaultAgent: string;
    runtime: {
      provider: string;
      image: string;
    };
  };
  lane?: {
    projectSlug?: string;
  };
  runtime?: {
    environment?: {
      provider?: string;
      image?: string;
    };
  };
}

export interface RunResult {
  status: string;
  summary: string;
  branch?: string;
  mrUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  preview?: { url?: string; status?: string };
  quality?: {
    test?: { status?: string; command?: string; summary?: string };
    build?: { status?: string; command?: string; summary?: string };
  };
  reviewResult?: {
    review?: { url?: string; provider?: string };
  };
  sandboxOutcome?: {
    session?: {
      provider?: string;
      sessionId?: string;
      status?: string;
    };
  };
  agentExecution?: {
    agent?: string;
    cliVersion?: string;
    mode?: string;
    maxAutopilotContinues?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface ControlPlanePayload {
  controlPlane: {
    checkedAt: string;
    status: "ready" | "degraded";
    tasks: {
      total: number;
      queued: number;
      active: number;
      waitingForReview: number;
      succeeded: number;
      failed: number;
    };
    runners: {
      total: number;
      online: number;
      stale: number;
      activeRuns: number;
      maxConcurrency: number;
      availableCapacity: number;
    };
    recentTasks: JobSnapshot[];
  };
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  repo: string;
  baseBranch: string;
  defaultAgent: string;
}

export interface Issue {
  reference: {
    identifier: string;
    url: string;
  };
  title: string;
  state: { name: string };
}
