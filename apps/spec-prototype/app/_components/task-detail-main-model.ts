export type Feature054TaskStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "done"
  | "canceled";

export type TaskWorkspaceState =
  | "queued"
  | "preparing"
  | "ready"
  | "failed"
  | "unavailable";

export type SessionState =
  | "queued"
  | "dispatched"
  | "message_pending"
  | "running"
  | "ready"
  | "interrupted"
  | "waiting_for_handoff"
  | "closed"
  | "failed";

export type ProviderKey = "codex" | "copilot";

interface TaskMainTask {
  id: string;
  teamId: string;
  projectId: string | null;
  status: Feature054TaskStatus;
  statusRevision: number;
  statusNote: string | null;
  statusUpdatedAt: string;
  statusActor: {
    kind: "system" | "human" | "agent";
    actorId: string | null;
    agentId: string | null;
    attemptId: string | null;
    sessionId: string | null;
  };
}

interface TaskMainExecutionAttempt {
  id: string;
  teamId: string;
  taskId: string;
  projectId: string;
  agentId: string | null;
  agentName: string | null;
  agentRevision: number | null;
  runtimeId: string;
  providerKey: ProviderKey;
  workspaceId: string | null;
  plannedSessionId: string;
  sessionId: string | null;
  setupFailureCode: string | null;
  setupFailureMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TaskMainWorkspace {
  id: string;
  taskId: string;
  projectId: string;
  runtimeId: string;
  state: TaskWorkspaceState;
  sharingMode: "shared-mutable";
  configuredBaseBranch: string;
  baseRef: string;
  baseCommit: string;
  branchName: string;
  branchStrategy: string;
  createdAt: string;
  updatedAt: string;
  readyAt: string | null;
  failure: { code: string; message: string | null } | null;
}

export interface TaskMainSession {
  id: string;
  teamId: string;
  taskId: string;
  projectId: string | null;
  runtimeId: string;
  providerKey: ProviderKey;
  agentId: string | null;
  agentRevision: number | null;
  state: SessionState;
  activeMessageId: string | null;
  lastMessageId: string | null;
  interruptKind: string | null;
  continuationMode: string | null;
  failureCode: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDetailMainFixture {
  task: TaskMainTask;
  attempt: TaskMainExecutionAttempt | null;
  workspace: TaskMainWorkspace | null;
  sessions: readonly TaskMainSession[];
  runtimeNames: Readonly<Record<string, string>>;
}

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TASK_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const RUNTIME_ID = "44444444-4444-4444-8444-444444444444";
const AGENT_ID = "55555555-5555-4555-8555-555555555555";
const ATTEMPT_ID = "66666666-6666-4666-8666-666666666666";
const WORKSPACE_ID = "77777777-7777-4777-8777-777777777777";
const PRIMARY_SESSION_ID = "88888888-8888-4888-8888-888888888888";

export const TASK_DETAIL_MAIN_FIXTURE: TaskDetailMainFixture = {
  task: {
    id: TASK_ID,
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
    status: "in_progress",
    statusRevision: 4,
    statusNote: null,
    statusUpdatedAt: "2026-08-14T03:18:00.000Z",
    statusActor: {
      kind: "human",
      actorId: "arcadia",
      agentId: null,
      attemptId: null,
      sessionId: null,
    },
  },
  attempt: {
    id: ATTEMPT_ID,
    teamId: TEAM_ID,
    taskId: TASK_ID,
    projectId: PROJECT_ID,
    agentId: AGENT_ID,
    agentName: "Codex",
    agentRevision: 7,
    runtimeId: RUNTIME_ID,
    providerKey: "codex",
    workspaceId: WORKSPACE_ID,
    plannedSessionId: PRIMARY_SESSION_ID,
    sessionId: PRIMARY_SESSION_ID,
    setupFailureCode: null,
    setupFailureMessage: null,
    createdAt: "2026-08-14T03:10:00.000Z",
    updatedAt: "2026-08-14T03:16:00.000Z",
  },
  workspace: {
    id: WORKSPACE_ID,
    taskId: TASK_ID,
    projectId: PROJECT_ID,
    runtimeId: RUNTIME_ID,
    state: "ready",
    sharingMode: "shared-mutable",
    configuredBaseBranch: "main",
    baseRef: "refs/heads/main",
    baseCommit: "54b81ac3a1329e4f4fd80bd649846b61253c982d",
    branchName: "codex/054-navigation-task-workbench",
    branchStrategy: "task-slug",
    createdAt: "2026-08-14T03:10:00.000Z",
    updatedAt: "2026-08-14T03:12:00.000Z",
    readyAt: "2026-08-14T03:12:00.000Z",
    failure: null,
  },
  sessions: [
    {
      id: PRIMARY_SESSION_ID,
      teamId: TEAM_ID,
      taskId: TASK_ID,
      projectId: PROJECT_ID,
      runtimeId: RUNTIME_ID,
      providerKey: "copilot",
      agentId: AGENT_ID,
      agentRevision: 7,
      state: "running",
      activeMessageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      lastMessageId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      interruptKind: null,
      continuationMode: null,
      failureCode: null,
      metadata: {},
      createdAt: "2026-08-14T03:12:00.000Z",
      updatedAt: "2026-08-14T03:18:00.000Z",
    },
    {
      id: "99999999-9999-4999-8999-999999999999",
      teamId: TEAM_ID,
      taskId: TASK_ID,
      projectId: PROJECT_ID,
      runtimeId: RUNTIME_ID,
      providerKey: "codex",
      agentId: null,
      agentRevision: null,
      state: "ready",
      activeMessageId: null,
      lastMessageId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      interruptKind: null,
      continuationMode: "new_message",
      failureCode: null,
      metadata: {},
      createdAt: "2026-08-13T08:28:00.000Z",
      updatedAt: "2026-08-13T09:04:00.000Z",
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      teamId: TEAM_ID,
      taskId: TASK_ID,
      projectId: PROJECT_ID,
      runtimeId: RUNTIME_ID,
      providerKey: "codex",
      agentId: AGENT_ID,
      agentRevision: 7,
      state: "failed",
      activeMessageId: null,
      lastMessageId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      interruptKind: null,
      continuationMode: null,
      failureCode: "provider_exit",
      metadata: {},
      createdAt: "2026-08-12T06:42:00.000Z",
      updatedAt: "2026-08-12T06:43:00.000Z",
    },
  ],
  runtimeNames: { [RUNTIME_ID]: "Arcadia Mac" },
};

export const TASK_STATUS_LABELS: Readonly<Record<Feature054TaskStatus, string>> = {
  pending: "Pending",
  in_progress: "In progress",
  blocked: "Needs handoff",
  done: "Done",
  canceled: "Canceled",
};

export const WORKSPACE_STATE_LABELS: Readonly<Record<TaskWorkspaceState, string>> = {
  queued: "Queued",
  preparing: "Preparing",
  ready: "Ready",
  failed: "Failed",
  unavailable: "Unavailable",
};

export const SESSION_STATE_LABELS: Readonly<Record<SessionState, string>> = {
  queued: "Queued",
  dispatched: "Dispatched",
  message_pending: "Message pending",
  running: "Running",
  ready: "Ready to continue",
  interrupted: "Interrupted",
  waiting_for_handoff: "Waiting for handoff",
  closed: "Closed",
  failed: "Failed",
};
