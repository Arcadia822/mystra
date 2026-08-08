import { randomUUID } from "node:crypto";

import {
  integrationConnectionActivationSchema,
  integrationCapabilitiesSchema,
  hostProviderReportSchema,
  hostRuntimeMetadataSchema,
  hostRuntimeRegistrationSchema,
  projectCreateSchema,
  projectIssueSourceSchema,
  projectUpdateSchema,
  runtimeRenameSchema,
  taskCreateRequestSchema,
  type IntegrationCapabilities,
  type IntegrationConnection,
  type IntegrationConnectionActivation,
  type IntegrationConnectionStatus,
  type IntegrationCredentialState,
  type MemberView,
  type ProviderCapability,
  type Project,
  type ProjectIssueSource,
  type ProjectCreate,
  type ProjectUpdate,
  type RuntimeRename,
  type RuntimeView,
  type TaskCreateRequest,
  type TaskListItem,
  type TaskRecord,
  type TeamListItem,
  type TeamRole,
  normalizeUsername,
} from "@mystra/shared";
import type {
  Runtime as PrismaRuntime,
  RuntimeProvider as PrismaRuntimeProvider,
} from "../../generated/prisma/sqlite/client";

import type { MystraPrismaClient, MystraPrismaDelegates } from "./prisma-client";
import { isDatabaseErrorCode, normalizeDatabaseError, RdbError } from "./prisma-errors";
import {
  mapAuthAccount,
  mapAuthSession,
  mapHostRuntimeMetadata,
  mapIntegrationConnectionRecord,
  mapProviderCapability,
  mapProject,
  mapProjectIssueSource,
  mapPublicIntegrationConnection,
  mapRuntime,
  mapTask,
  mapTeam,
  mapTeamMembership,
  mapUser,
  serializeJson,
} from "./prisma-mappers";
import type {
  AuthAccountRecord,
  AuthSessionRecord,
  IntegrationConnectionRecord,
  IntegrationConnectionUpsert,
  ProjectIssueSourceUpsert,
  IssueDispatchResult,
  RegisterHostRuntimeInput,
  RdbProvider,
  SecretEnvelopeRecord,
  SecretEnvelopeWrite,
  RegisterLocalUserInput,
  ResolvedActiveTeam,
  TeamMembershipRecord,
  TeamRecord,
  UserRecord,
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
          teamId_integration_provider_providerExternalId: {
            teamId: requireTeamId(input.teamId),
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
    options: { integration?: string; teamId?: string } = {},
  ): Promise<IntegrationConnection[]> {
    const rows = await this.#client.integrationConnection.findMany({
      ...(options.integration || options.teamId
        ? { where: { ...(options.integration ? { integration: options.integration } : {}), ...(options.teamId ? { teamId: options.teamId } : {}) } }
        : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(mapPublicIntegrationConnection);
  }

  async listIntegrationConnectionRecords(
    options: { integration?: string; teamId?: string } = {},
  ): Promise<IntegrationConnectionRecord[]> {
    const rows = await this.#client.integrationConnection.findMany({
      ...(options.integration || options.teamId
        ? { where: { ...(options.integration ? { integration: options.integration } : {}), ...(options.teamId ? { teamId: options.teamId } : {}) } }
        : {}),
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

  async listProjectsForIntegrationConnection(
    id: string,
    options: { teamId?: string } = {},
  ): Promise<Project[]> {
    const rows = await this.#client.project.findMany({
      where: { repositoryConnectionId: id, ...(options.teamId ? { teamId: options.teamId } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(mapProject);
  }

  async upsertProjectIssueSource(input: ProjectIssueSourceUpsert): Promise<ProjectIssueSource> {
    const parsed = projectIssueSourceSchema.omit({ id: true, createdAt: true, updatedAt: true }).parse(input);
    const timestamp = this.#now();
    try {
      const row = await this.#client.transaction(async (transaction) => {
        const [project, connection] = await Promise.all([
          transaction.project.findUnique({ where: { id: parsed.projectId } }),
          transaction.integrationConnection.findUnique({ where: { id: parsed.connectionId } }),
        ]);
        if (!project || project.teamId !== parsed.teamId || project.archivedAt) {
          throw new RdbError("RDB_NOT_FOUND", "Active Project not found for Team");
        }
        if (
          !connection
          || connection.teamId !== parsed.teamId
          || connection.integration !== "linear"
          || connection.provider !== "linear"
          || connection.status !== "active"
        ) {
          throw new RdbError("RDB_RELATION_CONFLICT", "Usable Linear connection not found for Team");
        }
        return transaction.projectIssueSource.upsert({
          where: { projectId_integration: { projectId: parsed.projectId, integration: parsed.integration } },
          create: { id: this.#newId(), ...parsed, createdAt: timestamp, updatedAt: timestamp },
          update: {
            teamId: parsed.teamId,
            connectionId: parsed.connectionId,
            scopeType: parsed.scopeType,
            scopeExternalId: parsed.scopeExternalId,
            updatedAt: timestamp,
          },
        });
      });
      return mapProjectIssueSource(row);
    } catch (error) {
      throw normalizeDatabaseError(error);
    }
  }

  async getProjectIssueSource(
    projectId: string,
    integration: "linear",
    options: { teamId?: string } = {},
  ): Promise<ProjectIssueSource | undefined> {
    const row = await this.#client.projectIssueSource.findUnique({
      where: { projectId_integration: { projectId, integration } },
    });
    return row && (!options.teamId || row.teamId === options.teamId)
      ? mapProjectIssueSource(row)
      : undefined;
  }

  async listProjectIssueSourcesForConnection(
    id: string,
    options: { teamId?: string } = {},
  ): Promise<ProjectIssueSource[]> {
    const rows = await this.#client.projectIssueSource.findMany({
      where: { connectionId: id, ...(options.teamId ? { teamId: options.teamId } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(mapProjectIssueSource);
  }

  async deleteProjectIssueSource(
    projectId: string,
    integration: "linear",
    options: { teamId?: string } = {},
  ): Promise<boolean> {
    const result = await this.#client.projectIssueSource.deleteMany({
      where: { projectId, integration, ...(options.teamId ? { teamId: options.teamId } : {}) },
    });
    return result.count > 0;
  }

  async createSecretEnvelope(input: SecretEnvelopeWrite): Promise<void> {
    try {
      await this.#client.secretEnvelope.create({
        data: { ...input, createdAt: this.#now() },
      });
    } catch (error) {
      throw normalizeDatabaseError(error, {
        conflictCode: "RDB_CONFLICT",
        conflictMessage: "Secret reference already exists",
      });
    }
  }

  async getSecretEnvelope(reference: string): Promise<SecretEnvelopeRecord | undefined> {
    const row = await this.#client.secretEnvelope.findUnique({ where: { reference } });
    return row ? mapSecretEnvelope(row) : undefined;
  }

  async deleteSecretEnvelope(reference: string): Promise<void> {
    await this.#client.secretEnvelope.deleteMany({ where: { reference } });
  }

  async upsertIntegrationConnectionWithSecret(
    input: IntegrationConnectionUpsert,
    envelope: SecretEnvelopeWrite,
    previousReference?: string,
  ): Promise<IntegrationConnectionRecord> {
    assertEnvelopeMatchesConnection(input, envelope);
    const timestamp = this.#now();
    try {
      const row = await this.#client.transaction(async (transaction) => {
        const identity = {
          teamId: requireTeamId(input.teamId),
          integration: input.integration,
          provider: input.provider,
          providerExternalId: input.providerExternalId,
        };
        const current = await transaction.integrationConnection.findUnique({
          where: { teamId_integration_provider_providerExternalId: identity },
        });
        if (
          (current && current.credentialRef !== previousReference)
          || (!current && previousReference !== undefined)
        ) {
          throw new RdbError("RDB_CONFLICT", "Credential reference changed concurrently");
        }
        await transaction.secretEnvelope.create({
          data: { ...envelope, createdAt: timestamp },
        });
        const connection = await transaction.integrationConnection.upsert({
          where: { teamId_integration_provider_providerExternalId: identity },
          create: { id: input.id ?? this.#newId(), createdAt: timestamp, ...connectionWriteData(input, timestamp) },
          update: connectionWriteData(input, timestamp),
        });
        if (previousReference && previousReference !== envelope.reference) {
          await transaction.secretEnvelope.deleteMany({ where: { reference: previousReference } });
        }
        return connection;
      });
      return mapIntegrationConnectionRecord(row);
    } catch (error) {
      throw normalizeDatabaseError(error, {
        conflictCode: "INTEGRATION_CONNECTION_CONFLICT",
        conflictMessage: "Integration connection or secret identity already exists",
      });
    }
  }

  async replaceIntegrationConnectionWithSecret(
    id: string,
    input: IntegrationConnectionUpsert,
    envelope: SecretEnvelopeWrite,
    previousReference: string,
  ): Promise<IntegrationConnectionRecord | undefined> {
    assertEnvelopeMatchesConnection(input, envelope);
    const timestamp = this.#now();
    try {
      const row = await this.#client.transaction(async (transaction) => {
        const current = await transaction.integrationConnection.findUnique({ where: { id } });
        if (!current || current.credentialRef !== previousReference) return undefined;
        await transaction.secretEnvelope.create({
          data: { ...envelope, createdAt: timestamp },
        });
        const updated = await transaction.integrationConnection.updateMany({
          where: { id, credentialRef: previousReference },
          data: connectionWriteData(input, timestamp),
        });
        if (updated.count === 0) {
          throw new RdbError("RDB_CONFLICT", "Credential reference changed concurrently");
        }
        await transaction.secretEnvelope.deleteMany({ where: { reference: previousReference } });
        return transaction.integrationConnection.findUnique({ where: { id } });
      });
      return row ? mapIntegrationConnectionRecord(row) : undefined;
    } catch (error) {
      throw normalizeDatabaseError(error, {
        conflictCode: "INTEGRATION_CONNECTION_CONFLICT",
        conflictMessage: "Integration connection or secret identity already exists",
      });
    }
  }

  async deleteIntegrationConnectionWithSecret(id: string, reference: string): Promise<boolean> {
    try {
      return await this.#client.transaction(async (transaction) => {
        const current = await transaction.integrationConnection.findUnique({ where: { id } });
        if (!current) return false;
        if (current.credentialRef !== reference) {
          throw new RdbError("RDB_CONFLICT", "Credential reference changed concurrently");
        }
        const result = await transaction.integrationConnection.deleteMany({ where: { id } });
        if (result.count === 0) return false;
        await transaction.secretEnvelope.deleteMany({ where: { reference } });
        return true;
      });
    } catch (error) {
      throw normalizeDatabaseError(error, {
        relationCode: "INTEGRATION_CONNECTION_IN_USE",
        relationMessage: "Integration connection is still used by Projects",
      });
    }
  }

  async createProject(input: ProjectCreate): Promise<Project> {
    const parsed = projectCreateSchema.parse(input);
    const timestamp = this.#now();
    try {
      const row = await this.#client.transaction(async (transaction) => {
        await this.#requireUsableRepositoryConnection(
          parsed.repositoryConnectionId,
          parsed.teamId,
          transaction,
        );
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

  async listProjects(options: { includeArchived?: boolean; teamId?: string } = {}): Promise<Project[]> {
    const rows = await this.#client.project.findMany({
      ...(!options.includeArchived || options.teamId
        ? { where: { ...(options.includeArchived ? {} : { archivedAt: null }), ...(options.teamId ? { teamId: options.teamId } : {}) } }
        : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(mapProject);
  }

  async getProjectById(id: string, options: { teamId?: string } = {}): Promise<Project | undefined> {
    const row = await this.#client.project.findUnique({ where: { id } });
    return row && (!options.teamId || row.teamId === options.teamId) ? mapProject(row) : undefined;
  }

  async getProjectBySlug(slug: string, options: { teamId?: string } = {}): Promise<Project | undefined> {
    const row = await this.#client.project.findUnique({ where: { slug } });
    return row && (!options.teamId || row.teamId === options.teamId) ? mapProject(row) : undefined;
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
    try {
      return await this.#client.transaction(async (transaction) => {
        await this.#requireActiveProject(parsed.projectId, parsed.teamId, transaction);
        return this.#insertTask(parsed, transaction);
      });
    } catch (error) {
      throw normalizeDatabaseError(error);
    }
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
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const task = await this.#client.transaction(async (transaction) => {
          await this.#requireActiveProject(parsed.projectId, parsed.teamId, transaction);
          return this.#insertTask(parsed, transaction);
        });
        return { task, created: true };
      } catch (error) {
        if (isDatabaseErrorCode(error, "P2034") && attempt < 2) {
          continue;
        }
        const normalized = normalizeDatabaseError(error, {
          conflictCode: "DISPATCH_CONFLICT",
          conflictMessage: "Issue dispatch key already exists",
        });
        if (normalized.code !== "DISPATCH_CONFLICT") {
          throw normalized;
        }
        const raced = await this.getTaskByIssueDispatchKey(input.issueDispatchKey);
        if (!raced || raced.projectId !== parsed.projectId) {
          throw normalized;
        }
        return { task: raced, created: false };
      }
    }
    throw new RdbError("RDB_UNAVAILABLE", "Issue dispatch transaction could not be serialized");
  }

  async getTask(id: string, options: { teamId?: string } = {}): Promise<TaskRecord | undefined> {
    const row = await this.#client.task.findUnique({ where: { id } });
    return row && (!options.teamId || row.teamId === options.teamId) ? mapTask(row) : undefined;
  }

  async getTaskByIssueDispatchKey(
    issueDispatchKey: string,
    options: { teamId?: string } = {},
  ): Promise<TaskRecord | undefined> {
    const row = await this.#client.task.findUnique({ where: { issueDispatchKey } });
    return row && (!options.teamId || row.teamId === options.teamId) ? mapTask(row) : undefined;
  }

  async listTasks(options: { projectId?: string; teamId?: string } = {}): Promise<TaskListItem[]> {
    const rows = await this.#client.task.findMany({
      ...(options.projectId || options.teamId
        ? { where: { ...(options.projectId ? { projectId: options.projectId } : {}), ...(options.teamId ? { teamId: options.teamId } : {}) } }
        : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(mapTask);
  }

  async registerHostRuntime(input: RegisterHostRuntimeInput): Promise<RuntimeView> {
    const parsed = hostRuntimeRegistrationSchema.parse(input);
    const metadata = hostRuntimeMetadataSchema.parse({
      runnerId: parsed.runnerId,
      platform: parsed.platform,
    });
    const metadataJson = serializeJson(metadata);

    return this.#retryRuntimeWrite(() => this.#client.transaction(async (transaction) => {
      const existing = await this.#findHostRuntimeByRunnerId(parsed.runnerId, transaction);
      if (!existing) {
        const timestamp = this.#now();
        const runtime = await transaction.runtime.create({
          data: {
            id: this.#newId(),
            name: parsed.name,
            type: "host",
            metadata: metadataJson,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });
        const providers = await this.#replaceRuntimeProviders(
          runtime.id,
          parsed.providers,
          transaction,
        );
        return mapRuntime(runtime, providers);
      }

      const providersChanged = !sameProviderCapabilities(existing.providers, parsed.providers);
      const runtimeChanged = existing.runtime.name !== parsed.name
        || existing.runtime.metadata !== metadataJson;
      if (!runtimeChanged && !providersChanged) {
        return mapRuntime(existing.runtime, existing.providers);
      }

      const timestamp = this.#now();
      await transaction.runtime.updateMany({
        where: { id: existing.runtime.id },
        data: {
          ...(runtimeChanged ? { name: parsed.name, metadata: metadataJson } : {}),
          updatedAt: timestamp,
        },
      });
      const providers = providersChanged
        ? await this.#replaceRuntimeProviders(existing.runtime.id, parsed.providers, transaction)
        : existing.providers;
      return mapRuntime(
        { ...existing.runtime, name: parsed.name, metadata: metadataJson, updatedAt: timestamp },
        providers,
      );
    }));
  }

  async getRuntime(id: string): Promise<RuntimeView | undefined> {
    const runtime = await this.#client.runtime.findUnique({ where: { id } });
    if (!runtime) return undefined;
    return mapRuntime(runtime, await this.#listRuntimeProviders(id));
  }

  async listRuntimes(): Promise<RuntimeView[]> {
    const runtimes = await this.#client.runtime.findMany({
      where: { type: "host" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
    return Promise.all(runtimes.map(async (runtime) => (
      mapRuntime(runtime, await this.#listRuntimeProviders(runtime.id))
    )));
  }

  async renameRuntime(id: string, input: RuntimeRename): Promise<RuntimeView | undefined> {
    const parsed = runtimeRenameSchema.parse(input);
    const result = await this.#client.runtime.updateMany({
      where: { id },
      data: { name: parsed.name, updatedAt: this.#now() },
    });
    return result.count === 0 ? undefined : this.getRuntime(id);
  }

  async reportHostProviders(
    runnerId: string,
    providers: ProviderCapability[],
  ): Promise<RuntimeView | undefined> {
    const parsed = hostProviderReportSchema.parse({ runnerId, providers });
    return this.#retryRuntimeWrite(() => this.#client.transaction(async (transaction) => {
      const existing = await this.#findHostRuntimeByRunnerId(parsed.runnerId, transaction);
      if (!existing) return undefined;
      if (!sameProviderCapabilities(existing.providers, parsed.providers)) {
        const timestamp = this.#now();
        await transaction.runtime.updateMany({
          where: { id: existing.runtime.id },
          data: { updatedAt: timestamp },
        });
        const replaced = await this.#replaceRuntimeProviders(
          existing.runtime.id,
          parsed.providers,
          transaction,
        );
        return mapRuntime({ ...existing.runtime, updatedAt: timestamp }, replaced);
      }
      return mapRuntime(existing.runtime, existing.providers);
    }));
  }

  async registerLocalUser(input: RegisterLocalUserInput): Promise<{
    user: UserRecord;
    initialTeam: TeamRecord;
    ownerMembership: TeamMembershipRecord;
    session: AuthSessionRecord;
  }> {
    const timestamp = this.#now();
    const username = normalizeUsername(input.username);
    const displayUsername = input.displayUsername?.trim() || input.username.trim();
    const displayName = input.displayName?.trim() || displayUsername;
    try {
      return await this.#client.transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            id: this.#newId(),
            username,
            displayUsername,
            displayName,
            status: input.status ?? "active",
            requirePasswordChange: input.requirePasswordChange ?? false,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });
        await transaction.authAccount.create({
          data: {
            id: this.#newId(),
            userId: user.id,
            passwordHash: input.passwordHash,
            passwordSalt: input.passwordSalt,
            passwordParams: input.passwordParams,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });
        const team = await transaction.team.create({
          data: {
            id: this.#newId(),
            displayName: input.initialTeamDisplayName.trim(),
            status: "active",
            archivedAt: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });
        const ownerMembership = await transaction.teamMembership.create({
          data: {
            id: this.#newId(),
            teamId: team.id,
            userId: user.id,
            role: "owner",
            status: "active",
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });
        const session = await transaction.authSession.create({
          data: {
            id: this.#newId(),
            userId: user.id,
            tokenHash: input.tokenHash,
            activeTeamId: team.id,
            expiresAt: input.expiresAt,
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });
        return {
          user: mapUser(user),
          initialTeam: mapTeam(team),
          ownerMembership: mapTeamMembership(ownerMembership),
          session: mapAuthSession(session),
        };
      });
    } catch (error) {
      throw normalizeDatabaseError(error, {
        conflictCode: "RDB_CONFLICT",
        conflictMessage: "Username or session token is already in use",
      });
    }
  }

  async getUserByUsername(username: string): Promise<UserRecord | undefined> {
    const row = await this.#client.user.findUnique({ where: { username: normalizeUsername(username) } });
    return row ? mapUser(row) : undefined;
  }

  async getUserById(userId: string): Promise<UserRecord | undefined> {
    const row = await this.#client.user.findUnique({ where: { id: userId } });
    return row ? mapUser(row) : undefined;
  }

  async hasActiveLocalUser(): Promise<boolean> {
    const users = await this.#client.user.findMany({
      where: { status: "active" },
      take: 1,
    });
    return users.length > 0;
  }

  async getAuthAccountForUser(userId: string): Promise<AuthAccountRecord | undefined> {
    const row = await this.#client.authAccount.findUnique({ where: { userId } });
    return row ? mapAuthAccount(row) : undefined;
  }

  async getAuthSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | undefined> {
    const row = await this.#client.authSession.findUnique({ where: { tokenHash } });
    return row ? mapAuthSession(row) : undefined;
  }

  async createAuthSession(
    input: Omit<AuthSessionRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<AuthSessionRecord> {
    const timestamp = this.#now();
    try {
      const row = await this.#client.authSession.create({
        data: {
          id: this.#newId(),
          userId: input.userId,
          tokenHash: input.tokenHash,
          activeTeamId: input.activeTeamId ?? null,
          expiresAt: input.expiresAt,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      });
      return mapAuthSession(row);
    } catch (error) {
      throw normalizeDatabaseError(error, {
        conflictCode: "RDB_CONFLICT",
        conflictMessage: "Session token is already in use",
      });
    }
  }

  async deleteAuthSession(id: string): Promise<void> {
    await this.#client.authSession.deleteMany({ where: { id } });
  }

  async listAuthSessionsForUser(userId: string): Promise<AuthSessionRecord[]> {
    const rows = await this.#client.authSession.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(mapAuthSession);
  }

  async deleteAuthSessionForUser(userId: string, sessionId: string): Promise<boolean> {
    const session = await this.#client.authSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) return false;
    const deleted = await this.#client.authSession.deleteMany({ where: { id: sessionId } });
    return deleted.count > 0;
  }

  async updateUserDisplayName(userId: string, displayName: string): Promise<UserRecord | undefined> {
    const result = await this.#client.user.updateMany({
      where: { id: userId },
      data: { displayName: displayName.trim(), updatedAt: this.#now() },
    });
    return result.count === 0 ? undefined : this.getUserById(userId);
  }

  async replacePasswordCredentialAndRevokeOtherSessions(input: {
    userId: string;
    currentSessionId: string;
    passwordHash: string;
    passwordSalt: string;
    passwordParams: string;
  }): Promise<UserRecord | undefined> {
    const timestamp = this.#now();
    return this.#client.transaction(async (transaction) => {
      const [user, account, currentSession] = await Promise.all([
        transaction.user.findUnique({ where: { id: input.userId } }),
        transaction.authAccount.findUnique({ where: { userId: input.userId } }),
        transaction.authSession.findUnique({ where: { id: input.currentSessionId } }),
      ]);
      if (!user || !account) return undefined;
      if (!currentSession || currentSession.userId !== input.userId) {
        throw new RdbError("RDB_RELATION_CONFLICT", "Current session does not belong to User");
      }
      await transaction.authAccount.updateMany({
        where: { userId: input.userId },
        data: {
          passwordHash: input.passwordHash,
          passwordSalt: input.passwordSalt,
          passwordParams: input.passwordParams,
          updatedAt: timestamp,
        },
      });
      await transaction.user.updateMany({
        where: { id: input.userId },
        data: { requirePasswordChange: false, updatedAt: timestamp },
      });
      const sessions = await transaction.authSession.findMany({
        where: { userId: input.userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      await Promise.all(sessions
        .filter((session) => session.id !== input.currentSessionId)
        .map((session) => transaction.authSession.deleteMany({ where: { id: session.id } })));
      const updated = await transaction.user.findUnique({ where: { id: input.userId } });
      return updated ? mapUser(updated) : undefined;
    });
  }

  async deactivateLocalUser(userId: string): Promise<boolean> {
    const timestamp = this.#now();
    return this.#client.transaction(async (transaction) => {
      const user = await transaction.user.findUnique({ where: { id: userId } });
      if (!user) return false;
      if (user.status === "disabled") return true;

      const memberships = await transaction.teamMembership.findMany({
        where: { userId, status: "active" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      const activeMemberships = (await Promise.all(memberships.map(async (membership) => {
        const team = await transaction.team.findUnique({ where: { id: membership.teamId } });
        return team?.status === "active" ? membership : undefined;
      }))).filter((membership): membership is NonNullable<typeof membership> => membership !== undefined);

      if (activeMemberships.length <= 1) {
        throw new RdbError("RDB_CONFLICT", "Cannot deactivate a User with their last active Team");
      }
      for (const membership of activeMemberships) {
        if (membership.role !== "owner") continue;
        const owners = await transaction.teamMembership.count({
          where: { teamId: membership.teamId, role: "owner", status: "active" },
        });
        if (owners <= 1) {
          throw new RdbError("RDB_CONFLICT", "Cannot deactivate the last active Team Owner");
        }
      }

      await transaction.user.updateMany({
        where: { id: userId },
        data: { status: "disabled", updatedAt: timestamp },
      });
      const sessions = await transaction.authSession.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      await Promise.all(sessions.map((session) => (
        transaction.authSession.deleteMany({ where: { id: session.id } })
      )));
      return true;
    });
  }

  async createTeam(userId: string, displayName: string): Promise<{
    team: TeamRecord;
    ownerMembership: TeamMembershipRecord;
  }> {
    const timestamp = this.#now();
    return this.#client.transaction(async (transaction) => {
      const user = await transaction.user.findUnique({ where: { id: userId } });
      if (!user) throw new RdbError("RDB_NOT_FOUND", "User does not exist");
      const team = await transaction.team.create({
        data: {
          id: this.#newId(),
          displayName: displayName.trim(),
          status: "active",
          archivedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      });
      const ownerMembership = await transaction.teamMembership.create({
        data: {
          id: this.#newId(),
          teamId: team.id,
          userId,
          role: "owner",
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      });
      return { team: mapTeam(team), ownerMembership: mapTeamMembership(ownerMembership) };
    });
  }

  async renameTeam(teamId: string, displayName: string): Promise<TeamRecord | undefined> {
    const result = await this.#client.team.updateMany({
      where: { id: teamId },
      data: { displayName: displayName.trim(), updatedAt: this.#now() },
    });
    if (result.count === 0) return undefined;
    const team = await this.#client.team.findUnique({ where: { id: teamId } });
    return team ? mapTeam(team) : undefined;
  }

  async archiveTeam(teamId: string): Promise<TeamRecord | undefined> {
    const timestamp = this.#now();
    return this.#client.transaction(async (transaction) => {
      const team = await transaction.team.findUnique({ where: { id: teamId } });
      if (!team) return undefined;
      if (team.status === "archived") return mapTeam(team);
      const members = await transaction.teamMembership.findMany({
        where: { teamId, status: "active" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      for (const member of members) {
        const userMemberships = await transaction.teamMembership.findMany({
          where: { userId: member.userId, status: "active" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        });
        const otherActiveTeams = await Promise.all(userMemberships
          .filter((candidate) => candidate.teamId !== teamId)
          .map((candidate) => transaction.team.findUnique({ where: { id: candidate.teamId } })));
        if (!otherActiveTeams.some((candidate) => candidate?.status === "active")) {
          throw new RdbError("RDB_CONFLICT", "Cannot archive a User's last active Team");
        }
      }
      await transaction.team.updateMany({
        where: { id: teamId },
        data: { status: "archived", archivedAt: timestamp, updatedAt: timestamp },
      });
      const archived = await transaction.team.findUnique({ where: { id: teamId } });
      return archived ? mapTeam(archived) : undefined;
    });
  }

  async listActiveTeamsForUser(userId: string): Promise<TeamListItem[]> {
    const contexts = await this.#listActiveTeamContexts(userId);
    return contexts.map(({ team, role }) => ({
      id: team.id,
      displayName: team.displayName,
      status: team.status,
      currentUserRole: role,
      isActive: false,
    }));
  }

  async #listActiveTeamContexts(userId: string): Promise<Array<ResolvedActiveTeam>> {
    const memberships = await this.#client.teamMembership.findMany({
      where: { userId, status: "active" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const contexts = await Promise.all(memberships.map(async (membership) => (
      this.getTeamContext(userId, membership.teamId)
    )));
    return contexts.filter((context): context is ResolvedActiveTeam => context !== undefined);
  }

  async getTeamContext(userId: string, teamId: string): Promise<ResolvedActiveTeam | undefined> {
    const [team, membership] = await Promise.all([
      this.#client.team.findUnique({ where: { id: teamId } }),
      this.#client.teamMembership.findUnique({ where: { teamId_userId: { teamId, userId } } }),
    ]);
    if (!team || team.status !== "active" || !membership || membership.status !== "active") {
      return undefined;
    }
    return { team: mapTeam(team), role: mapTeamMembership(membership).role };
  }

  async setActiveTeam(sessionId: string, teamId: string): Promise<void> {
    await this.#client.transaction(async (transaction) => {
      const session = await transaction.authSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new RdbError("RDB_NOT_FOUND", "Session does not exist");
      const team = await transaction.team.findUnique({ where: { id: teamId } });
      const membership = await transaction.teamMembership.findUnique({
        where: { teamId_userId: { teamId, userId: session.userId } },
      });
      if (!team || team.status !== "active" || !membership || membership.status !== "active") {
        throw new RdbError("RDB_RELATION_CONFLICT", "Team is not active for this User");
      }
      await transaction.authSession.updateMany({
        where: { id: sessionId },
        data: { activeTeamId: teamId, updatedAt: this.#now() },
      });
    });
  }

  async resolveActiveTeam(sessionId: string): Promise<ResolvedActiveTeam | undefined> {
    const session = await this.#client.authSession.findUnique({ where: { id: sessionId } });
    if (!session) return undefined;
    if (session.activeTeamId) {
      const active = await this.getTeamContext(session.userId, session.activeTeamId);
      if (active) return active;
    }
    const [fallback] = await this.#listActiveTeamContexts(session.userId);
    if (!fallback) return undefined;
    await this.#client.authSession.updateMany({
      where: { id: sessionId },
      data: { activeTeamId: fallback.team.id, updatedAt: this.#now() },
    });
    return fallback;
  }

  async listMembers(teamId: string): Promise<MemberView[]> {
    const rows = await this.#client.teamMembership.findMany({
      where: { teamId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const members = await Promise.all(rows.map(async (membership) => {
      const user = await this.#client.user.findUnique({ where: { id: membership.userId } });
      if (!user) return undefined;
      const mapped = mapTeamMembership(membership);
      return {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        role: mapped.role,
        status: mapped.status,
        allowedActions: [] as MemberView["allowedActions"],
      };
    }));
    return members.filter((member): member is MemberView => member !== undefined);
  }

  async addMemberByUsername(teamId: string, username: string): Promise<TeamMembershipRecord> {
    const timestamp = this.#now();
    try {
      return await this.#client.transaction(async (transaction) => {
        const [team, user] = await Promise.all([
          transaction.team.findUnique({ where: { id: teamId } }),
          transaction.user.findUnique({ where: { username: normalizeUsername(username) } }),
        ]);
        if (!team || team.status !== "active") {
          throw new RdbError("RDB_NOT_FOUND", "Team does not exist");
        }
        if (!user) throw new RdbError("RDB_NOT_FOUND", "User does not exist");
        const membership = await transaction.teamMembership.create({
          data: {
            id: this.#newId(),
            teamId,
            userId: user.id,
            role: "member",
            status: "active",
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });
        return mapTeamMembership(membership);
      });
    } catch (error) {
      throw normalizeDatabaseError(error, {
        conflictCode: "RDB_CONFLICT",
        conflictMessage: "User is already a Team member",
      });
    }
  }

  async setMemberRole(
    teamId: string,
    userId: string,
    role: TeamRole,
  ): Promise<TeamMembershipRecord | undefined> {
    const timestamp = this.#now();
    return this.#client.transaction(async (transaction) => {
      const membership = await transaction.teamMembership.findUnique({
        where: { teamId_userId: { teamId, userId } },
      });
      if (!membership) return undefined;
      if (membership.status === "active" && membership.role === "owner" && role !== "owner") {
        const owners = await transaction.teamMembership.count({
          where: { teamId, role: "owner", status: "active" },
        });
        if (owners <= 1) throw new RdbError("RDB_CONFLICT", "Cannot remove the last active Team Owner");
      }
      await transaction.teamMembership.updateMany({
        where: { id: membership.id },
        data: { role, updatedAt: timestamp },
      });
      const updated = await transaction.teamMembership.findUnique({ where: { id: membership.id } });
      return updated ? mapTeamMembership(updated) : undefined;
    });
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    const timestamp = this.#now();
    return this.#client.transaction(async (transaction) => {
      const membership = await transaction.teamMembership.findUnique({
        where: { teamId_userId: { teamId, userId } },
      });
      if (!membership) return false;
      if (membership.status === "disabled") return true;
      const userMemberships = await transaction.teamMembership.findMany({
        where: { userId, status: "active" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      const otherActiveTeams = await Promise.all(userMemberships
        .filter((candidate) => candidate.teamId !== teamId)
        .map((candidate) => transaction.team.findUnique({ where: { id: candidate.teamId } })));
      if (!otherActiveTeams.some((candidate) => candidate?.status === "active")) {
        throw new RdbError("RDB_CONFLICT", "Cannot remove a User from their last active Team");
      }
      if (membership.role === "owner") {
        const owners = await transaction.teamMembership.count({
          where: { teamId, role: "owner", status: "active" },
        });
        if (owners <= 1) throw new RdbError("RDB_CONFLICT", "Cannot remove the last active Team Owner");
      }
      await transaction.teamMembership.updateMany({
        where: { id: membership.id },
        data: { status: "disabled", updatedAt: timestamp },
      });
      return true;
    });
  }

  async countActiveTeamsForUser(userId: string): Promise<number> {
    return (await this.#listActiveTeamContexts(userId)).length;
  }

  async countActiveOwners(teamId: string): Promise<number> {
    return this.#client.teamMembership.count({
      where: { teamId, role: "owner", status: "active" },
    });
  }

  async #findHostRuntimeByRunnerId(
    runnerId: string,
    client: MystraPrismaDelegates = this.#client,
  ): Promise<{ runtime: PrismaRuntime; providers: PrismaRuntimeProvider[] } | undefined> {
    const runtimes = await client.runtime.findMany({
      where: { type: "host" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
    const runtime = runtimes.find((candidate) => (
      mapHostRuntimeMetadata(candidate.metadata).runnerId === runnerId
    ));
    if (!runtime) return undefined;
    return { runtime, providers: await this.#listRuntimeProviders(runtime.id, client) };
  }

  async #listRuntimeProviders(
    runtimeId: string,
    client: MystraPrismaDelegates = this.#client,
  ): Promise<PrismaRuntimeProvider[]> {
    return client.runtimeProvider.findMany({
      where: { runtimeId },
      orderBy: [{ provider: "asc" }],
    });
  }

  async #replaceRuntimeProviders(
    runtimeId: string,
    providers: ProviderCapability[],
    client: MystraPrismaDelegates = this.#client,
  ): Promise<PrismaRuntimeProvider[]> {
    await client.runtimeProvider.deleteMany({ where: { runtimeId } });
    const created: PrismaRuntimeProvider[] = [];
    for (const provider of sortProviderCapabilities(providers)) {
      created.push(await client.runtimeProvider.create({
        data: {
          id: this.#newId(),
          runtimeId,
          provider: provider.provider,
          discovered: provider.discovered,
          available: provider.available,
          source: provider.source,
          resolvedPath: provider.resolvedPath,
          version: provider.version,
          unavailableReason: provider.unavailableReason,
        },
      }));
    }
    return created;
  }

  async #retryRuntimeWrite<T>(write: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await write();
      } catch (error) {
        if (isDatabaseErrorCode(error, "P2034") && attempt < 2) continue;
        throw normalizeDatabaseError(error);
      }
    }
    throw new RdbError("RDB_UNAVAILABLE", "Runtime write transaction could not be serialized");
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
          teamId: requireTeamId(input.teamId),
          projectId: input.projectId,
          issueDispatchKey: input.issueDispatchKey ?? null,
          metadata: serializeJson(input.metadata ?? {}),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      });
      return mapTask(row);
    } catch (error) {
      if (isDatabaseErrorCode(error, "P2034")) {
        throw error;
      }
      throw normalizeDatabaseError(error, {
        conflictCode: "DISPATCH_CONFLICT",
        conflictMessage: "Issue dispatch key already exists",
      });
    }
  }

  async #requireUsableRepositoryConnection(
    id: string,
    teamId: string,
    client: MystraPrismaDelegates = this.#client,
  ): Promise<IntegrationConnectionRecord> {
    const row = await client.integrationConnection.findUnique({ where: { id } });
    if (!row) {
      throw new RdbError("RDB_RELATION_CONFLICT", "Repository connection does not exist");
    }
    const connection = mapIntegrationConnectionRecord(row);
    if (connection.teamId !== teamId) {
      throw new RdbError("RDB_RELATION_CONFLICT", "Repository connection belongs to another Team");
    }
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
    teamId: string,
    client: MystraPrismaDelegates = this.#client,
  ): Promise<Project> {
    const row = await client.project.findUnique({ where: { id } });
    if (!row) {
      throw new RdbError("RDB_RELATION_CONFLICT", "Project does not exist");
    }
    const project = mapProject(row);
    if (project.teamId !== teamId) {
      throw new RdbError("RDB_RELATION_CONFLICT", "Project belongs to another Team");
    }
    if (project.archivedAt) {
      throw new RdbError("RDB_RELATION_CONFLICT", "Project is archived");
    }
    return project;
  }
}

