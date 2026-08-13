import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient as PostgresqlPrismaClient,
} from "../../generated/prisma/postgresql/client";
import {
  PrismaClient as SqlitePrismaClient,
  type Agent,
  type AuthAccount,
  type AuthSession,
  type IntegrationConnection,
  type Project,
  type ProjectIssueSource,
  type Runtime,
  type RuntimeProvider,
  type SecretEnvelope,
  type Session as PrismaSession,
  type SessionDispatchLease,
  type SessionEvent,
  type SessionEventHead,
  type SessionEventStream,
  type Task,
  type Team,
  type TeamMembership,
  type TaskWorkspace,
  type User,
  type WorkspacePreparationAttempt,
  type Harness,
  type TaskStatusTransition,
} from "../../generated/prisma/sqlite/client";
import { isDatabaseErrorCode, normalizeDatabaseError, RdbError } from "./prisma-errors";

type CountResult = { count: number };
type SortOrder = "asc" | "desc";
type OrderBy = Array<{ createdAt: SortOrder } | { id: SortOrder }>;
type ConnectionMutable = Omit<IntegrationConnection, "id" | "createdAt">;
type ConnectionUpdate = Partial<ConnectionMutable>;
type ProjectUpdate = Partial<Pick<Project, "name" | "slug" | "repositoryBaseBranch" | "metadata" | "archivedAt" | "updatedAt">>;
type ProjectIssueSourceUpdate = Pick<ProjectIssueSource, "teamId" | "connectionId" | "scopeType" | "scopeExternalId" | "updatedAt">;
type TeamUpdate = Partial<Pick<Team, "displayName" | "status" | "archivedAt" | "updatedAt">>;
type MembershipUpdate = Partial<Pick<TeamMembership, "role" | "status" | "updatedAt">>;
type AuthSessionUpdate = Partial<Pick<AuthSession, "activeTeamId" | "updatedAt">>;
type DomainSessionUpdate = Partial<Pick<PrismaSession,
  "state" | "activeMessageId" | "lastMessageId" | "interruptKind" | "continuationMode" | "failureCode" | "updatedAt"
>>;
type UserUpdate = Partial<Pick<User, "displayName" | "status" | "requirePasswordChange" | "updatedAt">>;
type AuthAccountUpdate = Partial<Pick<AuthAccount, "passwordHash" | "passwordSalt" | "passwordParams" | "updatedAt">>;
type RuntimeUpdate = Partial<Pick<Runtime, "name" | "type" | "metadata" | "updatedAt">>;
type AgentUpdate = Partial<Pick<Agent, "name" | "systemPrompt" | "revision" | "status" | "archivedAt" | "updatedAt">>;
type TaskUpdate = Partial<Pick<Task,
  "title" | "description" | "productionStatus" | "statusRevision" | "statusNote" | "statusUpdatedAt" | "statusActor" | "updatedAt"
>>;
type HarnessUpdate = Partial<Pick<Harness,
  "workspaceId" | "sessionId" | "capabilityRevokedAt" | "setupFailureCode" | "setupFailureMessage" | "updatedAt"
>>;
type TaskWorkspaceUpdate = Partial<Pick<
  TaskWorkspace,
  | "state"
  | "workspaceRef"
  | "activeAttemptSequence"
  | "failureCode"
  | "failureMessage"
  | "updatedAt"
  | "readyAt"
>>;
type WorkspacePreparationAttemptUpdate = Partial<Pick<
  WorkspacePreparationAttempt,
  "state" | "runnerId" | "leaseExpiresAt" | "claimedAt" | "completedAt" | "failureCode"
>>;
type TaskWhere = {
  id?: string;
  teamId?: string;
  projectId?: string;
  idempotencyKey?: string;
  issueProvider?: string;
  issueConnectionId?: string;
  issueScopeExternalId?: string;
  issueExternalId?: string | { in: string[] };
  productionStatus?: string;
  statusRevision?: number;
};

