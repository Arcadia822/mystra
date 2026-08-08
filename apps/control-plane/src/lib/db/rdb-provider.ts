import type {
  Agent,
  AgentArchiveRequest,
  AgentCreate,
  AgentPage,
  AgentUpdateRequest,
  AccountStatus,
  AccountView,
  IntegrationCapabilities,
  IntegrationConnection,
  IntegrationConnectionActivation,
  IntegrationConnectionStatus,
  IntegrationCredentialState,
  HostRuntimeRegistration,
  MemberView,
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectIssueSource,
  TaskCreateRequest,
  TaskListItem,
  TaskRecord,
  TeamListItem,
  TeamRole,
  TeamStatus,
  ProviderCapability,
  RuntimeRename,
  RuntimeView,
  ResolvedAgentSnapshot,
  MembershipStatus,
} from "@mystra/shared";

export type IntegrationConnectionRecord = IntegrationConnection & {
  credentialRef?: string;
};

export type IntegrationConnectionUpsert = {
  id?: string;
  teamId?: string;
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

export type ProjectIssueSourceUpsert = Omit<ProjectIssueSource, "id" | "createdAt" | "updatedAt">;

export type UserRecord = AccountView & {
  displayUsername: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthAccountRecord = {
  id: string;
  userId: string;
  passwordHash: string;
  passwordSalt: string;
  passwordParams: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthSessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  activeTeamId?: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
};

export type TeamRecord = {
  id: string;
  displayName: string;
  status: TeamStatus;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type TeamMembershipRecord = {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
};

export type RegisterLocalUserInput = {
  username: string;
  displayUsername?: string;
  displayName?: string;
  status?: AccountStatus;
  requirePasswordChange?: boolean;
  passwordHash: string;
  passwordSalt: string;
  passwordParams: string;
  initialTeamDisplayName: string;
  tokenHash: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
};

export type ResolvedActiveTeam = {
  team: TeamRecord;
  role: TeamRole;
};

export type IssueDispatchResult = {
  task: TaskRecord;
  created: boolean;
};

export type RegisterHostRuntimeInput = HostRuntimeRegistration;

export type SecretEnvelopeWrite = {
  reference: string;
  version: 1;
  algorithm: "aes-256-gcm+aes-256-gcm-wrap";
  keyId: string;
  ciphertext: string;
  ciphertextIv: string;
  ciphertextAuthTag: string;
  wrappedDataKey: string;
  wrappedDataKeyIv: string;
  wrappedDataKeyAuthTag: string;
};

export type SecretEnvelopeRecord = SecretEnvelopeWrite & {
  createdAt: string;
};

/**
 * Domain-owned relational persistence boundary.
 *
 * Prisma clients, driver adapters, connection URLs, pools, and database error
 * types must never appear in this contract. The first Prisma phase deliberately
 * contains IntegrationConnection, Project, and Task business persistence plus
 * the internal encrypted-secret envelope required by feature 041.
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
  listIntegrationConnections(options?: { integration?: string; teamId?: string }): Promise<IntegrationConnection[]>;
  listIntegrationConnectionRecords(options?: { integration?: string; teamId?: string }): Promise<IntegrationConnectionRecord[]>;
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
  listProjectsForIntegrationConnection(id: string, options?: { teamId?: string }): Promise<Project[]>;
  upsertProjectIssueSource(input: ProjectIssueSourceUpsert): Promise<ProjectIssueSource>;
  getProjectIssueSource(projectId: string, integration: "linear", options?: { teamId?: string }): Promise<ProjectIssueSource | undefined>;
  listProjectIssueSourcesForConnection(id: string, options?: { teamId?: string }): Promise<ProjectIssueSource[]>;
  deleteProjectIssueSource(projectId: string, integration: "linear", options?: { teamId?: string }): Promise<boolean>;

  createSecretEnvelope(input: SecretEnvelopeWrite): Promise<void>;
  getSecretEnvelope(reference: string): Promise<SecretEnvelopeRecord | undefined>;
  deleteSecretEnvelope(reference: string): Promise<void>;
  upsertIntegrationConnectionWithSecret(
    input: IntegrationConnectionUpsert,
    envelope: SecretEnvelopeWrite,
    previousReference?: string,
  ): Promise<IntegrationConnectionRecord>;
  replaceIntegrationConnectionWithSecret(
    id: string,
    input: IntegrationConnectionUpsert,
    envelope: SecretEnvelopeWrite,
    previousReference: string,
  ): Promise<IntegrationConnectionRecord | undefined>;
  deleteIntegrationConnectionWithSecret(id: string, reference: string): Promise<boolean>;

  createProject(input: ProjectCreate): Promise<Project>;
  listProjects(options?: { includeArchived?: boolean; teamId?: string }): Promise<Project[]>;
  getProjectById(id: string, options?: { teamId?: string }): Promise<Project | undefined>;
  getProjectBySlug(slug: string, options?: { teamId?: string }): Promise<Project | undefined>;
  updateProject(slug: string, input: ProjectUpdate): Promise<Project | undefined>;
  archiveProject(slug: string): Promise<Project | undefined>;

  createTask(input: TaskCreateRequest): Promise<TaskRecord>;
  dispatchIssue(input: TaskCreateRequest & { issueDispatchKey: string }): Promise<IssueDispatchResult>;
  getTask(id: string, options?: { teamId?: string }): Promise<TaskRecord | undefined>;
  getTaskByIssueDispatchKey(issueDispatchKey: string, options?: { teamId?: string }): Promise<TaskRecord | undefined>;
  listTasks(options?: { projectId?: string; teamId?: string }): Promise<TaskListItem[]>;

  createAgent(input: AgentCreate): Promise<Agent>;
  getAgent(id: string, options: { teamId: string }): Promise<Agent | undefined>;
  listAgents(options: {
    teamId: string;
    limit?: number;
    cursor?: string;
    includeArchived?: boolean;
  }): Promise<AgentPage>;
  updateAgent(
    id: string,
    input: AgentUpdateRequest & { teamId: string },
  ): Promise<Agent | undefined>;
  archiveAgent(
    id: string,
    input: AgentArchiveRequest & { teamId: string },
  ): Promise<Agent | undefined>;
  resolveActiveAgent(
    id: string,
    options: { teamId: string },
  ): Promise<ResolvedAgentSnapshot | undefined>;

  registerHostRuntime(input: RegisterHostRuntimeInput): Promise<RuntimeView>;
  getRuntime(id: string): Promise<RuntimeView | undefined>;
  listRuntimes(): Promise<RuntimeView[]>;
  renameRuntime(id: string, input: RuntimeRename): Promise<RuntimeView | undefined>;
  reportHostProviders(runnerId: string, providers: ProviderCapability[]): Promise<RuntimeView | undefined>;

  registerLocalUser(input: RegisterLocalUserInput): Promise<{
    user: UserRecord;
    initialTeam: TeamRecord;
    ownerMembership: TeamMembershipRecord;
    session: AuthSessionRecord;
  }>;
  getUserById(userId: string): Promise<UserRecord | undefined>;
  getUserByUsername(username: string): Promise<UserRecord | undefined>;
  hasActiveLocalUser(): Promise<boolean>;
  getAuthAccountForUser(userId: string): Promise<AuthAccountRecord | undefined>;
  getAuthSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | undefined>;
  createAuthSession(input: Omit<AuthSessionRecord, "id" | "createdAt" | "updatedAt">): Promise<AuthSessionRecord>;
  deleteAuthSession(id: string): Promise<void>;
  listAuthSessionsForUser(userId: string): Promise<AuthSessionRecord[]>;
  deleteAuthSessionForUser(userId: string, sessionId: string): Promise<boolean>;
  updateUserDisplayName(userId: string, displayName: string): Promise<UserRecord | undefined>;
  replacePasswordCredentialAndRevokeOtherSessions(input: {
    userId: string;
    currentSessionId: string;
    passwordHash: string;
    passwordSalt: string;
    passwordParams: string;
  }): Promise<UserRecord | undefined>;
  deactivateLocalUser(userId: string): Promise<boolean>;

  createTeam(userId: string, displayName: string): Promise<{
    team: TeamRecord;
    ownerMembership: TeamMembershipRecord;
  }>;
  renameTeam(teamId: string, displayName: string): Promise<TeamRecord | undefined>;
  archiveTeam(teamId: string): Promise<TeamRecord | undefined>;
  listActiveTeamsForUser(userId: string): Promise<TeamListItem[]>;
  getTeamContext(userId: string, teamId: string): Promise<ResolvedActiveTeam | undefined>;
  setActiveTeam(sessionId: string, teamId: string): Promise<void>;
  resolveActiveTeam(sessionId: string): Promise<ResolvedActiveTeam | undefined>;
  listMembers(teamId: string): Promise<MemberView[]>;
  addMemberByUsername(teamId: string, username: string): Promise<TeamMembershipRecord>;
  setMemberRole(teamId: string, userId: string, role: TeamRole): Promise<TeamMembershipRecord | undefined>;
  removeMember(teamId: string, userId: string): Promise<boolean>;
  countActiveTeamsForUser(userId: string): Promise<number>;
  countActiveOwners(teamId: string): Promise<number>;
}
