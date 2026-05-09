import type {
  ContextBundle,
  ContextBundleCreate,
  JobSpec,
  PlatformCapabilities,
  Project,
  ProjectCreate,
  ProjectUpdate,
  ResolvedRuntimeContract,
  RunEvent,
  RunResult,
  RunState,
} from "@mystra/shared";

export type JobRecord = {
  id: string;
  spec: JobSpec;
  createdAt: string;
  updatedAt: string;
};

export type RunRecord = {
  id: string;
  jobId: string;
  state: RunState;
  attempt: number;
  assignedRunnerSessionId?: string;
  resolvedRuntime?: ResolvedRuntimeContract;
  result?: RunResult;
  failureReason?: string;
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
  lastHeartbeatAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicRunnerSession = Omit<RunnerSession, "token">;

export type ProjectClaim = Pick<Project, "id" | "slug" | "runtime" | "prewarmConfig">;

export type JobSnapshot = {
  job: JobRecord;
  run: RunRecord;
  events: RunEvent[];
  project?: ProjectClaim;
  runtime?: ResolvedRuntimeContract;
};

export type RegisterRunnerInput = {
  runnerName: string;
  capabilities?: unknown;
  maxConcurrency?: number;
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

  createJob(input: unknown): JobSnapshot;
  getJob(id: string): JobSnapshot | undefined;
  listJobs(): JobSnapshot[];
  cancelJob(id: string): JobSnapshot | undefined;

  registerRunner(input: RegisterRunnerInput): RunnerSession;
  authenticateRunner(token: string | null): RunnerSession | undefined;
  heartbeatRunner(runnerId: string): RunnerSession;
  listRunners(): PublicRunnerSession[];
  claimNextRun(runnerId: string): JobSnapshot | undefined;
  appendRunEvent(runnerId: string, runId: string, input: unknown): RunEvent;
  completeRun(runnerId: string, runId: string, input: unknown): JobSnapshot;
}
