import type {
  CancelTaskOutcome,
  CancellationRequestMetadata,
  ContextBundle,
  ContextBundleCreate,
  PlatformCapabilities,
  Project,
  ProjectCreate,
  ProjectUpdate,
  ResolvedRuntimeContract,
  RunEvent,
  RunResult,
  RunState,
  StaleMarkingResult,
  TaskSpec,
  WorkflowExecutionSnapshot,
} from "@mystra/shared";

export type TaskRecord = {
  id: string;
  spec: TaskSpec;
  createdAt: string;
  updatedAt: string;
};

export type RunRecord = {
  id: string;
  taskId: string;
  state: RunState;
  attempt: number;
  assignedRunnerSessionId?: string;
  resolvedRuntime?: ResolvedRuntimeContract;
  result?: RunResult;
  failureReason?: string;
  cancellationRequest?: CancellationRequestMetadata;
  staleReason?: string;
  staleMarkedAt?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
};

export type RunnerSession = {
  id: string;
  token: string;
  runnerName: string;
  capabilities: PlatformCapabilities;
  maxConcurrency: number;
  activeRunCount: number;
  staleAfterSeconds: number;
  eligibleProjectIds?: string[];
  eligibleRuntimeProviders?: string[];
  lastHeartbeatAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicRunnerSession = Omit<RunnerSession, "token">;

export type ProjectClaim = Pick<Project, "id" | "slug" | "runtime" | "prewarmConfig">;

export type TaskSnapshot = {
  task: TaskRecord;
  run: RunRecord;
  events: RunEvent[];
  workflow?: WorkflowExecutionSnapshot;
  project?: ProjectClaim;
  runtime?: ResolvedRuntimeContract;
};

export type RegisterRunnerInput = {
  runnerName: string;
  capabilities?: unknown;
  maxConcurrency?: number;
  staleAfterSeconds?: number;
  eligibleProjectIds?: string[] | undefined;
  eligibleRuntimeProviders?: string[] | undefined;
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

  createTask(input: unknown): TaskSnapshot;
  getTask(id: string): TaskSnapshot | undefined;
  getTaskByRunId(runId: string): TaskSnapshot | undefined;
  listTasks(): TaskSnapshot[];
  cancelTask(id: string): CancelTaskOutcome & { snapshot: TaskSnapshot };

  registerRunner(input: RegisterRunnerInput): RunnerSession;
  authenticateRunner(token: string | null): RunnerSession | undefined;
  heartbeatRunner(runnerId: string): RunnerSession;
  listRunners(): PublicRunnerSession[];
  claimNextRun(runnerId: string): TaskSnapshot | undefined;
  appendRunEvent(runnerId: string, runId: string, input: unknown): RunEvent;
  completeRun(runnerId: string, runId: string, input: unknown): TaskSnapshot;

  markStaleRunners(): StaleMarkingResult[];
}
