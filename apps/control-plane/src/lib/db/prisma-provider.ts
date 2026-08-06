import { randomUUID } from "node:crypto";

import {
  integrationConnectionActivationSchema,
  integrationCapabilitiesSchema,
  projectCreateSchema,
  projectUpdateSchema,
  taskCreateRequestSchema,
  type IntegrationCapabilities,
  type IntegrationConnection,
  type IntegrationConnectionActivation,
  type IntegrationConnectionStatus,
  type IntegrationCredentialState,
  type Project,
  type ProjectCreate,
  type ProjectUpdate,
  type TaskCreateRequest,
  type TaskListItem,
  type TaskRecord,
} from "@mystra/shared";

import type { MystraPrismaClient, MystraPrismaDelegates } from "./prisma-client";
import { normalizeDatabaseError, RdbError } from "./prisma-errors";
import {
  mapIntegrationConnectionRecord,
  mapProject,
  mapPublicIntegrationConnection,
  mapTask,
  serializeJson,
} from "./prisma-mappers";
import type {
  IntegrationConnectionRecord,
  IntegrationConnectionUpsert,
  IssueDispatchResult,
  RdbProvider,
} from "./rdb-provider";

type PrismaRdbProviderOptions = {
  now?: () => string;
  newId?: () => string;
};

export class PrismaRdbProvider implements RdbProvider {
  readonly #client: MystraPrismaClient;
  readonly #now: () => string;
  readonly #newId: () => string;

  constructor(client: MystraPrismaClient, options: PrismaRdbProviderOptions = {}) {
    this.#client = client;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#newId = options.newId ?? randomUUID;
  }

  async close(): Promise<void> {
    await this.#client.disconnect();
  }

  async activateIntegrationConnection(
    input: IntegrationConnectionActivation,
  ): Promise<IntegrationConnection> {
    const parsed = integrationConnectionActivationSchema.parse(input);
    const record = await this.upsertIntegrationConnection({
      ...parsed,
      credentialState: parsed.credentialState,
      status: "active",
    });
    return integrationConnectionWithoutCredential(record);
  }

