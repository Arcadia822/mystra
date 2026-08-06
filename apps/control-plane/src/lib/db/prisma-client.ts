import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient as PostgresqlPrismaClient,
} from "../../generated/prisma/postgresql/client";
import {
  PrismaClient as SqlitePrismaClient,
  type IntegrationConnection,
  type Project,
  type Task,
} from "../../generated/prisma/sqlite/client";

type CountResult = { count: number };
type SortOrder = "asc" | "desc";
type OrderBy = Array<{ createdAt: SortOrder } | { id: SortOrder }>;
type ConnectionMutable = Omit<IntegrationConnection, "id" | "createdAt">;
type ConnectionUpdate = Partial<ConnectionMutable>;
type ProjectUpdate = Partial<Pick<Project, "name" | "slug" | "repositoryBaseBranch" | "metadata" | "archivedAt" | "updatedAt">>;

export interface MystraPrismaDelegates {
  integrationConnection: {
    upsert(args: {
      where: { integration_provider_providerExternalId: Pick<IntegrationConnection, "integration" | "provider" | "providerExternalId"> };
      create: IntegrationConnection;
      update: ConnectionMutable;
    }): Promise<IntegrationConnection>;
    updateMany(args: { where: { id: string }; data: ConnectionUpdate }): Promise<CountResult>;
    findUnique(args: { where: { id: string } }): Promise<IntegrationConnection | null>;
    findMany(args: { where?: { integration: string }; orderBy: OrderBy }): Promise<IntegrationConnection[]>;
    deleteMany(args: { where: { id: string } }): Promise<CountResult>;
  };
  project: {
    create(args: { data: Project }): Promise<Project>;
    updateMany(args: { where: { slug: string }; data: ProjectUpdate }): Promise<CountResult>;
    findUnique(args: { where: { id: string } | { slug: string } }): Promise<Project | null>;
    findMany(args: {
      where?: { archivedAt: null } | { repositoryConnectionId: string };
      orderBy: OrderBy;
    }): Promise<Project[]>;
  };
  task: {
    create(args: { data: Task }): Promise<Task>;
    findUnique(args: { where: { id: string } | { issueDispatchKey: string } }): Promise<Task | null>;
    findMany(args: { where?: { projectId: string }; orderBy: OrderBy }): Promise<Task[]>;
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
  const client = new SqlitePrismaClient({ adapter });
  return {
    integrationConnection: {
      upsert: async (args) => client.integrationConnection.upsert(args),
      updateMany: async (args) => client.integrationConnection.updateMany(args),
      findUnique: async (args) => client.integrationConnection.findUnique(args),
      findMany: async (args) => client.integrationConnection.findMany(args),
      deleteMany: async (args) => client.integrationConnection.deleteMany(args),
    },
    project: {
      create: async (args) => client.project.create(args),
      updateMany: async (args) => client.project.updateMany(args),
      findUnique: async (args) => client.project.findUnique(args),
      findMany: async (args) => client.project.findMany(args),
    },
    task: {
      create: async (args) => client.task.create(args),
      findUnique: async (args) => client.task.findUnique(args),
      findMany: async (args) => client.task.findMany(args),
    },
    transaction: async (operation) => client.$transaction(async (transaction) => operation({
      integrationConnection: {
        upsert: async (args) => transaction.integrationConnection.upsert(args),
        updateMany: async (args) => transaction.integrationConnection.updateMany(args),
        findUnique: async (args) => transaction.integrationConnection.findUnique(args),
        findMany: async (args) => transaction.integrationConnection.findMany(args),
        deleteMany: async (args) => transaction.integrationConnection.deleteMany(args),
      },
      project: {
        create: async (args) => transaction.project.create(args),
        updateMany: async (args) => transaction.project.updateMany(args),
        findUnique: async (args) => transaction.project.findUnique(args),
        findMany: async (args) => transaction.project.findMany(args),
      },
      task: {
        create: async (args) => transaction.task.create(args),
        findUnique: async (args) => transaction.task.findUnique(args),
        findMany: async (args) => transaction.task.findMany(args),
      },
    }), { isolationLevel: "Serializable" }),
    connect: async () => client.$connect(),
    disconnect: async () => client.$disconnect(),
  };
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
  const client = new PostgresqlPrismaClient({ adapter });
  return {
    integrationConnection: {
      upsert: async (args) => client.integrationConnection.upsert(args),
      updateMany: async (args) => client.integrationConnection.updateMany(args),
      findUnique: async (args) => client.integrationConnection.findUnique(args),
      findMany: async (args) => client.integrationConnection.findMany(args),
      deleteMany: async (args) => client.integrationConnection.deleteMany(args),
    },
    project: {
      create: async (args) => client.project.create(args),
      updateMany: async (args) => client.project.updateMany(args),
      findUnique: async (args) => client.project.findUnique(args),
      findMany: async (args) => client.project.findMany(args),
    },
    task: {
      create: async (args) => client.task.create(args),
      findUnique: async (args) => client.task.findUnique(args),
      findMany: async (args) => client.task.findMany(args),
    },
    transaction: async (operation) => client.$transaction(async (transaction) => operation({
      integrationConnection: {
        upsert: async (args) => transaction.integrationConnection.upsert(args),
        updateMany: async (args) => transaction.integrationConnection.updateMany(args),
        findUnique: async (args) => transaction.integrationConnection.findUnique(args),
        findMany: async (args) => transaction.integrationConnection.findMany(args),
        deleteMany: async (args) => transaction.integrationConnection.deleteMany(args),
      },
      project: {
        create: async (args) => transaction.project.create(args),
        updateMany: async (args) => transaction.project.updateMany(args),
        findUnique: async (args) => transaction.project.findUnique(args),
        findMany: async (args) => transaction.project.findMany(args),
      },
      task: {
        create: async (args) => transaction.task.create(args),
        findUnique: async (args) => transaction.task.findUnique(args),
        findMany: async (args) => transaction.task.findMany(args),
      },
    }), { isolationLevel: "Serializable" }),
    connect: async () => client.$connect(),
    disconnect: async () => client.$disconnect(),
  };
}
