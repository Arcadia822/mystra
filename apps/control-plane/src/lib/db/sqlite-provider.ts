import { createHash, randomBytes, randomUUID } from "node:crypto";

import Database from "better-sqlite3";
import {
  assertSessionStateTransition,
  contextBundleCreateSchema,
  contextBundleSchema,
  executionContractReferenceSchema,
  executionSpecArtifactSchema,
  issueSnapshotSchema,
  integrationConnectionActivationSchema,
  integrationConnectionSchema,
  platformCapabilitiesSchema,
  projectCreateSchema,
  projectRuntimeConfigSchema,
  projectSchema,
  projectUpdateSchema,
  publicRunnerSchema,
  resolvedRuntimeContractSchema,
  sessionCreateRequestSchema,
  sessionCreateSchema,
  sessionEventSchema,
  sessionInlineContextBundlePayloadSchema,
  sessionRecordSchema,
  sessionResultSchema,
  taskCreateRequestSchema,
  taskCreateSchema,
  taskListItemSchema,
  taskRecordSchema,
  taskSessionSummarySchema,
  type AgentName,
  type ContextBundle,
  type CoordinationSessionSummary,
  type ContextBundleCreate,
  type IntegrationConnection,
  type IntegrationConnectionActivation,
  type PlatformCapabilities,
  type Project,
  type ProjectCreate,
  type ProjectUpdate,
  type PublicRunner,
  type ResolvedRuntimeContract,
  type SessionCreate,
  type SessionCreateRequest,
  type SessionEvent,
  type SessionEventSeverity,
  type SessionEventType,
  type SessionRecord,
  type SessionState,
  type StaleMarkingResult,
  type TaskCreate,
  type TaskCreateRequest,
  type TaskListItem,
  type TaskRecord,
  type TaskSessionSummary,
} from "@mystra/shared";

import { ensureCurrentSchema } from "./migrations";
import { resolveRuntimeContract } from "../runtime/resolve-runtime";
import { projectCoordinationSessionSummary } from "../coordination-session-summary";
import type {
  IssueDispatchInput,
  IssueDispatchResult,
  IntegrationConnectionRecord,
  IntegrationConnectionUpsert,
  ProjectClaim,
  RdbProvider,
  RegisterRunnerInput,
  RunnerRecord,
  RunnerRegistrationResult,
  SessionClaim,
} from "./rdb-provider";

type Row = Record<string, unknown>;
type Clock = { now(): string };

const terminalStates = new Set<SessionState>([
  "succeeded",
  "failed",
  "canceled",
  "timed_out",
  "waiting_for_review",
]);

const EXECUTION_SPEC_BUNDLE_SLUG = "execution-spec";
const EXECUTION_SPEC_FILE_NAME = "execution-spec.json";
const EXECUTION_SPEC_MOUNT_PATH = "/mystra/context/execution-spec";

function stringField(row: Row, field: string): string {
  const value = row[field];
  if (typeof value !== "string") {
    throw new Error(`Expected ${field} to be a string`);
  }
  return value;
}

function numberField(row: Row, field: string): number {
  const value = row[field];
  if (typeof value !== "number") {
    throw new Error(`Expected ${field} to be a number`);
  }
  return value;
}

