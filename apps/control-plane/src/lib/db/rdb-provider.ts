import type {
  IntegrationCapabilities,
  IntegrationConnection,
  IntegrationConnectionActivation,
  IntegrationConnectionStatus,
  IntegrationCredentialState,
  Project,
  ProjectCreate,
  ProjectUpdate,
  TaskCreateRequest,
  TaskListItem,
  TaskRecord,
} from "@mystra/shared";

export type IntegrationConnectionRecord = IntegrationConnection & {
  credentialRef?: string;
};

export type IntegrationConnectionUpsert = {
  id?: string;
  integration: string;
  provider: string;
  authMethod: string;
  providerExternalId: string;
  displayName?: string | null;
  providerSubject: Record<string, unknown>;
  connectionConfig?: Record<string, unknown>;
  capabilities?: IntegrationCapabilities;
  credentialState: IntegrationCredentialState;
  credentialRef?: string;
  status?: IntegrationConnectionStatus;
};

export type IssueDispatchResult = {
  task: TaskRecord;
  created: boolean;
};

/**
 * Domain-owned relational persistence boundary.
 *
 * Prisma clients, driver adapters, connection URLs, pools, and database error
 * types must never appear in this contract. The first Prisma phase deliberately
 * contains only IntegrationConnection, Project, and Task persistence.
 */
export interface RdbProvider {
  close(): Promise<void>;

  activateIntegrationConnection(input: IntegrationConnectionActivation): Promise<IntegrationConnection>;
  upsertIntegrationConnection(input: IntegrationConnectionUpsert): Promise<IntegrationConnectionRecord>;
  replaceIntegrationConnection(
    id: string,
    input: IntegrationConnectionUpsert,
  ): Promise<IntegrationConnectionRecord | undefined>;
  getIntegrationConnection(id: string): Promise<IntegrationConnection | undefined>;
  getIntegrationConnectionRecord(id: string): Promise<IntegrationConnectionRecord | undefined>;
  listIntegrationConnections(options?: { integration?: string }): Promise<IntegrationConnection[]>;
  listIntegrationConnectionRecords(options?: { integration?: string }): Promise<IntegrationConnectionRecord[]>;
  updateIntegrationConnectionDisplayName(
    id: string,
    displayName: string | null,
  ): Promise<IntegrationConnectionRecord | undefined>;
  replaceIntegrationConnectionCapabilities(
    id: string,
    capabilities: IntegrationCapabilities,
  ): Promise<IntegrationConnectionRecord | undefined>;
  setIntegrationConnectionStatus(
    id: string,
    status: IntegrationConnectionStatus,
    credentialState?: IntegrationCredentialState,
  ): Promise<IntegrationConnectionRecord | undefined>;
  deleteIntegrationConnection(id: string): Promise<boolean>;
  listProjectsForIntegrationConnection(id: string): Promise<Project[]>;

  createProject(input: ProjectCreate): Promise<Project>;
  listProjects(options?: { includeArchived?: boolean }): Promise<Project[]>;
  getProjectById(id: string): Promise<Project | undefined>;
  getProjectBySlug(slug: string): Promise<Project | undefined>;
  updateProject(slug: string, input: ProjectUpdate): Promise<Project | undefined>;
  archiveProject(slug: string): Promise<Project | undefined>;

  createTask(input: TaskCreateRequest): Promise<TaskRecord>;
  dispatchIssue(input: TaskCreateRequest & { issueDispatchKey: string }): Promise<IssueDispatchResult>;
  getTask(id: string): Promise<TaskRecord | undefined>;
  getTaskByIssueDispatchKey(issueDispatchKey: string): Promise<TaskRecord | undefined>;
  listTasks(options?: { projectId?: string }): Promise<TaskListItem[]>;
}