export interface MystraPrismaDelegates {
  integrationConnection: {
    upsert(args: {
      where: { teamId_integration_provider_providerExternalId: Pick<IntegrationConnection, "teamId" | "integration" | "provider" | "providerExternalId"> };
      create: IntegrationConnection;
      update: ConnectionMutable;
    }): Promise<IntegrationConnection>;
    updateMany(args: { where: { id: string; credentialRef?: string }; data: ConnectionUpdate }): Promise<CountResult>;
    findUnique(args: {
      where:
        | { id: string }
        | { teamId_integration_provider_providerExternalId: Pick<IntegrationConnection, "teamId" | "integration" | "provider" | "providerExternalId"> };
    }): Promise<IntegrationConnection | null>;
    findMany(args: { where?: { integration?: string; teamId?: string }; orderBy: OrderBy }): Promise<IntegrationConnection[]>;
    deleteMany(args: { where: { id: string } }): Promise<CountResult>;
  };
  project: {
    create(args: { data: Project }): Promise<Project>;
    updateMany(args: { where: { slug: string }; data: ProjectUpdate }): Promise<CountResult>;
    findUnique(args: { where: { id: string } | { slug: string } }): Promise<Project | null>;
    findMany(args: {
      where?: { archivedAt?: null; repositoryConnectionId?: string; teamId?: string };
      orderBy: OrderBy;
    }): Promise<Project[]>;
  };
  projectIssueSource: {
    upsert(args: {
      where: { projectId_integration: Pick<ProjectIssueSource, "projectId" | "integration"> };
      create: ProjectIssueSource;
      update: ProjectIssueSourceUpdate;
    }): Promise<ProjectIssueSource>;
    findUnique(args: { where: { projectId_integration: Pick<ProjectIssueSource, "projectId" | "integration"> } }): Promise<ProjectIssueSource | null>;
    findMany(args: { where: { connectionId: string; teamId?: string }; orderBy: OrderBy }): Promise<ProjectIssueSource[]>;
    deleteMany(args: { where: { projectId: string; integration: string; teamId?: string } }): Promise<CountResult>;
  };
  task: {
    create(args: { data: Task }): Promise<Task>;
    updateMany(args: { where: TaskWhere & { id: string }; data: TaskUpdate }): Promise<CountResult>;
    findUnique(args: { where: { id: string } }): Promise<Task | null>;
    findMany(args: { where?: TaskWhere; orderBy: OrderBy }): Promise<Task[]>;
  };
  session: {
    create(args: { data: PrismaSession }): Promise<PrismaSession>;
    updateMany(args: { where: { id: string; teamId?: string; state?: string }; data: DomainSessionUpdate }): Promise<CountResult>;
    findUnique(args: { where: { id: string } }): Promise<PrismaSession | null>;
    findMany(args: {
      where?: { teamId?: string; taskId?: string; runtimeId?: string; state?: string | { in: string[] } };
      orderBy: Array<{ updatedAt: SortOrder } | { id: SortOrder }>;
      take?: number;
      cursor?: { id: string };
      skip?: number;
    }): Promise<PrismaSession[]>;
  };
  sessionEvent: {
    create(args: { data: SessionEvent }): Promise<SessionEvent>;
    findUnique(args: { where: { eventId: string } }): Promise<SessionEvent | null>;
    findMany(args: {
      where: { sessionId: string; globalSequence?: { gt?: number; lt?: number }; messageId?: string };
      orderBy: Array<{ globalSequence: SortOrder }>;
      take?: number;
    }): Promise<SessionEvent[]>;
  };
  sessionEventHead: {
    create(args: { data: SessionEventHead }): Promise<SessionEventHead>;
    updateMany(args: { where: { sessionId: string; lastGlobalSequence: number }; data: { lastGlobalSequence: number } }): Promise<CountResult>;
    findUnique(args: { where: { sessionId: string } }): Promise<SessionEventHead | null>;
  };
  sessionEventStream: {
    create(args: { data: SessionEventStream }): Promise<SessionEventStream>;
    updateMany(args: { where: { sessionId: string; sourceId: string; lastSourceSequence: number }; data: { lastSourceSequence: number } }): Promise<CountResult>;
    findUnique(args: { where: { sessionId_sourceId: { sessionId: string; sourceId: string } } }): Promise<SessionEventStream | null>;
  };
  sessionDispatchLease: {
    create(args: { data: SessionDispatchLease }): Promise<SessionDispatchLease>;
    updateMany(args: { where: { sessionId: string; tokenHash?: string }; data: Partial<Pick<SessionDispatchLease, "providerSessionId" | "leaseExpiresAt" | "updatedAt" | "tokenHash" | "runnerId" | "executionCodeHash" | "executionCodeExpiresAt">> }): Promise<CountResult>;
    findUnique(args: { where: { id: string } | { sessionId: string } | { executionCodeHash: string } }): Promise<SessionDispatchLease | null>;
    findMany(args: { where: { leaseExpiresAt: { lt: string } }; orderBy: Array<{ leaseExpiresAt: SortOrder }>; include: { session: true } }): Promise<Array<SessionDispatchLease & { session: PrismaSession }>>;
    deleteMany(args: { where: { sessionId: string } }): Promise<CountResult>;
  };
  harness: {
    create(args: { data: Harness }): Promise<Harness>;
    updateMany(args: { where: { id: string; teamId?: string }; data: HarnessUpdate }): Promise<CountResult>;
    findUnique(args: { where: { id: string } | { taskId: string } | { sessionId: string } | { plannedSessionId: string } }): Promise<Harness | null>;
  };
  taskStatusTransition: {
    create(args: { data: TaskStatusTransition }): Promise<TaskStatusTransition>;
    findUnique(args: { where: { id: string } | { taskId_idempotencyKey: Pick<TaskStatusTransition, "taskId" | "idempotencyKey"> } }): Promise<TaskStatusTransition | null>;
    findMany(args: { where: { taskId: string; teamId?: string }; orderBy: Array<{ revision: SortOrder }>; take?: number }): Promise<TaskStatusTransition[]>;
  };
  taskWorkspace: {
    create(args: { data: TaskWorkspace }): Promise<TaskWorkspace>;
    updateMany(args: {
      where: { id?: string; teamId?: string; runtimeId?: string; state?: string; activeAttemptSequence?: number };
      data: TaskWorkspaceUpdate;
    }): Promise<CountResult>;
    findUnique(args: { where: { id: string } | { taskId: string } }): Promise<TaskWorkspace | null>;
    findMany(args: {
      where?: { teamId?: string; runtimeId?: string; state?: string };
      orderBy: OrderBy;
    }): Promise<TaskWorkspace[]>;
  };
  workspacePreparationAttempt: {
    create(args: { data: WorkspacePreparationAttempt }): Promise<WorkspacePreparationAttempt>;
    updateMany(args: {
      where: { id?: string; workspaceId?: string; sequence?: number; state?: string; runnerId?: string };
      data: WorkspacePreparationAttemptUpdate;
    }): Promise<CountResult>;
    findUnique(args: {
      where:
        | { id: string }
        | { workspaceId_sequence: Pick<WorkspacePreparationAttempt, "workspaceId" | "sequence"> };
    }): Promise<WorkspacePreparationAttempt | null>;
    findMany(args: {
      where?: { workspaceId?: string; state?: string };
      orderBy: OrderBy;
    }): Promise<WorkspacePreparationAttempt[]>;
  };
  agent: {
    create(args: { data: Agent }): Promise<Agent>;
    updateMany(args: {
      where: { id: string; teamId?: string; revision?: number; status?: string };
      data: AgentUpdate;
    }): Promise<CountResult>;
    findUnique(args: { where: { id: string } }): Promise<Agent | null>;
    findMany(args: {
      where: { teamId: string; status?: string };
      orderBy: Array<{ id: SortOrder }>;
      take: number;
      cursor?: { id: string };
      skip?: number;
    }): Promise<Agent[]>;
  };
  runtime: {
    create(args: { data: Runtime }): Promise<Runtime>;
    updateMany(args: { where: { id: string }; data: RuntimeUpdate }): Promise<CountResult>;
    findUnique(args: { where: { id: string } }): Promise<Runtime | null>;
    findMany(args: {
      where?: { type?: string };
      orderBy: Array<{ updatedAt: SortOrder } | { id: SortOrder }>;
    }): Promise<Runtime[]>;
  };
  runtimeProvider: {
    create(args: { data: RuntimeProvider }): Promise<RuntimeProvider>;
    deleteMany(args: { where: { runtimeId: string } }): Promise<CountResult>;
    findMany(args: {
      where: { runtimeId: string };
      orderBy: Array<{ provider: SortOrder }>;
    }): Promise<RuntimeProvider[]>;
  };
  secretEnvelope: {
    create(args: { data: SecretEnvelope }): Promise<SecretEnvelope>;
    findUnique(args: { where: { reference: string } }): Promise<SecretEnvelope | null>;
    deleteMany(args: { where: { reference: string } }): Promise<CountResult>;
  };
  user: {
    create(args: { data: User }): Promise<User>;
    updateMany(args: { where: { id: string }; data: UserUpdate }): Promise<CountResult>;
    findUnique(args: { where: { id: string } | { username: string } }): Promise<User | null>;
    findMany(args: { where?: { status?: string }; take?: number }): Promise<User[]>;
  };
  authAccount: {
    create(args: { data: AuthAccount }): Promise<AuthAccount>;
    updateMany(args: { where: { userId: string }; data: AuthAccountUpdate }): Promise<CountResult>;
    findUnique(args: { where: { id: string } | { userId: string } }): Promise<AuthAccount | null>;
  };
  authSession: {
    create(args: { data: AuthSession }): Promise<AuthSession>;
    updateMany(args: { where: { id: string }; data: AuthSessionUpdate }): Promise<CountResult>;
    findUnique(args: { where: { id: string } | { tokenHash: string } }): Promise<AuthSession | null>;
    findMany(args: { where?: { userId?: string }; orderBy: OrderBy }): Promise<AuthSession[]>;
    deleteMany(args: { where: { id: string } }): Promise<CountResult>;
  };
  team: {
    create(args: { data: Team }): Promise<Team>;
    updateMany(args: { where: { id: string }; data: TeamUpdate }): Promise<CountResult>;
    findUnique(args: { where: { id: string } }): Promise<Team | null>;
    findMany(args: { where?: { status?: string }; orderBy: OrderBy }): Promise<Team[]>;
  };
  teamMembership: {
    create(args: { data: TeamMembership }): Promise<TeamMembership>;
    updateMany(args: {
      where: { id?: string; teamId?: string; userId?: string };
      data: MembershipUpdate;
    }): Promise<CountResult>;
    findUnique(args: {
      where: { id: string } | { teamId_userId: Pick<TeamMembership, "teamId" | "userId"> };
    }): Promise<TeamMembership | null>;
    findMany(args: {
      where?: { teamId?: string; userId?: string; role?: string; status?: string };
      orderBy: OrderBy;
    }): Promise<TeamMembership[]>;
    count(args: { where: { teamId?: string; userId?: string; role?: string; status?: string } }): Promise<number>;
  };
}