  async upsertIntegrationConnection(
    input: IntegrationConnectionUpsert,
  ): Promise<IntegrationConnectionRecord> {
    const timestamp = this.#now();
    const data = connectionWriteData(input, timestamp);
    try {
      const row = await this.#client.integrationConnection.upsert({
        where: {
          integration_provider_providerExternalId: {
            integration: input.integration,
            provider: input.provider,
            providerExternalId: input.providerExternalId,
          },
        },
        create: { id: input.id ?? this.#newId(), createdAt: timestamp, ...data },
        update: data,
      });
      return mapIntegrationConnectionRecord(row);
    } catch (error) {
      throw normalizeDatabaseError(error, {
        conflictCode: "INTEGRATION_CONNECTION_CONFLICT",
        conflictMessage: "Integration connection identity already exists",
      });
    }
  }

  async replaceIntegrationConnection(
    id: string,
    input: IntegrationConnectionUpsert,
  ): Promise<IntegrationConnectionRecord | undefined> {
    try {
      const result = await this.#client.integrationConnection.updateMany({
        where: { id },
        data: connectionWriteData(input, this.#now()),
      });
      return result.count === 0 ? undefined : this.getIntegrationConnectionRecord(id);
    } catch (error) {
      throw normalizeDatabaseError(error, {
        conflictCode: "INTEGRATION_CONNECTION_CONFLICT",
        conflictMessage: "Integration connection identity already exists",
      });
    }
  }

  async getIntegrationConnection(id: string): Promise<IntegrationConnection | undefined> {
    const row = await this.#client.integrationConnection.findUnique({ where: { id } });
    return row ? mapPublicIntegrationConnection(row) : undefined;
  }

  async getIntegrationConnectionRecord(id: string): Promise<IntegrationConnectionRecord | undefined> {
    const row = await this.#client.integrationConnection.findUnique({ where: { id } });
    return row ? mapIntegrationConnectionRecord(row) : undefined;
  }

  async listIntegrationConnections(
    options: { integration?: string } = {},
  ): Promise<IntegrationConnection[]> {
    const rows = await this.#client.integrationConnection.findMany({
      ...(options.integration ? { where: { integration: options.integration } } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(mapPublicIntegrationConnection);
  }

  async listIntegrationConnectionRecords(
    options: { integration?: string } = {},
  ): Promise<IntegrationConnectionRecord[]> {
    const rows = await this.#client.integrationConnection.findMany({
      ...(options.integration ? { where: { integration: options.integration } } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(mapIntegrationConnectionRecord);
  }

  async updateIntegrationConnectionDisplayName(
    id: string,
    displayName: string | null,
  ): Promise<IntegrationConnectionRecord | undefined> {
    const result = await this.#client.integrationConnection.updateMany({
      where: { id },
      data: { displayName, updatedAt: this.#now() },
    });
    return result.count === 0 ? undefined : this.getIntegrationConnectionRecord(id);
  }

  async replaceIntegrationConnectionCapabilities(
    id: string,
    capabilities: IntegrationCapabilities,
  ): Promise<IntegrationConnectionRecord | undefined> {
    const parsed = integrationCapabilitiesSchema.parse(capabilities);
    const result = await this.#client.integrationConnection.updateMany({
      where: { id },
      data: { capabilities: serializeJson(parsed), updatedAt: this.#now() },
    });
    return result.count === 0 ? undefined : this.getIntegrationConnectionRecord(id);
  }

  async setIntegrationConnectionStatus(
    id: string,
    status: IntegrationConnectionStatus,
    credentialState?: IntegrationCredentialState,
  ): Promise<IntegrationConnectionRecord | undefined> {
    const result = await this.#client.integrationConnection.updateMany({
      where: { id },
      data: {
        status,
        ...(credentialState ? { credentialState } : {}),
        updatedAt: this.#now(),
      },
    });
    return result.count === 0 ? undefined : this.getIntegrationConnectionRecord(id);
  }

  async deleteIntegrationConnection(id: string): Promise<boolean> {
    try {
      const result = await this.#client.integrationConnection.deleteMany({ where: { id } });
      return result.count > 0;
    } catch (error) {
      throw normalizeDatabaseError(error, {
        relationCode: "INTEGRATION_CONNECTION_IN_USE",
        relationMessage: "Integration connection is still used by Projects",
      });
    }
  }

  async listProjectsForIntegrationConnection(id: string): Promise<Project[]> {
    const rows = await this.#client.project.findMany({
      where: { repositoryConnectionId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(mapProject);
  }

  async createProject(input: ProjectCreate): Promise<Project> {
    const parsed = projectCreateSchema.parse(input);
    const timestamp = this.#now();
    try {
      const row = await this.#client.transaction(async (transaction) => {
        await this.#requireUsableRepositoryConnection(parsed.repositoryConnectionId, transaction);
        return transaction.project.create({
          data: {
            id: this.#newId(),
            ...parsed,
            metadata: serializeJson(parsed.metadata),
            archivedAt: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });
      });
      return mapProject(row);
    } catch (error) {
      throw normalizeDatabaseError(error, {
        conflictCode: "PROJECT_SLUG_CONFLICT",
        conflictMessage: "Project slug already exists",
      });
    }
  }

  async listProjects(options: { includeArchived?: boolean } = {}): Promise<Project[]> {
    const rows = await this.#client.project.findMany({
      ...(options.includeArchived ? {} : { where: { archivedAt: null } }),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(mapProject);
  }

  async getProjectById(id: string): Promise<Project | undefined> {
    const row = await this.#client.project.findUnique({ where: { id } });
    return row ? mapProject(row) : undefined;
  }

  async getProjectBySlug(slug: string): Promise<Project | undefined> {
    const row = await this.#client.project.findUnique({ where: { slug } });
    return row ? mapProject(row) : undefined;
  }

  async updateProject(slug: string, input: ProjectUpdate): Promise<Project | undefined> {
    const parsed = projectUpdateSchema.parse(input);
    try {
      const result = await this.#client.project.updateMany({
        where: { slug },
        data: {
          ...(parsed.name !== undefined ? { name: parsed.name } : {}),
          ...(parsed.slug !== undefined ? { slug: parsed.slug } : {}),
          ...(parsed.repositoryBaseBranch !== undefined
            ? { repositoryBaseBranch: parsed.repositoryBaseBranch }
            : {}),
          ...(parsed.metadata ? { metadata: serializeJson(parsed.metadata) } : {}),
          ...(parsed.archivedAt !== undefined ? { archivedAt: parsed.archivedAt } : {}),
          updatedAt: this.#now(),
        },
      });
      if (result.count === 0) {
        return undefined;
      }
      return this.getProjectBySlug(parsed.slug ?? slug);
    } catch (error) {
      throw normalizeDatabaseError(error, {
        conflictCode: "PROJECT_SLUG_CONFLICT",
        conflictMessage: "Project slug already exists",
      });
    }
  }

  async archiveProject(slug: string): Promise<Project | undefined> {
    return this.updateProject(slug, { archivedAt: this.#now() });
  }

  async createTask(input: TaskCreateRequest): Promise<TaskRecord> {
    const parsed = taskCreateRequestSchema.parse(input);
    return this.#client.transaction(async (transaction) => {
      await this.#requireActiveProject(parsed.projectId, transaction);
      return this.#insertTask(parsed, transaction);
    });
  }

  async dispatchIssue(
    input: TaskCreateRequest & { issueDispatchKey: string },
  ): Promise<IssueDispatchResult> {
    const parsed = taskCreateRequestSchema.parse(input);
    const existing = await this.getTaskByIssueDispatchKey(input.issueDispatchKey);
    if (existing) {
      if (existing.projectId !== parsed.projectId) {
        throw new RdbError("DISPATCH_CONFLICT", "Issue dispatch key belongs to another Project");
      }
      return { task: existing, created: false };
    }
    try {
      const task = await this.#client.transaction(async (transaction) => {
        await this.#requireActiveProject(parsed.projectId, transaction);
        return this.#insertTask(parsed, transaction);
      });
      return { task, created: true };
    } catch (error) {
      if (!(error instanceof RdbError) || error.code !== "DISPATCH_CONFLICT") {
        throw error;
      }
      const existing = await this.getTaskByIssueDispatchKey(input.issueDispatchKey);
      if (!existing || existing.projectId !== parsed.projectId) {
        throw error;
      }
      return { task: existing, created: false };
    }
  }

  async getTask(id: string): Promise<TaskRecord | undefined> {
    const row = await this.#client.task.findUnique({ where: { id } });
    return row ? mapTask(row) : undefined;
  }

  async getTaskByIssueDispatchKey(issueDispatchKey: string): Promise<TaskRecord | undefined> {
    const row = await this.#client.task.findUnique({ where: { issueDispatchKey } });
    return row ? mapTask(row) : undefined;
  }

  async listTasks(options: { projectId?: string } = {}): Promise<TaskListItem[]> {
    const rows = await this.#client.task.findMany({
      ...(options.projectId ? { where: { projectId: options.projectId } } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(mapTask);
  }

  async #insertTask(
    input: TaskCreateRequest,
    client: MystraPrismaDelegates = this.#client,
  ): Promise<TaskRecord> {
    const timestamp = this.#now();
    try {
      const row = await client.task.create({
        data: {
          id: this.#newId(),
          projectId: input.projectId,
          issueDispatchKey: input.issueDispatchKey ?? null,
          metadata: serializeJson(input.metadata ?? {}),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      });
      return mapTask(row);
    } catch (error) {
      throw normalizeDatabaseError(error, {
        conflictCode: "DISPATCH_CONFLICT",
        conflictMessage: "Issue dispatch key already exists",
      });
    }
  }

  async #requireUsableRepositoryConnection(
    id: string,
    client: MystraPrismaDelegates = this.#client,
  ): Promise<IntegrationConnectionRecord> {
    const row = await client.integrationConnection.findUnique({ where: { id } });
    if (!row) {
      throw new RdbError("RDB_RELATION_CONFLICT", "Repository connection does not exist");
    }
    const connection = mapIntegrationConnectionRecord(row);
    if (
      connection.status !== "active"
      || connection.credentialState !== "ready"
      || connection.capabilities.repositories?.state !== "enabled"
    ) {
      throw new RdbError("RDB_RELATION_CONFLICT", "Repository connection is not usable");
    }
    return connection;
  }

  async #requireActiveProject(
    id: string,
    client: MystraPrismaDelegates = this.#client,
  ): Promise<Project> {
    const row = await client.project.findUnique({ where: { id } });
    if (!row) {
      throw new RdbError("RDB_RELATION_CONFLICT", "Project does not exist");
    }
    const project = mapProject(row);
    if (project.archivedAt) {
      throw new RdbError("RDB_RELATION_CONFLICT", "Project is archived");
    }
    return project;
  }
}

function connectionWriteData(input: IntegrationConnectionUpsert, updatedAt: string) {
  return {
    integration: input.integration,
    provider: input.provider,
    authMethod: input.authMethod,
    providerExternalId: input.providerExternalId,
    displayName: input.displayName ?? null,
    providerSubject: serializeJson(input.providerSubject),
    connectionConfig: serializeJson(input.connectionConfig ?? {}),
    capabilities: serializeJson(integrationCapabilitiesSchema.parse(input.capabilities ?? {})),
    credentialRef: input.credentialRef ?? null,
    credentialState: input.credentialState,
    status: input.status ?? "active",
    updatedAt,
  };
}

function integrationConnectionWithoutCredential(
  record: IntegrationConnectionRecord,
): IntegrationConnection {
  const { credentialRef: _credentialRef, ...connection } = record;
  return connection;
}