function nullableStringField(row: Row, field: string): string | undefined {
  const value = row[field];
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected ${field} to be a string or null`);
  }
  return value;
}

function jsonStringify(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function parseJson(row: Row, field: string, recordId: string): unknown {
  const raw = stringField(row, field);
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(`Invalid JSON in ${field} for record ${recordId}: ${detail}`);
  }
}

function parseOptionalJson(row: Row, field: string, recordId: string): unknown | undefined {
  const raw = nullableStringField(row, field);
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(`Invalid JSON in ${field} for record ${recordId}: ${detail}`);
  }
}

function credentialHash(credential: string): string {
  return createHash("sha256").update(credential).digest("hex");
}

function newCredential(): string {
  return `mystra_runner_${randomBytes(32).toString("base64url")}`;
}

function repositoryKey(task: Pick<TaskRecord, "repository">): string {
  return `${task.repository.integration}:${task.repository.externalId}`;
}

function normalizeRunnerCapabilities(input: unknown): PlatformCapabilities {
  const parsed = platformCapabilitiesSchema.parse(
    input ?? { agents: ["codex", "copilot"], executor: "fake" },
  );
  if (parsed.executor !== "docker") {
    return parsed;
  }
  return platformCapabilitiesSchema.parse({
    ...parsed,
    providers: parsed.providers.length > 0 ? parsed.providers : ["docker"],
    contextBundleModes: parsed.contextBundleModes.length > 0
      ? parsed.contextBundleModes
      : ["read-only", "session-scoped"],
    mountKinds: parsed.mountKinds.length > 0
      ? parsed.mountKinds
      : ["workspace", "gitMirror", "cache", "contextBundle", "secret"],
    portExposure: parsed.portExposure.supportsDynamicHostPorts
      ? parsed.portExposure
      : { supportsDynamicHostPorts: true },
    secretInjectionModes: parsed.secretInjectionModes.length > 0
      ? parsed.secretInjectionModes
      : ["env"],
  });
}

function runnerSupportsRuntime(
  runner: RunnerRecord,
  projectId: string,
  agent: AgentName,
  runtime: ResolvedRuntimeContract,
): boolean {
  if (runner.eligibleProjectIds && !runner.eligibleProjectIds.includes(projectId)) {
    return false;
  }
  if (runner.eligibleRuntimeProviders && !runner.eligibleRuntimeProviders.includes(runtime.provider)) {
    return false;
  }
  const capabilities = runner.capabilities;
  return capabilities.agents.includes(agent)
    && (runtime.provider !== "docker" || capabilities.executor === "docker")
    && capabilities.providers.includes(runtime.provider)
    && runtime.contextBundles.every((bundle) => capabilities.contextBundleModes.includes(bundle.accessMode))
    && runtime.mounts.every((mount) => capabilities.mountKinds.includes(mount.kind))
    && (runtime.exposedPorts.length === 0 || capabilities.portExposure.supportsDynamicHostPorts)
    && runtime.secrets.every((secret) => capabilities.secretInjectionModes.includes(secret.mode));
}

export class SqliteRdbProvider implements RdbProvider {
  private readonly db: Database.Database;
  private readonly clock: Clock;

  constructor(dbPath = ":memory:", clock: Clock = { now: () => new Date().toISOString() }) {
    this.clock = clock;
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    ensureCurrentSchema(this.db);
  }

  close(): void {
    if (this.db.open) {
      this.db.close();
    }
  }

  activateIntegrationConnection(input: IntegrationConnectionActivation): IntegrationConnection {
    const parsed = integrationConnectionActivationSchema.parse(input);
    return this.publicIntegrationConnection(this.upsertIntegrationConnection({
      integration: parsed.integration,
      provider: parsed.provider,
      connectionType: parsed.connectionType,
      providerExternalId: parsed.externalId,
      ...(parsed.displayName ? { displayName: parsed.displayName } : {}),
      account: parsed.account,
      repositorySelection: parsed.repositorySelection,
      permissions: parsed.permissions,
      credentialState: parsed.credentialState,
      accessSummary: {},
    }));
  }

  upsertIntegrationConnection(input: IntegrationConnectionUpsert): IntegrationConnectionRecord {
    this.validateIntegrationConnectionInput(input);
    const timestamp = this.now();
    const upsert = this.db.transaction(() => {
      const existing = this.db.prepare(
        "SELECT * FROM integration_connections WHERE integration = ? AND external_id = ?",
      ).get(input.integration, input.providerExternalId) as Row | undefined;

      if (existing) {
        this.db.prepare(`
          UPDATE integration_connections SET
            provider = @provider,
            connection_type = @connectionType,
            display_name = @displayName,
            account = @account,
            repository_selection = @repositorySelection,
            permissions = @permissions,
            access_summary = @accessSummary,
            credential_ref = @credentialRef,
            credential_state = @credentialState,
            status = @status,
            updated_at = @updatedAt
          WHERE id = @id
        `).run({
          id: stringField(existing, "id"),
          provider: input.provider,
          connectionType: input.connectionType,
          displayName: input.displayName ?? null,
          account: jsonStringify(input.account),
          repositorySelection: input.repositorySelection,
          permissions: jsonStringify(input.permissions),
          accessSummary: jsonStringify(input.accessSummary),
          credentialRef: input.credentialRef ?? null,
          credentialState: input.credentialState,
          status: input.status ?? "active",
          updatedAt: timestamp,
        });
        return stringField(existing, "id");
      }

      const id = input.id ?? randomUUID();
      this.db.prepare(`
        INSERT INTO integration_connections (
          id, integration, provider, connection_type, external_id, display_name, account,
          repository_selection, permissions, access_summary, credential_ref, credential_state,
          status, created_at, updated_at
        ) VALUES (
          @id, @integration, @provider, @connectionType, @externalId, @displayName, @account,
          @repositorySelection, @permissions, @accessSummary, @credentialRef, @credentialState,
          @status, @createdAt, @updatedAt
        )
      `).run({
        id,
        integration: input.integration,
        provider: input.provider,
        connectionType: input.connectionType,
        externalId: input.providerExternalId,
        displayName: input.displayName ?? null,
        account: jsonStringify(input.account),
        repositorySelection: input.repositorySelection,
        permissions: jsonStringify(input.permissions),
        accessSummary: jsonStringify(input.accessSummary),
        credentialRef: input.credentialRef ?? null,
        credentialState: input.credentialState,
        status: input.status ?? "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return id;
    });
    const id = upsert.immediate();
    const connection = this.getIntegrationConnectionRecord(id);
    if (!connection) {
      throw new Error("INTEGRATION_CONNECTION_NOT_FOUND: connection was not persisted");
    }
    return connection;
  }

  replaceIntegrationConnection(
    id: string,
    input: IntegrationConnectionUpsert,
  ): IntegrationConnectionRecord | undefined {
    this.validateIntegrationConnectionInput(input);
    const result = this.db.prepare(`
      UPDATE integration_connections SET
        integration = @integration,
        provider = @provider,
        connection_type = @connectionType,
        external_id = @externalId,
        display_name = @displayName,
        account = @account,
        repository_selection = @repositorySelection,
        permissions = @permissions,
        access_summary = @accessSummary,
        credential_ref = @credentialRef,
        credential_state = @credentialState,
        status = @status,
        updated_at = @updatedAt
      WHERE id = @id
    `).run({
      id,
      integration: input.integration,
      provider: input.provider,
      connectionType: input.connectionType,
      externalId: input.providerExternalId,
      displayName: input.displayName ?? null,
      account: jsonStringify(input.account),
      repositorySelection: input.repositorySelection,
      permissions: jsonStringify(input.permissions),
      accessSummary: jsonStringify(input.accessSummary),
      credentialRef: input.credentialRef ?? null,
      credentialState: input.credentialState,
      status: input.status ?? "active",
      updatedAt: this.now(),
    });
    return result.changes === 0 ? undefined : this.getIntegrationConnectionRecord(id);
  }

  getIntegrationConnection(id: string): IntegrationConnection | undefined {
    const record = this.getIntegrationConnectionRecord(id);
    return record ? this.publicIntegrationConnection(record) : undefined;
  }

  getIntegrationConnectionRecord(id: string): IntegrationConnectionRecord | undefined {
    const row = this.db.prepare("SELECT * FROM integration_connections WHERE id = ?").get(id) as Row | undefined;
    return row ? this.integrationConnectionRecordFromRow(row) : undefined;
  }

  getActiveIntegrationConnection(integration: string): IntegrationConnection | undefined {
    const rows = this.db.prepare(
      "SELECT * FROM integration_connections WHERE integration = ? AND status = 'active' ORDER BY created_at DESC, id DESC LIMIT 2",
    ).all(integration) as Row[];
    return rows.length === 1 ? this.publicIntegrationConnection(this.integrationConnectionRecordFromRow(rows[0]!)) : undefined;
  }

  listIntegrationConnections(options: { integration?: string } = {}): IntegrationConnection[] {
    const rows = (options.integration
      ? this.db.prepare("SELECT * FROM integration_connections WHERE integration = ? ORDER BY created_at DESC, id DESC").all(options.integration)
      : this.db.prepare("SELECT * FROM integration_connections ORDER BY created_at DESC, id DESC").all()) as Row[];
    return rows.map((row) => this.publicIntegrationConnection(this.integrationConnectionRecordFromRow(row)));
  }

  listIntegrationConnectionRecords(options: { integration?: string } = {}): IntegrationConnectionRecord[] {
    const rows = (options.integration
      ? this.db.prepare("SELECT * FROM integration_connections WHERE integration = ? ORDER BY created_at DESC, id DESC").all(options.integration)
      : this.db.prepare("SELECT * FROM integration_connections ORDER BY created_at DESC, id DESC").all()) as Row[];
    return rows.map((row) => this.integrationConnectionRecordFromRow(row));
  }

  setIntegrationConnectionStatus(
    id: string,
    status: IntegrationConnection["status"],
    credentialState?: IntegrationConnection["credentialState"],
  ): IntegrationConnectionRecord | undefined {
    const result = this.db.prepare(`
      UPDATE integration_connections
      SET status = ?, credential_state = COALESCE(?, credential_state), updated_at = ?
      WHERE id = ?
    `).run(status, credentialState ?? null, this.now(), id);
    return result.changes === 0 ? undefined : this.getIntegrationConnectionRecord(id);
  }

  deleteIntegrationConnection(id: string): boolean {
    return this.db.prepare("DELETE FROM integration_connections WHERE id = ?").run(id).changes > 0;
  }

  listProjectsForIntegrationConnection(id: string): Project[] {
    const rows = this.db.prepare(
      "SELECT * FROM projects WHERE repository_connection_id = ? ORDER BY created_at DESC, id DESC",
    ).all(id) as Row[];
    return rows.map((row) => this.projectFromRow(row));
  }

  createProject(input: ProjectCreate): Project {
    const parsed = projectCreateSchema.parse(input);
    const timestamp = this.now();
    const project = projectSchema.parse({
      id: randomUUID(),
      ...parsed,
      runtime: projectRuntimeConfigSchema.parse(parsed.runtime),
      archivedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    try {
      this.db.prepare(`
        INSERT INTO projects (
          id, name, slug, repository_connection_id, repository_snapshot, base_branch, default_agent, runtime,
          prewarm_config, metadata, archived_at, created_at, updated_at
        ) VALUES (
          @id, @name, @slug, @repositoryConnectionId, @repositorySnapshot, @baseBranch, @defaultAgent, @runtime,
          @prewarmConfig, @metadata, @archivedAt, @createdAt, @updatedAt
        )
      `).run({
        id: project.id,
        name: project.name,
        slug: project.slug,
        repositoryConnectionId: project.repositoryConnectionId,
        repositorySnapshot: jsonStringify(project.repository),
        baseBranch: project.baseBranch,
        defaultAgent: project.defaultAgent,
        runtime: jsonStringify(project.runtime),
        prewarmConfig: jsonStringify(project.prewarmConfig),
        metadata: jsonStringify(project.metadata),
        archivedAt: project.archivedAt,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        throw new Error(`PROJECT_SLUG_CONFLICT: Project slug already exists: ${project.slug}`);
      }
      throw error;
    }
    return project;
  }

  listProjects(options: { includeArchived?: boolean } = {}): Project[] {
    const rows = this.db.prepare(options.includeArchived
      ? "SELECT * FROM projects ORDER BY created_at DESC, id DESC"
      : "SELECT * FROM projects WHERE archived_at IS NULL ORDER BY created_at DESC, id DESC").all() as Row[];
    return rows.map((row) => this.projectFromRow(row));
  }

  getProjectById(id: string): Project | undefined {
    const row = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Row | undefined;
    return row ? this.projectFromRow(row) : undefined;
  }

  getProjectBySlug(slug: string): Project | undefined {
    const row = this.db.prepare("SELECT * FROM projects WHERE slug = ?").get(slug) as Row | undefined;
    return row ? this.projectFromRow(row) : undefined;
  }

  updateProject(slug: string, input: ProjectUpdate): Project | undefined {
    const current = this.getProjectBySlug(slug);
    if (!current) {
      return undefined;
    }
    const update = projectUpdateSchema.parse(input);
    const next = projectSchema.parse({
      ...current,
      ...update,
      runtime: projectRuntimeConfigSchema.parse(update.runtime ?? current.runtime),
      updatedAt: this.now(),
    });
    try {
      this.db.prepare(`
        UPDATE projects SET
          name=@name, slug=@slug, repository_connection_id=@repositoryConnectionId, repository_snapshot=@repositorySnapshot,
          base_branch=@baseBranch, default_agent=@defaultAgent, runtime=@runtime,
          prewarm_config=@prewarmConfig, metadata=@metadata, archived_at=@archivedAt,
          updated_at=@updatedAt
        WHERE id=@id
      `).run({
        id: next.id,
        name: next.name,
        slug: next.slug,
        repositoryConnectionId: next.repositoryConnectionId,
        repositorySnapshot: jsonStringify(next.repository),
        baseBranch: next.baseBranch,
        defaultAgent: next.defaultAgent,
        runtime: jsonStringify(next.runtime),
        prewarmConfig: jsonStringify(next.prewarmConfig),
        metadata: jsonStringify(next.metadata),
        archivedAt: next.archivedAt,
        updatedAt: next.updatedAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        throw new Error(`PROJECT_SLUG_CONFLICT: Project slug already exists: ${next.slug}`);
      }
      throw error;
    }
    return this.getProjectById(next.id);
  }

  archiveProject(slug: string): Project | undefined {
    return this.updateProject(slug, { archivedAt: this.now() });
  }

  createContextBundle(input: ContextBundleCreate): ContextBundle {
    const parsed = contextBundleCreateSchema.parse(input);
    const timestamp = this.now();
    const bundle = contextBundleSchema.parse({ id: randomUUID(), ...parsed, createdAt: timestamp, updatedAt: timestamp });
    try {
      this.db.prepare(`
        INSERT INTO context_bundles (
          id, slug, display_name, source, access_mode, mount_path, freshness,
          failure_mode, metadata, archived_at, created_at, updated_at
        ) VALUES (
          @id, @slug, @displayName, @source, @accessMode, @mountPath, @freshness,
          @failureMode, @metadata, @archivedAt, @createdAt, @updatedAt
        )
      `).run({
        id: bundle.id,
        slug: bundle.slug,
        displayName: bundle.displayName,
        source: jsonStringify(bundle.source),
        accessMode: bundle.accessMode,
        mountPath: bundle.mountPath ?? null,
        freshness: jsonStringify(bundle.freshness),
        failureMode: bundle.failureMode,
        metadata: jsonStringify(bundle.metadata),
        archivedAt: bundle.archivedAt,
        createdAt: bundle.createdAt,
        updatedAt: bundle.updatedAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        throw new Error(`CONTEXT_BUNDLE_SLUG_CONFLICT: Context bundle slug already exists: ${bundle.slug}`);
      }
      throw error;
    }
    return bundle;
  }

  getContextBundleBySlug(slug: string): ContextBundle | undefined {
    const row = this.db.prepare("SELECT * FROM context_bundles WHERE slug = ?").get(slug) as Row | undefined;
    return row ? this.contextBundleFromRow(row) : undefined;
  }

  listContextBundles(options: { includeArchived?: boolean } = {}): ContextBundle[] {
    const rows = this.db.prepare(options.includeArchived
      ? "SELECT * FROM context_bundles ORDER BY created_at DESC, id DESC"
      : "SELECT * FROM context_bundles WHERE archived_at IS NULL ORDER BY created_at DESC, id DESC").all() as Row[];
    return rows.map((row) => this.contextBundleFromRow(row));
  }

  createTask(input: TaskCreateRequest): TaskRecord {
    const parsed = taskCreateRequestSchema.parse(input);
    const project = this.requireActiveProject(parsed.projectId);
    return this.insertTask(taskCreateSchema.parse({ ...parsed, repository: project.repository }));
  }

  dispatchIssue(input: IssueDispatchInput): IssueDispatchResult {
    const parsedTask = taskCreateSchema.parse(input.task);
    if (parsedTask.source !== "issue" || !parsedTask.dispatchKey) {
      throw new Error("INVALID_TASK: Issue dispatch requires an Issue Task and dispatchKey");
    }
    const parsedSession = sessionCreateRequestSchema.parse(input.session);
    const transact = this.db.transaction(() => {
      const existing = this.getTaskByDispatchKey(parsedTask.dispatchKey!);
      if (existing) {
        if (
          existing.projectId !== parsedTask.projectId
          || existing.repository.externalId !== parsedTask.repository.externalId
          || existing.issue?.reference.externalId !== parsedTask.issue?.reference.externalId
        ) {
          throw new Error("DISPATCH_CONFLICT: dispatch key refers to contradictory immutable identity");
        }
        const sessionRow = this.db.prepare("SELECT * FROM sessions WHERE initial_dispatch_key = ?").get(parsedTask.dispatchKey) as Row | undefined;
        if (!sessionRow) {
          throw new Error("DISPATCH_CONFLICT: initial Session is missing");
        }
        const existingSession = this.sessionFromRow(sessionRow);
        if (
          existingSession.branch !== parsedSession.branch
          || (parsedSession.agent && existingSession.agent !== parsedSession.agent)
          || existingSession.objective !== parsedSession.objective
        ) {
          throw new Error("DISPATCH_CONFLICT: dispatch key refers to contradictory initial Session");
        }
        return { task: existing, session: existingSession, created: false };
      }
      const project = this.requireActiveProject(parsedTask.projectId);
      if (jsonStringify(project.repository) !== jsonStringify(parsedTask.repository)) {
        throw new Error("DISPATCH_CONFLICT: Task repository does not match Project");
      }
      const task = this.insertTask(parsedTask);
      const session = this.insertSession(task, parsedSession, parsedTask.dispatchKey);
      return { task, session, created: true };
    });
    return transact.immediate();
  }

  getTask(id: string): TaskRecord | undefined {
    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Row | undefined;
    return row ? this.taskFromRow(row) : undefined;
  }

  getTaskByDispatchKey(dispatchKey: string): TaskRecord | undefined {
    const row = this.db.prepare("SELECT * FROM tasks WHERE dispatch_key = ?").get(dispatchKey) as Row | undefined;
    return row ? this.taskFromRow(row) : undefined;
  }

  listTasks(): TaskListItem[] {
    const rows = this.db.prepare(`
      SELECT tasks.*,
        COUNT(sessions.id) AS session_count,
        COALESCE(SUM(CASE WHEN sessions.state IN ('queued','dispatching','assigned','starting','running') THEN 1 ELSE 0 END), 0) AS active_session_count
      FROM tasks
      LEFT JOIN sessions ON sessions.task_id = tasks.id
      GROUP BY tasks.id
      ORDER BY tasks.created_at DESC, tasks.id DESC
    `).all() as Row[];
    return rows.map((row) => taskListItemSchema.parse({
      ...this.taskFromRow(row),
      sessionCount: numberField(row, "session_count"),
      activeSessionCount: numberField(row, "active_session_count"),
    }));
  }

  getTaskSessionSummary(id: string): TaskSessionSummary | undefined {
    if (!this.getTask(id)) {
      return undefined;
    }
    const counts = this.db.prepare(`
      SELECT COUNT(*) AS session_count,
        COALESCE(SUM(CASE WHEN state IN ('queued','dispatching','assigned','starting','running') THEN 1 ELSE 0 END), 0) AS active_session_count
      FROM sessions WHERE task_id = ?
    `).get(id) as Row;
    const latestRow = this.db.prepare(
      "SELECT * FROM sessions WHERE task_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
    ).get(id) as Row | undefined;
    return taskSessionSummarySchema.parse({
      sessionCount: numberField(counts, "session_count"),
      activeSessionCount: numberField(counts, "active_session_count"),
      ...(latestRow ? { latestSession: this.sessionSummary(this.sessionFromRow(latestRow)) } : {}),
    });
  }

  createSession(taskId: string, input: SessionCreateRequest): SessionRecord {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error(`TASK_NOT_FOUND: Task not found: ${taskId}`);
    }
    return this.insertSession(task, sessionCreateRequestSchema.parse(input));
  }

  getSession(id: string): SessionRecord | undefined {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Row | undefined;
    return row ? this.sessionFromRow(row) : undefined;
  }

  listSessions(taskId: string): SessionRecord[] {
    if (!this.getTask(taskId)) {
      throw new Error(`TASK_NOT_FOUND: Task not found: ${taskId}`);
    }
    return (this.db.prepare(
      "SELECT * FROM sessions WHERE task_id = ? ORDER BY created_at ASC, id ASC",
    ).all(taskId) as Row[]).map((row) => this.sessionFromRow(row));
  }

  getSessionSummary(id: string): CoordinationSessionSummary | undefined {
    const session = this.getSession(id);
    if (!session) {
      return undefined;
    }
    const task = this.requireTask(session.taskId);
    const project = this.getProjectById(task.projectId);
    return projectCoordinationSessionSummary({
      task,
      session,
      ...(project ? { projectSlug: project.slug } : {}),
      recentEvents: this.listInternalSessionEvents(session.id),
    });
  }

  cancelSession(id: string, request: { requestedAt?: string; requestedBy?: string; reason?: string } = {}): {
    outcome: "canceled" | "cancellation_requested";
    session: SessionRecord;
  } {
    const transact = this.db.transaction(() => {
      const session = this.requireSession(id);
      if (terminalStates.has(session.state)) {
        throw new Error(`SESSION_CANCEL_CONFLICT: Session is terminal: ${session.state}`);
      }
      const timestamp = request.requestedAt ?? this.now();
      if (session.state === "queued" || session.state === "dispatching") {
        assertSessionStateTransition(session.state, "canceled");
        this.db.prepare(`
          UPDATE sessions SET state='canceled', cancellation_request=?, finished_at=?, updated_at=? WHERE id=?
        `).run(jsonStringify({ requestedAt: timestamp, ...(request.requestedBy ? { requestedBy: request.requestedBy } : {}), ...(request.reason ? { reason: request.reason } : {}) }), timestamp, timestamp, id);
        this.insertSessionEvent(session.taskId, id, "session.canceled", "info", {}, timestamp);
        return { outcome: "canceled" as const, session: this.requireSession(id) };
      }
      this.db.prepare("UPDATE sessions SET cancellation_request=?, updated_at=? WHERE id=?").run(
        jsonStringify({ requestedAt: timestamp, ...(request.requestedBy ? { requestedBy: request.requestedBy } : {}), ...(request.reason ? { reason: request.reason } : {}) }),
        timestamp,
        id,
      );
      this.insertSessionEvent(session.taskId, id, "cancellation.requested", "warn", {}, timestamp);
      return { outcome: "cancellation_requested" as const, session: this.requireSession(id) };
    });
    return transact.immediate();
  }

  registerRunner(input: RegisterRunnerInput): RunnerRegistrationResult {
    const capabilities = normalizeRunnerCapabilities(input.capabilities);
    const credential = newCredential();
    const hash = credentialHash(credential);
    const timestamp = this.now();
    const transact = this.db.transaction(() => {
      const existing = this.db.prepare("SELECT * FROM runners WHERE name = ?").get(input.runnerName) as Row | undefined;
      if (existing) {
        const runnerId = stringField(existing, "id");
        this.db.prepare(`
          UPDATE runners SET credential_hash=?, capabilities=?, max_concurrency=?, stale_after_seconds=?,
            eligible_project_ids=?, eligible_runtime_providers=?, last_heartbeat_at=?, updated_at=?
          WHERE id=?
        `).run(
          hash,
          jsonStringify(capabilities),
          input.maxConcurrency ?? 1,
          input.staleAfterSeconds ?? 90,
          input.eligibleProjectIds ? jsonStringify(input.eligibleProjectIds) : null,
          input.eligibleRuntimeProviders ? jsonStringify(input.eligibleRuntimeProviders) : null,
          timestamp,
          timestamp,
          runnerId,
        );
        return { runner: this.requireRunner(runnerId), credential };
      }
      const runnerId = randomUUID();
      this.db.prepare(`
        INSERT INTO runners (
          id, name, credential_hash, capabilities, max_concurrency, stale_after_seconds,
          eligible_project_ids, eligible_runtime_providers, last_heartbeat_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        runnerId,
        input.runnerName,
        hash,
        jsonStringify(capabilities),
        input.maxConcurrency ?? 1,
        input.staleAfterSeconds ?? 90,
        input.eligibleProjectIds ? jsonStringify(input.eligibleProjectIds) : null,
        input.eligibleRuntimeProviders ? jsonStringify(input.eligibleRuntimeProviders) : null,
        timestamp,
        timestamp,
        timestamp,
      );
      return { runner: this.requireRunner(runnerId), credential };
    });
    return transact.immediate();
  }

  authenticateRunner(credential: string | null): RunnerRecord | undefined {
    if (!credential) {
      return undefined;
    }
    const row = this.db.prepare("SELECT * FROM runners WHERE credential_hash = ?").get(credentialHash(credential)) as Row | undefined;
    return row ? this.runnerFromRow(row) : undefined;
  }

  heartbeatRunner(runnerId: string, activeSessionIds: string[] = []): RunnerRecord {
    for (const sessionId of activeSessionIds) {
      const session = this.getSession(sessionId);
      if (!session || session.assignedRunnerId !== runnerId || !["assigned", "starting", "running"].includes(session.state)) {
        throw new Error(`SESSION_ASSIGNMENT_MISMATCH: ${sessionId}`);
      }
    }
    const timestamp = this.now();
    const result = this.db.prepare("UPDATE runners SET last_heartbeat_at=?, updated_at=? WHERE id=?").run(timestamp, timestamp, runnerId);
    if (result.changes === 0) {
      throw new Error(`RUNNER_NOT_FOUND: Runner not found: ${runnerId}`);
    }
    return this.requireRunner(runnerId);
  }

  getRunner(runnerId: string): PublicRunner | undefined {
    const runner = this.runnerById(runnerId);
    if (!runner) {
      return undefined;
    }
    return this.publicRunner(runner, this.assignmentsByRunner().get(runnerId) ?? []);
  }

  listRunners(): PublicRunner[] {
    const assignments = this.assignmentsByRunner();
    return (this.db.prepare("SELECT * FROM runners ORDER BY created_at ASC, id ASC").all() as Row[])
      .map((row) => this.runnerFromRow(row))
      .map((runner) => this.publicRunner(runner, assignments.get(runner.id) ?? []));
  }

  claimNextSession(runnerId: string): SessionClaim | undefined {
    const transact = this.db.transaction(() => {
      const runner = this.requireRunner(runnerId);
      const activeCount = numberField(this.db.prepare(`
        SELECT COUNT(*) AS count FROM sessions WHERE assigned_runner_id=? AND state IN ('assigned','starting','running')
      `).get(runnerId) as Row, "count");
      if (activeCount >= runner.maxConcurrency) {
        return undefined;
      }
      const candidates = this.db.prepare(`
        SELECT sessions.* FROM sessions
        JOIN tasks ON tasks.id = sessions.task_id
        WHERE sessions.state = 'queued'
        ORDER BY sessions.created_at ASC, sessions.id ASC
      `).all() as Row[];
      for (const row of candidates) {
        const session = this.sessionFromRow(row);
        const task = this.requireTask(session.taskId);
        const project = this.requireActiveProject(task.projectId);
        const runtime = this.resolveSessionRuntime(task, session, project);
        if (!runnerSupportsRuntime(runner, project.id, session.agent, runtime)) {
          continue;
        }
        const timestamp = this.now();
        assertSessionStateTransition(session.state, "assigned");
        const result = this.db.prepare(`
          UPDATE sessions SET state='assigned', assigned_runner_id=?, resolved_runtime=?, updated_at=?
          WHERE id=? AND state='queued'
        `).run(runnerId, jsonStringify(runtime), timestamp, session.id);
        if (result.changes !== 1) {
          continue;
        }
        this.insertSessionEvent(task.id, session.id, "session.assigned", "info", { runnerId }, timestamp);
        return {
          task,
          session: this.requireSession(session.id),
          project: this.projectClaim(project),
          runtime,
        };
      }
      return undefined;
    });
    return transact.immediate();
  }

  getSessionClaim(runnerId: string, sessionId: string): SessionClaim | undefined {
    const session = this.getSession(sessionId);
    if (!session || session.assignedRunnerId !== runnerId || !session.resolvedRuntime) {
      return undefined;
    }
    const task = this.requireTask(session.taskId);
    const project = this.requireActiveProject(task.projectId);
    return { task, session, project: this.projectClaim(project), runtime: session.resolvedRuntime };
  }

  appendSessionEvent(runnerId: string, sessionId: string, input: unknown): SessionEvent {
    const parsedInput = sessionEventSchema
      .omit({ sessionId: true, taskId: true, timestamp: true })
      .parse(input);
    if (parsedInput.type.startsWith("session.") && terminalStates.has(parsedInput.type.replace("session.", "") as SessionState)) {
      throw new Error("INVALID_SESSION_EVENT: terminal facts must be written by completeSession");
    }
    const transact = this.db.transaction(() => {
      const session = this.requireOwnedSession(runnerId, sessionId);
      const timestamp = this.now();
      if (parsedInput.type === "container.starting" && session.state === "assigned") {
        this.transitionSession(session, "starting", timestamp);
      }
      if (parsedInput.type === "execution.started") {
        let current = this.requireSession(sessionId);
        if (current.state === "assigned") {
          this.transitionSession(current, "starting", timestamp);
          current = this.requireSession(sessionId);
        }
        if (current.state === "starting") {
          this.transitionSession(current, "running", timestamp);
        }
      }
      return this.insertSessionEvent(
        session.taskId,
        sessionId,
        parsedInput.type,
        parsedInput.severity,
        parsedInput.data,
        timestamp,
      );
    });
    return transact.immediate();
  }

  completeSession(runnerId: string, sessionId: string, input: unknown): SessionRecord {
    const result = sessionResultSchema.parse(input);
    const nextState = result.status as SessionState;
    const transact = this.db.transaction(() => {
      let session = this.requireOwnedSession(runnerId, sessionId);
      const timestamp = this.now();
      if ((nextState === "succeeded" || nextState === "waiting_for_review") && session.state === "assigned") {
        this.transitionSession(session, "starting", timestamp);
        session = this.requireSession(sessionId);
        this.transitionSession(session, "running", timestamp);
        session = this.requireSession(sessionId);
      }
      assertSessionStateTransition(session.state, nextState);
      this.db.prepare(`
        UPDATE sessions SET state=?, result=?, failure_reason=?, finished_at=?, updated_at=? WHERE id=?
      `).run(
        nextState,
        jsonStringify(result),
        result.status === "succeeded" || result.status === "waiting_for_review"
          ? null
          : result.errorMessage ?? result.summary,
        timestamp,
        timestamp,
        sessionId,
      );
      this.insertSessionEvent(
        session.taskId,
        sessionId,
        `session.${nextState}` as SessionEventType,
        nextState === "failed" ? "error" : "info",
        { summary: result.summary },
        timestamp,
      );
      return this.requireSession(sessionId);
    });
    return transact.immediate();
  }

  listInternalSessionEvents(sessionId: string): SessionEvent[] {
    return (this.db.prepare(
      "SELECT * FROM session_events WHERE session_id=? ORDER BY created_at ASC, id ASC",
    ).all(sessionId) as Row[]).map((row) => this.sessionEventFromRow(row));
  }

  markStaleRunners(): StaleMarkingResult[] {
    const timestamp = this.now();
    const transact = this.db.transaction(() => {
      const results: StaleMarkingResult[] = [];
      for (const row of this.db.prepare("SELECT * FROM runners ORDER BY id ASC").all() as Row[]) {
        const runner = this.runnerFromRow(row);
        const staleBefore = new Date(new Date(timestamp).getTime() - runner.staleAfterSeconds * 1000).toISOString();
        if (runner.lastHeartbeatAt >= staleBefore) {
          continue;
        }
        const sessionRows = this.db.prepare(`
          SELECT * FROM sessions WHERE assigned_runner_id=? AND state IN ('assigned','starting','running') ORDER BY id ASC
        `).all(runner.id) as Row[];
        const staleSessionIds: string[] = [];
        for (const sessionRow of sessionRows) {
          const session = this.sessionFromRow(sessionRow);
          assertSessionStateTransition(session.state, "failed");
          this.db.prepare(`
            UPDATE sessions SET state='failed', stale_reason='runner_stale', stale_marked_at=?,
              failure_reason='Runner stopped reporting heartbeats', finished_at=?, updated_at=? WHERE id=?
          `).run(timestamp, timestamp, timestamp, session.id);
          this.insertSessionEvent(session.taskId, session.id, "session.stale_marked", "error", { runnerId: runner.id }, timestamp);
          staleSessionIds.push(session.id);
        }
        if (staleSessionIds.length > 0) {
          results.push({ runnerId: runner.id, staleSessionIds });
        }
      }
      return results;
    });
    return transact.immediate();
  }

  private now(): string {
    return this.clock.now();
  }

  private requireActiveProject(projectId: string): Project {
    const project = this.getProjectById(projectId);
    if (!project) {
      throw new Error(`PROJECT_NOT_FOUND: Project not found: ${projectId}`);
    }
    if (project.archivedAt) {
      throw new Error(`PROJECT_ARCHIVED: Project is archived: ${project.slug}`);
    }
    return project;
  }

  private insertTask(input: TaskCreate): TaskRecord {
    const parsed = taskCreateSchema.parse(input);
    const timestamp = this.now();
    const task = taskRecordSchema.parse({ id: randomUUID(), ...parsed, createdAt: timestamp, updatedAt: timestamp });
    try {
      this.db.prepare(`
        INSERT INTO tasks (
          id, project_id, source, objective, issue_snapshot, dispatch_key,
          repository_snapshot, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        task.id,
        task.projectId,
        task.source,
        task.objective,
        task.issue ? jsonStringify(task.issue) : null,
        task.dispatchKey ?? null,
        jsonStringify(task.repository),
        jsonStringify(task.metadata),
        task.createdAt,
        task.updatedAt,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("dispatch_key")) {
        throw new Error("DISPATCH_CONFLICT: dispatch key already exists");
      }
      throw error;
    }
    return task;
  }

  private insertSession(task: TaskRecord, input: SessionCreateRequest, initialDispatchKey?: string): SessionRecord {
    const project = this.requireActiveProject(task.projectId);
    const sessionId = randomUUID();
    const resolvedInput: SessionCreate = {
      ...sessionCreateRequestSchema.parse(input),
      taskId: task.id,
      agent: input.agent ?? project.defaultAgent,
      branch: input.branch ?? `mystra/${task.id.slice(0, 8)}/${sessionId.slice(0, 8)}`,
    };
    const parsed = sessionCreateSchema.parse(resolvedInput);
    const timestamp = this.now();
    const session = sessionRecordSchema.parse({
      id: sessionId,
      taskId: task.id,
      ...(initialDispatchKey ? { initialDispatchKey } : {}),
      title: parsed.title,
      objective: parsed.objective,
      agent: parsed.agent,
      branch: parsed.branch,
      ...(parsed.mergeRequest ? { mergeRequest: parsed.mergeRequest } : {}),
      ...(parsed.runtime ? { runtimeOverride: parsed.runtime } : {}),
      state: "queued",
      metadata: parsed.metadata,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    try {
      this.db.prepare(`
        INSERT INTO sessions (
          id, task_id, initial_dispatch_key, title, objective, agent, branch,
          repository_key, merge_request, runtime_override, state, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)
      `).run(
        session.id,
        session.taskId,
        session.initialDispatchKey ?? null,
        session.title,
        session.objective,
        session.agent,
        session.branch,
        repositoryKey(task),
        session.mergeRequest ? jsonStringify(session.mergeRequest) : null,
        session.runtimeOverride ? jsonStringify(session.runtimeOverride) : null,
        jsonStringify(session.metadata),
        session.createdAt,
        session.updatedAt,
      );
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes("idx_sessions_active_repository_branch")
        || error.message.includes("sessions.repository_key, sessions.branch")
      )) {
        throw new Error(`SESSION_BRANCH_CONFLICT: active branch already exists: ${session.branch}`);
      }
      throw error;
    }
    this.insertSessionEvent(task.id, session.id, "session.queued", "info", {}, timestamp);
    return session;
  }

  private resolveSessionRuntime(task: TaskRecord, session: SessionRecord, project: Project): ResolvedRuntimeContract {
    const runtime = resolveRuntimeContract({
      project,
      override: session.runtimeOverride,
      contextBundles: this.listContextBundles(),
    });
    const frozenAt = this.now();
    const artifactId = randomUUID();
    const uri = `mystra://sessions/${session.id}/artifacts/${EXECUTION_SPEC_FILE_NAME}`;
    const executionContract = executionContractReferenceSchema.parse({
      kind: "execution-spec",
      artifactId,
      uri,
      bundleSlug: EXECUTION_SPEC_BUNDLE_SLUG,
      mountPath: EXECUTION_SPEC_MOUNT_PATH,
      filePath: `${EXECUTION_SPEC_MOUNT_PATH}/${EXECUTION_SPEC_FILE_NAME}`,
      frozenAt,
    });
    const payload = executionSpecArtifactSchema.parse({
      version: 3,
      kind: "execution-spec",
      taskId: task.id,
      sessionId: session.id,
      source: task.source,
      projectId: task.projectId,
      repository: task.repository,
      baseBranch: project.baseBranch,
      branch: session.branch,
      agent: session.agent,
      objective: session.objective,
      ...(task.issue ? { issue: task.issue } : {}),
      ...(task.dispatchKey ? { dispatchKey: task.dispatchKey } : {}),
      metadata: { taskObjective: task.objective, sessionTitle: session.title },
      frozenAt,
      executionContract,
    });
    const materializationRef = `${EXECUTION_SPEC_BUNDLE_SLUG}-${session.id}`;
    const scoped = resolvedRuntimeContractSchema.parse({
      ...runtime,
      contextBundles: [
        ...runtime.contextBundles,
        {
          slug: EXECUTION_SPEC_BUNDLE_SLUG,
          required: true,
          accessMode: "session-scoped",
          mountPath: EXECUTION_SPEC_MOUNT_PATH,
          source: {
            kind: "session-inline",
            metadata: {
              materializationRef,
              sessionInline: sessionInlineContextBundlePayloadSchema.parse({
                files: [{ path: EXECUTION_SPEC_FILE_NAME, content: JSON.stringify(payload, null, 2) }],
              }),
              executionContract,
            },
          },
          failureMode: "fail-session",
        },
      ],
      executionContract,
      mounts: [
        ...runtime.mounts,
        {
          kind: "contextBundle",
          owner: "runtime",
          target: EXECUTION_SPEC_MOUNT_PATH,
          sourceRef: materializationRef,
          readOnly: true,
        },
      ],
    });
    this.db.prepare(`
      INSERT OR IGNORE INTO artifacts (id, session_id, task_id, kind, name, uri, metadata, created_at)
      VALUES (?, ?, ?, 'execution-spec', ?, ?, ?, ?)
    `).run(artifactId, session.id, task.id, EXECUTION_SPEC_FILE_NAME, uri, jsonStringify({ executionContract, payload }), frozenAt);
    return scoped;
  }

  private projectFromRow(row: Row): Project {
    const id = stringField(row, "id");
    return projectSchema.parse({
      id,
      name: stringField(row, "name"),
      slug: stringField(row, "slug"),
      repositoryConnectionId: stringField(row, "repository_connection_id"),
      repository: parseJson(row, "repository_snapshot", id),
      baseBranch: stringField(row, "base_branch"),
      defaultAgent: stringField(row, "default_agent"),
      runtime: parseJson(row, "runtime", id),
      prewarmConfig: parseJson(row, "prewarm_config", id),
      metadata: parseJson(row, "metadata", id),
      archivedAt: nullableStringField(row, "archived_at") ?? null,
      createdAt: stringField(row, "created_at"),
      updatedAt: stringField(row, "updated_at"),
    });
  }

  private integrationConnectionRecordFromRow(row: Row): IntegrationConnectionRecord {
    const id = stringField(row, "id");
    const connectionType = stringField(row, "connection_type");
    const providerExternalId = stringField(row, "external_id");
    const credentialRef = nullableStringField(row, "credential_ref");
    const publicConnection = integrationConnectionSchema.parse({
      id,
      integration: stringField(row, "integration"),
      provider: stringField(row, "provider"),
      connectionType,
      ...(connectionType === "github-app" ? { externalId: providerExternalId } : {}),
      displayName: nullableStringField(row, "display_name"),
      account: parseJson(row, "account", id),
      repositorySelection: stringField(row, "repository_selection"),
      permissions: parseJson(row, "permissions", id),
      credentialState: stringField(row, "credential_state"),
      status: stringField(row, "status"),
      createdAt: stringField(row, "created_at"),
      updatedAt: stringField(row, "updated_at"),
    });
    const { externalId: _externalId, ...publicFields } = publicConnection;
    return {
      ...publicFields,
      providerExternalId,
      ...(credentialRef ? { credentialRef } : {}),
      accessSummary: parseJson(row, "access_summary", id) as Record<string, unknown>,
    };
  }

  private publicIntegrationConnection(record: IntegrationConnectionRecord): IntegrationConnection {
    const {
      providerExternalId,
      credentialRef: _credentialRef,
      accessSummary: _accessSummary,
      ...publicFields
    } = record;
    return integrationConnectionSchema.parse({
      ...publicFields,
      ...(record.connectionType === "github-app" ? { externalId: providerExternalId } : {}),
    });
  }

  private validateIntegrationConnectionInput(input: IntegrationConnectionUpsert): void {
    if (input.connectionType === "github-app" && input.credentialRef) {
      throw new Error("GitHub App connections must not store a credential reference");
    }
    if (input.connectionType === "personal-access-token" && !input.credentialRef) {
      throw new Error("PAT connections require a credential reference");
    }
    integrationConnectionActivationSchema.parse({
      integration: input.integration,
      provider: input.provider,
      connectionType: input.connectionType,
      externalId: input.providerExternalId,
      ...(input.displayName ? { displayName: input.displayName } : {}),
      account: input.account,
      repositorySelection: input.repositorySelection,
      permissions: input.permissions,
      credentialState: input.credentialState,
    });
  }

  private contextBundleFromRow(row: Row): ContextBundle {
    const id = stringField(row, "id");
    return contextBundleSchema.parse({
      id,
      slug: stringField(row, "slug"),
      displayName: stringField(row, "display_name"),
      source: parseJson(row, "source", id),
      accessMode: stringField(row, "access_mode"),
      mountPath: nullableStringField(row, "mount_path"),
      freshness: parseJson(row, "freshness", id),
      failureMode: stringField(row, "failure_mode"),
      metadata: parseJson(row, "metadata", id),
      archivedAt: nullableStringField(row, "archived_at") ?? null,
      createdAt: stringField(row, "created_at"),
      updatedAt: stringField(row, "updated_at"),
    });
  }

  private taskFromRow(row: Row): TaskRecord {
    const id = stringField(row, "id");
    const issue = parseOptionalJson(row, "issue_snapshot", id);
    return taskRecordSchema.parse({
      id,
      projectId: stringField(row, "project_id"),
      source: stringField(row, "source"),
      objective: stringField(row, "objective"),
      ...(issue ? { issue: issueSnapshotSchema.parse(issue) } : {}),
      ...(nullableStringField(row, "dispatch_key") ? { dispatchKey: nullableStringField(row, "dispatch_key") } : {}),
      repository: parseJson(row, "repository_snapshot", id),
      metadata: parseJson(row, "metadata", id),
      createdAt: stringField(row, "created_at"),
      updatedAt: stringField(row, "updated_at"),
    });
  }

  private sessionFromRow(row: Row): SessionRecord {
    const id = stringField(row, "id");
    const cancellationRequest = parseOptionalJson(row, "cancellation_request", id);
    const mergeRequest = parseOptionalJson(row, "merge_request", id);
    const runtimeOverride = parseOptionalJson(row, "runtime_override", id);
    const resolvedRuntime = parseOptionalJson(row, "resolved_runtime", id);
    const result = parseOptionalJson(row, "result", id);
    return sessionRecordSchema.parse({
      id,
      taskId: stringField(row, "task_id"),
      ...(nullableStringField(row, "initial_dispatch_key") ? { initialDispatchKey: nullableStringField(row, "initial_dispatch_key") } : {}),
      title: stringField(row, "title"),
      objective: stringField(row, "objective"),
      agent: stringField(row, "agent"),
      branch: stringField(row, "branch"),
      ...(mergeRequest ? { mergeRequest } : {}),
      ...(runtimeOverride ? { runtimeOverride } : {}),
      state: stringField(row, "state"),
      ...(nullableStringField(row, "assigned_runner_id") ? { assignedRunnerId: nullableStringField(row, "assigned_runner_id") } : {}),
      ...(resolvedRuntime ? { resolvedRuntime } : {}),
      ...(result ? { result: sessionResultSchema.parse(result) } : {}),
      ...(nullableStringField(row, "failure_reason") ? { failureReason: nullableStringField(row, "failure_reason") } : {}),
      ...(cancellationRequest ? { cancellationRequest } : {}),
      ...(nullableStringField(row, "stale_reason") ? { staleReason: nullableStringField(row, "stale_reason") } : {}),
      ...(nullableStringField(row, "stale_marked_at") ? { staleMarkedAt: nullableStringField(row, "stale_marked_at") } : {}),
      metadata: parseJson(row, "metadata", id),
      createdAt: stringField(row, "created_at"),
      updatedAt: stringField(row, "updated_at"),
      ...(nullableStringField(row, "started_at") ? { startedAt: nullableStringField(row, "started_at") } : {}),
      ...(nullableStringField(row, "finished_at") ? { finishedAt: nullableStringField(row, "finished_at") } : {}),
    });
  }

  private sessionSummary(session: SessionRecord) {
    return {
      id: session.id,
      taskId: session.taskId,
      title: session.title,
      state: session.state,
      agent: session.agent,
      branch: session.branch,
      ...(session.assignedRunnerId ? { assignedRunnerId: session.assignedRunnerId } : {}),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      ...(session.startedAt ? { startedAt: session.startedAt } : {}),
      ...(session.finishedAt ? { finishedAt: session.finishedAt } : {}),
    };
  }

  private runnerFromRow(row: Row): RunnerRecord {
    const id = stringField(row, "id");
    const projectIds = parseOptionalJson(row, "eligible_project_ids", id);
    const providers = parseOptionalJson(row, "eligible_runtime_providers", id);
    return {
      id,
      name: stringField(row, "name"),
      capabilities: platformCapabilitiesSchema.parse(parseJson(row, "capabilities", id)),
      maxConcurrency: numberField(row, "max_concurrency"),
      staleAfterSeconds: numberField(row, "stale_after_seconds"),
      ...(projectIds ? { eligibleProjectIds: projectIds as string[] } : {}),
      ...(providers ? { eligibleRuntimeProviders: providers as string[] } : {}),
      lastHeartbeatAt: stringField(row, "last_heartbeat_at"),
      createdAt: stringField(row, "created_at"),
      updatedAt: stringField(row, "updated_at"),
    };
  }

  private sessionEventFromRow(row: Row): SessionEvent {
    return sessionEventSchema.parse({
      sessionId: stringField(row, "session_id"),
      taskId: stringField(row, "task_id"),
      timestamp: stringField(row, "created_at"),
      type: stringField(row, "type"),
      severity: stringField(row, "severity"),
      data: parseJson(row, "data", stringField(row, "id")),
    });
  }

  private requireTask(id: string): TaskRecord {
    const task = this.getTask(id);
    if (!task) {
      throw new Error(`TASK_NOT_FOUND: Task not found: ${id}`);
    }
    return task;
  }

  private requireSession(id: string): SessionRecord {
    const session = this.getSession(id);
    if (!session) {
      throw new Error(`SESSION_NOT_FOUND: Session not found: ${id}`);
    }
    return session;
  }

  private requireOwnedSession(runnerId: string, sessionId: string): SessionRecord {
    const session = this.requireSession(sessionId);
    if (session.assignedRunnerId !== runnerId) {
      throw new Error("SESSION_ASSIGNMENT_CONFLICT: Session is not assigned to this Runner");
    }
    return session;
  }

  private runnerById(id: string): RunnerRecord | undefined {
    const row = this.db.prepare("SELECT * FROM runners WHERE id=?").get(id) as Row | undefined;
    return row ? this.runnerFromRow(row) : undefined;
  }

  private requireRunner(id: string): RunnerRecord {
    const runner = this.runnerById(id);
    if (!runner) {
      throw new Error(`RUNNER_NOT_FOUND: Runner not found: ${id}`);
    }
    return runner;
  }

  private projectClaim(project: Project): ProjectClaim {
    return { id: project.id, slug: project.slug, runtime: project.runtime, prewarmConfig: project.prewarmConfig };
  }

  private insertSessionEvent(
    taskId: string,
    sessionId: string,
    type: SessionEventType,
    severity: SessionEventSeverity,
    data: Record<string, unknown>,
    timestamp: string,
  ): SessionEvent {
    const event = sessionEventSchema.parse({ taskId, sessionId, type, severity, data, timestamp });
    this.db.prepare(`
      INSERT INTO session_events (id, session_id, task_id, type, severity, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), event.sessionId, event.taskId, event.type, event.severity, jsonStringify(event.data), event.timestamp);
    return event;
  }

  private transitionSession(session: SessionRecord, nextState: SessionState, timestamp: string): void {
    assertSessionStateTransition(session.state, nextState);
    this.db.prepare(`
      UPDATE sessions SET state=?, started_at=COALESCE(started_at, ?), updated_at=? WHERE id=?
    `).run(nextState, nextState === "running" ? timestamp : null, timestamp, session.id);
  }

  private assignmentsByRunner(): Map<string, Array<{ taskId: string; sessionId: string }>> {
    const map = new Map<string, Array<{ taskId: string; sessionId: string }>>();
    const rows = this.db.prepare(`
      SELECT assigned_runner_id, task_id, id FROM sessions
      WHERE assigned_runner_id IS NOT NULL AND state IN ('assigned','starting','running')
      ORDER BY created_at ASC, id ASC
    `).all() as Row[];
    for (const row of rows) {
      const runnerId = stringField(row, "assigned_runner_id");
      const list = map.get(runnerId) ?? [];
      list.push({ taskId: stringField(row, "task_id"), sessionId: stringField(row, "id") });
      map.set(runnerId, list);
    }
    return map;
  }

  private publicRunner(runner: RunnerRecord, currentAssignments: Array<{ taskId: string; sessionId: string }>): PublicRunner {
    const staleAt = new Date(new Date(this.now()).getTime() - runner.staleAfterSeconds * 1000).toISOString();
    return publicRunnerSchema.parse({
      ...runner,
      activeSessionCount: currentAssignments.length,
      health: runner.lastHeartbeatAt < staleAt ? "stale" : "healthy",
      currentAssignments,
    });
  }
}
