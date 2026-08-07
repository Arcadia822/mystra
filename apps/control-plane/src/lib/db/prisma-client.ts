import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient as PostgresqlPrismaClient,
} from "../../generated/prisma/postgresql/client";
import {
  PrismaClient as SqlitePrismaClient,
  type AuthAccount,
  type AuthSession,
  type IntegrationConnection,
  type Project,
  type SecretEnvelope,
  type Task,
  type Team,
  type TeamMembership,
  type User,
} from "../../generated/prisma/sqlite/client";
import { isDatabaseErrorCode, normalizeDatabaseError, RdbError } from "./prisma-errors";

type CountResult = { count: number };
type SortOrder = "asc" | "desc";
type OrderBy = Array<{ createdAt: SortOrder } | { id: SortOrder }>;
type ConnectionMutable = Omit<IntegrationConnection, "id" | "createdAt">;
type ConnectionUpdate = Partial<ConnectionMutable>;
type ProjectUpdate = Partial<Pick<Project, "name" | "slug" | "repositoryBaseBranch" | "metadata" | "archivedAt" | "updatedAt">>;
type TeamUpdate = Partial<Pick<Team, "displayName" | "status" | "archivedAt" | "updatedAt">>;
type MembershipUpdate = Partial<Pick<TeamMembership, "role" | "status" | "updatedAt">>;
type SessionUpdate = Partial<Pick<AuthSession, "activeTeamId" | "updatedAt">>;
type UserUpdate = Partial<Pick<User, "displayName" | "status" | "requirePasswordChange" | "updatedAt">>;
type AuthAccountUpdate = Partial<Pick<AuthAccount, "passwordHash" | "passwordSalt" | "passwordParams" | "updatedAt">>;

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
  task: {
    create(args: { data: Task }): Promise<Task>;
    findUnique(args: { where: { id: string } | { issueDispatchKey: string } }): Promise<Task | null>;
    findMany(args: { where?: { projectId?: string; teamId?: string }; orderBy: OrderBy }): Promise<Task[]>;
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
    updateMany(args: { where: { id: string }; data: SessionUpdate }): Promise<CountResult>;
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
  task: ["create", "findUnique", "findMany"],
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