export interface MystraPrismaClient extends MystraPrismaDelegates {
  transaction<T>(operation: (transaction: MystraPrismaDelegates) => Promise<T>): Promise<T>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export function createSqlitePrismaClient(input: {
  databaseUrl: string;
}): MystraPrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: input.databaseUrl });
  return wrapPrismaClient(new SqlitePrismaClient({ adapter }));
}

export function createPostgresqlPrismaClient(input: {
  databaseUrl: string;
  maxConnections: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
}): MystraPrismaClient {
  const adapter = new PrismaPg({
    connectionString: input.databaseUrl,
    max: input.maxConnections,
    connectionTimeoutMillis: input.connectionTimeoutMs,
    idleTimeoutMillis: input.idleTimeoutMs,
  });
  return wrapPrismaClient(new PostgresqlPrismaClient({ adapter }));
}

/**
 * Minimal structural view of a generated Prisma client (or an interactive
 * transaction handle) that this module drives. Both the root client and the
 * `$transaction` argument satisfy it, so delegate protection is defined once.
 */
type RawPrismaSource = MystraPrismaDelegates & {
  $transaction<T>(
    operation: (transaction: MystraPrismaDelegates) => Promise<T>,
    options: { isolationLevel: "Serializable" },
  ): Promise<T>;
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
};

