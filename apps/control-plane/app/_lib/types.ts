export interface RunnerCapabilities {
  agents: string[];
  executor: string;
  image?: string;
}

export interface Runner {
  id: string;
  name: string;
  capabilities: RunnerCapabilities;
  maxConcurrency: number;
  activeSessionCount: number;
  health: "healthy" | "stale";
  staleAfterSeconds: number;
  currentAssignments: Array<{ taskId: string; sessionId: string }>;
  lastHeartbeatAt: string;
  createdAt: string;
  updatedAt: string;
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
  state: { name: string; type?: string };
  fetchedAt?: string;
}

export interface Task {
  id: string;
  projectId: string;
  source: string;
  objective: string;
  issue?: IssueSnapshot;
  repository: { fullName: string; defaultBranch?: string };
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TaskListItem extends Task {
  sessionCount: number;
  activeSessionCount: number;
  latestSession?: SessionSummary;
}

export interface SessionResult {
  status: string;
  summary: string;
  branch?: string;
  errorCode?: string;
  errorMessage?: string;
  preview?: { url?: string; status?: string };
  quality?: {
    test?: { status?: string; command?: string; summary?: string };
    build?: { status?: string; command?: string; summary?: string };
  };
  reviewResult?: { review?: { url?: string; provider?: string } };
  sandboxOutcome?: { session?: { provider?: string; sessionId?: string; status?: string } };
  agentExecution?: {
    agent?: string;
    cliVersion?: string;
    mode?: string;
    maxAutopilotContinues?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface SessionSummary {
  id: string;
  taskId: string;
  title: string;
  state: string;
  agent: string;
  branch: string;
  assignedRunnerId?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface Session extends SessionSummary {
  objective: string;
  result?: SessionResult;
  failureReason?: string;
  resolvedRuntime?: { environment?: { provider?: string; image?: string } };
}

export interface ControlPlanePayload {
  controlPlane: {
    checkedAt: string;
    status: "ready" | "degraded";
    tasks: { total: number; withoutSessions: number };
    sessions: {
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
      activeSessions: number;
      maxConcurrency: number;
      availableCapacity: number;
    };
    recentTasks: TaskListItem[];
  };
}