function connectionWriteData(input: IntegrationConnectionUpsert, updatedAt: string) {
  return {
    teamId: requireTeamId(input.teamId),
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

function sameProviderCapabilities(
  existing: PrismaRuntimeProvider[],
  desired: ProviderCapability[],
): boolean {
  return JSON.stringify(existing.map(mapProviderCapability))
    === JSON.stringify(sortProviderCapabilities(desired));
}

function sortProviderCapabilities(
  providers: ProviderCapability[],
): ProviderCapability[] {
  return [...providers].sort((left, right) => left.provider.localeCompare(right.provider));
}

function requireTeamId(teamId: string | undefined): string {
  if (!teamId) throw new RdbError("RDB_RELATION_CONFLICT", "Team ID is required");
  return teamId;
}

function integrationConnectionWithoutCredential(
  record: IntegrationConnectionRecord,
): IntegrationConnection {
  const { credentialRef: _credentialRef, ...connection } = record;
  return connection;
}

function mapSecretEnvelope(row: {
  reference: string;
  version: number;
  algorithm: string;
  keyId: string;
  ciphertext: string;
  ciphertextIv: string;
  ciphertextAuthTag: string;
  wrappedDataKey: string;
  wrappedDataKeyIv: string;
  wrappedDataKeyAuthTag: string;
  createdAt: string;
}): SecretEnvelopeRecord {
  if (row.version !== 1 || row.algorithm !== "aes-256-gcm+aes-256-gcm-wrap") {
    throw new RdbError("RDB_UNAVAILABLE", "Secret envelope format is unsupported");
  }
  return {
    ...row,
    version: 1,
    algorithm: "aes-256-gcm+aes-256-gcm-wrap",
  };
}

function assertEnvelopeMatchesConnection(
  input: IntegrationConnectionUpsert,
  envelope: SecretEnvelopeWrite,
): void {
  if (!input.credentialRef || input.credentialRef !== envelope.reference) {
    throw new RdbError("RDB_CONFLICT", "Secret envelope does not match the credential reference");
  }
}