function wrapPrismaClient(client: RawPrismaSource): MystraPrismaClient {
  return {
    ...protectDelegates(client),
    transaction: (operation) => safeClientOperation(() => client.$transaction(
      (transaction) => operation(protectDelegates(transaction)),
      { isolationLevel: "Serializable" },
    )),
    connect: () => safeClientOperation(() => client.$connect()),
    disconnect: () => client.$disconnect(),
  };
}

const modelMethods = {
  integrationConnection: ["upsert", "updateMany", "findUnique", "findMany", "deleteMany"],
  project: ["create", "updateMany", "findUnique", "findMany"],
  projectIssueSource: ["upsert", "findUnique", "findMany", "deleteMany"],
  task: ["create", "updateMany", "findUnique", "findMany"],
  session: ["create", "updateMany", "findUnique", "findMany"],
  sessionEvent: ["create", "findUnique", "findMany"],
  sessionEventHead: ["create", "updateMany", "findUnique"],
  sessionEventStream: ["create", "updateMany", "findUnique"],
  sessionDispatchLease: ["create", "updateMany", "findUnique", "findMany", "deleteMany"],
  harness: ["create", "updateMany", "findUnique"],
  taskStatusTransition: ["create", "findUnique", "findMany"],
  taskWorkspace: ["create", "updateMany", "findUnique", "findMany"],
  workspacePreparationAttempt: ["create", "updateMany", "findUnique", "findMany"],
  agent: ["create", "updateMany", "findUnique", "findMany"],
  runtime: ["create", "updateMany", "findUnique", "findMany"],
  runtimeProvider: ["create", "deleteMany", "findMany"],
  secretEnvelope: ["create", "findUnique", "deleteMany"],
  user: ["create", "updateMany", "findUnique", "findMany"],
  authAccount: ["create", "updateMany", "findUnique"],
  authSession: ["create", "updateMany", "findUnique", "findMany", "deleteMany"],
  team: ["create", "updateMany", "findUnique", "findMany"],
  teamMembership: ["create", "updateMany", "findUnique", "findMany", "count"],
} as const;

function protectDelegates(source: MystraPrismaDelegates): MystraPrismaDelegates {
  const protectedDelegates = {} as Record<string, Record<string, (args: unknown) => Promise<unknown>>>;
  for (const [model, methods] of Object.entries(modelMethods)) {
    const delegate = source[model as keyof MystraPrismaDelegates] as Record<
      string,
      (args: unknown) => Promise<unknown>
    >;
    const wrapped: Record<string, (args: unknown) => Promise<unknown>> = {};
    for (const method of methods) {
      wrapped[method] = (args) => safeClientOperation(() => delegate[method]!(args));
    }
    protectedDelegates[model] = wrapped;
  }
  return protectedDelegates as unknown as MystraPrismaDelegates;
}

async function safeClientOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof RdbError
      || ["P2002", "P2003", "P2014", "P2025", "P2034"].some((code) => isDatabaseErrorCode(error, code))
    ) {
      throw error;
    }
    throw normalizeDatabaseError(error);
  }
}
