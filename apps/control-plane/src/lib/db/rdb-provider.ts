import type {
  CancellationRequestMetadata,
  CoordinationSessionSummary,
  ContextBundle,
  ContextBundleCreate,
  PlatformCapabilities,
  Project,
  ProjectCreate,
  ProjectUpdate,
  PublicRunner,
  ResolvedRuntimeContract,
  SessionCreateRequest,
  SessionEvent,
  SessionRecord,
  SessionResult,
  StaleMarkingResult,
  TaskCreate,
  TaskCreateRequest,
  TaskListItem,
  TaskRecord,
  TaskSessionSummary,
} from "@mystra/shared";

export type ProjectClaim = Pick<Project, "id" | "slug" | "runtime" | "prewarmConfig">;

export type SessionClaim = {
  task: TaskRecord;
  session: SessionRecord;
  project: ProjectClaim;
  runtime: ResolvedRuntimeContract;
};

export type RunnerRecord = {
  id: string;
  name: string;
  capabilities: PlatformCapabilities;
  maxConcurrency: number;
  staleAfterSeconds: number;
  eligibleProjectIds?: string[];
  eligibleRuntimeProviders?: string[];
  lastHeartbeatAt: string;
  createdAt: string;
  updatedAt: string;
};

export type RegisterRunnerInput = {
  runnerName: string;
  capabilities?: unknown;
  maxConcurrency?: number;
  staleAfterSeconds?: number;
  eligibleProjectIds?: string[] | undefined;
  eligibleRuntimeProviders?: string[] | undefined;
};

export type RunnerRegistrationResult = {
  runner: RunnerRecord;
  credential: string;
};

export type IssueDispatchInput = {
  task: TaskCreate;
  session: SessionCreateRequest;
};

export type IssueDispatchResult = {
  task: TaskRecord;
  session: SessionRecord;
  created: boolean;
};

export interface RdbProvider {
  close(): void;

  createProject(input: ProjectCreate): Project;
  listProjects(options?: { includeArchived?: boolean }): Project[];
  getProjectById(id: string): Project | undefined;
  getProjectBySlug(slug: string): Project | undefined;
  updateProject(slug: string, input: ProjectUpdate): Project | undefined;
  archiveProject(slug: string): Project | undefined;

  createContextBundle(input: ContextBundleCreate): ContextBundle;
  getContextBundleBySlug(slug: string): ContextBundle | undefined;
  listContextBundles(options?: { includeArchived?: boolean }): ContextBundle[];

  createTask(input: TaskCreateRequest): TaskRecord;
  dispatchIssue(input: IssueDispatchInput): IssueDispatchResult;
  getTask(id: string): TaskRecord | undefined;
  getTaskByDispatchKey(dispatchKey: string): TaskRecord | undefined;
  listTasks(): TaskListItem[];
  getTaskSessionSummary(id: string): TaskSessionSummary | undefined;

  createSession(taskId: string, input: SessionCreateRequest): SessionRecord;
  getSession(id: string): SessionRecord | undefined;
  listSessions(taskId: string): SessionRecord[];
  getSessionSummary(id: string): CoordinationSessionSummary | undefined;
  cancelSession(id: string, request?: Partial<CancellationRequestMetadata>): {
    outcome: "canceled" | "cancellation_requested";
    session: SessionRecord;
  };

  registerRunner(input: RegisterRunnerInput): RunnerRegistrationResult;
  authenticateRunner(credential: string | null): RunnerRecord | undefined;
  heartbeatRunner(runnerId: string, activeSessionIds?: string[]): RunnerRecord;
  getRunner(runnerId: string): PublicRunner | undefined;
  listRunners(): PublicRunner[];
  claimNextSession(runnerId: string): SessionClaim | undefined;
  getSessionClaim(runnerId: string, sessionId: string): SessionClaim | undefined;
  appendSessionEvent(runnerId: string, sessionId: string, input: unknown): SessionEvent;
  completeSession(runnerId: string, sessionId: string, input: unknown): SessionRecord;
  listInternalSessionEvents(sessionId: string): SessionEvent[];

  markStaleRunners(): StaleMarkingResult[];
}

export type { SessionResult };
