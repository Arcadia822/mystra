import Database from "better-sqlite3";
import {
  agentNameSchema,
  assertRunStateTransition,
  contextBundleCreateSchema,
  contextBundleSchema,
  executionContractReferenceSchema,
  executionSpecArtifactSchema,
  issueSnapshotSchema,
  jobSpecSchema,
  jobInlineContextBundlePayloadSchema,
  platformCapabilitiesSchema,
  projectCreateSchema,
  projectRuntimeConfigSchema,
  projectSchema,
  projectUpdateSchema,
  resolvedRuntimeContractSchema,
  runEventSchema,
  runResultSchema,
  type CancelJobOutcome,
  type CancellationRequestMetadata,
  type ContextBundle,
  type ContextBundleCreate,
  type AgentName,
  type JobSpec,
  type PlatformCapabilities,
  type Project,
  type ProjectCreate,
  type ProjectUpdate,
  type ResolvedRuntimeContract,
  type RunEvent,
  type RunEventSeverity,
  type RunEventType,
  type RunResult,
  type RunState,
  type StaleMarkingResult,
} from "@mystra/shared";

import { sqliteMigrations } from "./migrations";
import { projectCoordinationRunSummary } from "../coordination-run-summary";
import { resolveRuntimeContract } from "../runtime/resolve-runtime";
import type {
  JobRecord,
  JobSnapshot,
  ProjectClaim,
  PublicRunnerSession,
  RdbProvider,
  RegisterRunnerInput,
  RunRecord,
  RunnerSession,
} from "./rdb-provider";

type Row = Record<string, unknown>;

const activeStates = new Set<RunState>([
  "queued",
  "dispatching",
  "assigned",
  "starting",
  "running",
]);

const terminalStates = new Set<RunState>([
  "succeeded",
  "failed",
  "canceled",
  "timed_out",
  "waiting_for_review",
]);

const EXECUTION_SPEC_BUNDLE_SLUG = "execution-spec";
const EXECUTION_SPEC_FILE_NAME = "execution-spec.json";
const EXECUTION_SPEC_MOUNT_PATH = "/mystra/context/execution-spec";

function executionSpecArtifactUri(runId: string): string {
  return `mystra://runs/${runId}/artifacts/${EXECUTION_SPEC_FILE_NAME}`;
}

function executionSpecMaterializationRef(runId: string): string {
  return `${EXECUTION_SPEC_BUNDLE_SLUG}-${runId}`;
}

function runtimeContextBundleMaterializationRef(slug: string, runId: string): string {
  return `${slug}-${runId}`;
}

function buildExecutionContractReference(input: {
  artifactId: string;
  uri: string;
  frozenAt: string;
}) {
  return executionContractReferenceSchema.parse({
    kind: "execution-spec",
    artifactId: input.artifactId,
    uri: input.uri,
    bundleSlug: EXECUTION_SPEC_BUNDLE_SLUG,
    mountPath: EXECUTION_SPEC_MOUNT_PATH,
    filePath: `${EXECUTION_SPEC_MOUNT_PATH}/${EXECUTION_SPEC_FILE_NAME}`,
    frozenAt: input.frozenAt,
  });
}

function attachExecutionSpecBundle(
  runtime: ResolvedRuntimeContract,
  input: {
    runId: string;
    artifactUri: string;
    frozenAt: string;
    executionContract: ReturnType<typeof buildExecutionContractReference>;
    payload: ReturnType<typeof executionSpecArtifactSchema.parse>;
  },
): ResolvedRuntimeContract {
  const materializationRef = executionSpecMaterializationRef(input.runId);
  const bundle = contextBundleSchema.parse({
    id: id(),
    slug: EXECUTION_SPEC_BUNDLE_SLUG,
    displayName: "Frozen Execution Spec",
    source: {
      kind: "job-inline",
      ref: input.artifactUri,
      metadata: {
        prompt: `Primary execution contract. Read ${input.executionContract.filePath} before making changes.`,
        materializationRef,
        jobInline: jobInlineContextBundlePayloadSchema.parse({
          files: [{ path: EXECUTION_SPEC_FILE_NAME, content: JSON.stringify(input.payload, null, 2) }],
        }),
        executionContract: input.executionContract,
      },
    },
    accessMode: "job-scoped",
    mountPath: EXECUTION_SPEC_MOUNT_PATH,
    freshness: {
      frozenAt: input.frozenAt,
    },
    failureMode: "fail-run",
    metadata: {
      artifactId: input.executionContract.artifactId,
      artifactUri: input.artifactUri,
      contractKind: input.executionContract.kind,
    },
    archivedAt: null,
    createdAt: input.frozenAt,
    updatedAt: input.frozenAt,
  });

  return resolvedRuntimeContractSchema.parse({
    ...runtime,
    contextBundles: [
      ...runtime.contextBundles.filter((candidate) => candidate.slug !== EXECUTION_SPEC_BUNDLE_SLUG),
      {
        slug: bundle.slug,
        required: true,
        accessMode: bundle.accessMode,
        mountPath: bundle.mountPath,
        source: bundle.source,
        failureMode: bundle.failureMode,
      },
    ],
    executionContract: input.executionContract,
    mounts: [
      ...runtime.mounts.filter((mount) => !(mount.kind === "contextBundle" && mount.target === EXECUTION_SPEC_MOUNT_PATH)),
      {
        kind: "contextBundle",
        owner: "runtime",
        target: EXECUTION_SPEC_MOUNT_PATH,
        sourceRef: materializationRef,
        readOnly: true,
      },
    ],
  });
}

function scopeRuntimeContextBundles(
  runtime: ResolvedRuntimeContract,
  runId: string,
): ResolvedRuntimeContract {
  const refsBySlug = new Map(
    runtime.contextBundles.map((bundle) => [bundle.slug, runtimeContextBundleMaterializationRef(bundle.slug, runId)]),
  );

  return resolvedRuntimeContractSchema.parse({
    ...runtime,
    contextBundles: runtime.contextBundles.map((bundle) => ({
      ...bundle,
      source: {
        ...bundle.source,
        metadata: {
          ...bundle.source.metadata,
          materializationRef: refsBySlug.get(bundle.slug),
        },
      },
    })),
    mounts: runtime.mounts.map((mount) => {
      if (mount.kind !== "contextBundle") {
        return mount;
      }

      const matchingBundle = runtime.contextBundles.find((bundle) => bundle.mountPath === mount.target);
      if (matchingBundle) {
        return { ...mount, sourceRef: refsBySlug.get(matchingBundle.slug) };
      }

      const bySourceRef = mount.sourceRef ? refsBySlug.get(mount.sourceRef) : undefined;
      if (bySourceRef) {
        return { ...mount, sourceRef: bySourceRef };
      }

      return mount;
    }),
  });
}

function now(): string {
  return new Date().toISOString();
}

function id(): string {
  return crypto.randomUUID();
}

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

function parseJsonObject(row: Row, field: string, recordId: string): Record<string, unknown> {
  const raw = stringField(row, field);
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("value is not an object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(`Invalid JSON in ${field} for record ${recordId}: ${detail}`);
  }
}

function parseIssueSnapshot(raw: string, recordId: string) {
  try {
    return issueSnapshotSchema.parse(JSON.parse(raw) as unknown);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(`Invalid JSON in issue_snapshot for record ${recordId}: ${detail}`);
  }
}

function parseJsonResult(row: Row, field: string, recordId: string): RunResult | undefined {
  const raw = nullableStringField(row, field);
  if (!raw) {
    return undefined;
  }
  try {
    return runResultSchema.parse(JSON.parse(raw) as unknown);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(`Invalid JSON in ${field} for record ${recordId}: ${detail}`);
  }
}

function parseResolvedRuntime(row: Row, field: string, recordId: string): ResolvedRuntimeContract | undefined {
  const raw = nullableStringField(row, field);
  if (!raw) {
    return undefined;
  }
  try {
    return resolvedRuntimeContractSchema.parse(JSON.parse(raw) as unknown);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(`Invalid JSON in ${field} for record ${recordId}: ${detail}`);
  }
}

function parseContextBundleSource(row: Row, field: string, recordId: string): ContextBundle["source"] {
  const raw = stringField(row, field);
  try {
    return contextBundleSchema.shape.source.parse(JSON.parse(raw) as unknown);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(`Invalid JSON in ${field} for record ${recordId}: ${detail}`);
  }
}

function normalizeRunnerCapabilities(input: unknown): PlatformCapabilities {
  const parsed = platformCapabilitiesSchema.parse(
    input ?? { agents: ["codex", "copilot"], executor: "fake" },
  );
  if (parsed.executor !== "docker") {
    return parsed;
  }

  return {
    ...parsed,
    providers: parsed.providers.length > 0 ? parsed.providers : ["docker"],
    contextBundleModes: parsed.contextBundleModes.length > 0
      ? parsed.contextBundleModes
      : ["read-only", "job-scoped"],
    mountKinds: parsed.mountKinds.length > 0
      ? parsed.mountKinds
      : ["workspace", "gitMirror", "cache", "contextBundle", "secret"],
    portExposure: parsed.portExposure.supportsDynamicHostPorts
      ? parsed.portExposure
      : { supportsDynamicHostPorts: true },
    secretInjectionModes: parsed.secretInjectionModes.length > 0
      ? parsed.secretInjectionModes
      : ["env"],
  };
}

function runnerSupportsRuntime(
  capabilities: PlatformCapabilities,
  agent: AgentName,
  runtime: ResolvedRuntimeContract | undefined,
): boolean {
  if (!runtime || !capabilities.agents.includes(agent)) {
    return false;
  }
  if (runtime.provider === "docker" && capabilities.executor !== "docker") {
    return false;
  }
  if (!capabilities.providers.includes(runtime.provider)) {
    return false;
  }
  if (runtime.contextBundles.some((bundle) => !capabilities.contextBundleModes.includes(bundle.accessMode))) {
    return false;
  }
  if (runtime.mounts.some((mount) => !capabilities.mountKinds.includes(mount.kind))) {
    return false;
  }
  if (runtime.exposedPorts.length > 0 && !capabilities.portExposure.supportsDynamicHostPorts) {
    return false;
  }
  if (runtime.secrets.some((secret) => !capabilities.secretInjectionModes.includes(secret.mode))) {
    return false;
  }
  return true;
}

function publicRunner(runner: RunnerSession): PublicRunnerSession {
  const { token: _token, ...publicSession } = runner;
  void _token;
  return publicSession;
}

export class SqliteRdbProvider implements RdbProvider {
  private readonly db: Database.Database;

  constructor(dbPath = ":memory:") {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(sqliteMigrations);
  }

  close(): void {
    this.db.close();
  }

  createProject(input: ProjectCreate): Project {
    const parsed = projectCreateSchema.parse(input);
    const timestamp = now();
    const runtime = projectRuntimeConfigSchema.parse(parsed.runtime);
    const project: Project = projectSchema.parse({
      id: id(),
      ...parsed,
      runtime,
      archivedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    try {
      this.db.prepare(`
        INSERT INTO projects (
          id, name, slug, repo, base_branch, default_agent, runtime,
          prewarm_config, metadata, archived_at, created_at, updated_at
        )
        VALUES (
          @id, @name, @slug, @repo, @baseBranch, @defaultAgent, @runtime,
          @prewarmConfig, @metadata, @archivedAt, @createdAt, @updatedAt
        )
      `).run({
        id: project.id,
        name: project.name,
        slug: project.slug,
        repo: project.repo,
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
    const rows = this.db.prepare(
      options.includeArchived
        ? "SELECT * FROM projects ORDER BY created_at DESC"
        : "SELECT * FROM projects WHERE archived_at IS NULL ORDER BY created_at DESC",
    ).all() as Row[];
    return rows.map((row) => this.projectFromRow(row));
  }

  getProjectById(projectId: string): Project | undefined {
    const row = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as Row | undefined;
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
    const nextRuntime = projectRuntimeConfigSchema.parse(update.runtime ?? current.runtime);
    const next: Project = projectSchema.parse({
      ...current,
      ...update,
      runtime: nextRuntime,
      updatedAt: now(),
    });

    try {
      this.db.prepare(`
        UPDATE projects
        SET name = @name,
            slug = @slug,
            repo = @repo,
            base_branch = @baseBranch,
            default_agent = @defaultAgent,
            runtime = @runtime,
            prewarm_config = @prewarmConfig,
            metadata = @metadata,
            archived_at = @archivedAt,
            updated_at = @updatedAt
        WHERE id = @id
      `).run({
        id: next.id,
        name: next.name,
        slug: next.slug,
        repo: next.repo,
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
    return this.updateProject(slug, { archivedAt: now() });
  }

  createContextBundle(input: ContextBundleCreate): ContextBundle {
    const parsed = contextBundleCreateSchema.parse(input);
    const timestamp = now();
    const bundle = contextBundleSchema.parse({
      id: id(),
      ...parsed,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    try {
      this.db.prepare(`
        INSERT INTO context_bundles (
          id, slug, display_name, source, access_mode, mount_path,
          freshness, failure_mode, metadata, archived_at, created_at, updated_at
        )
        VALUES (
          @id, @slug, @displayName, @source, @accessMode, @mountPath,
          @freshness, @failureMode, @metadata, @archivedAt, @createdAt, @updatedAt
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
    const rows = this.db.prepare(
      options.includeArchived
        ? "SELECT * FROM context_bundles ORDER BY created_at DESC"
        : "SELECT * FROM context_bundles WHERE archived_at IS NULL ORDER BY created_at DESC",
    ).all() as Row[];
    return rows.map((row) => this.contextBundleFromRow(row));
  }

  createJob(input: unknown): JobSnapshot {
    const parsed = jobSpecSchema.parse(input);
    const project = this.getProjectById(parsed.projectId);
    if (!project) {
      throw new Error(`PROJECT_NOT_FOUND: Project not found: ${parsed.projectId}`);
    }
    if (project.archivedAt) {
      throw new Error(`PROJECT_ARCHIVED: Project is archived: ${project.slug}`);
    }

    const resolved: JobSpec = {
      taskId: parsed.taskId,
      source: parsed.source,
      projectId: parsed.projectId,
      repo: parsed.repo ?? project.repo,
      baseBranch: parsed.baseBranch ?? project.baseBranch,
      branchName: parsed.branchName,
      agent: parsed.agent ?? project.defaultAgent,
      prompt: parsed.prompt,
      ...(parsed.issue ? { issue: parsed.issue } : {}),
      ...(parsed.dispatchKey ? { dispatchKey: parsed.dispatchKey } : {}),
      ...(parsed.mergeRequest ? { mergeRequest: parsed.mergeRequest } : {}),
      ...(parsed.runtime ? { runtime: parsed.runtime } : {}),
      metadata: parsed.metadata,
    };
    const contextBundleSlugs = new Set([
      ...project.runtime.contextBundleRefs.map((bundleRef) => bundleRef.slug),
      ...(parsed.runtime?.contextBundleRefs ?? []).map((bundleRef) => bundleRef.slug),
    ]);
    const contextBundles = [...contextBundleSlugs]
      .map((slug) => this.getContextBundleBySlug(slug))
      .filter((bundle): bundle is ContextBundle => Boolean(bundle));
    const timestamp = now();
    const jobId = id();
    const runId = id();
    const artifactId = id();
    const artifactUri = executionSpecArtifactUri(runId);
    const executionContract = buildExecutionContractReference({
      artifactId,
      uri: artifactUri,
      frozenAt: timestamp,
    });
    const executionSpecArtifact = executionSpecArtifactSchema.parse({
      version: 2,
      kind: "execution-spec",
      jobId,
      runId,
      taskId: resolved.taskId,
      source: resolved.source,
      projectId: resolved.projectId,
      repo: resolved.repo,
      baseBranch: resolved.baseBranch,
      branchName: resolved.branchName,
      agent: resolved.agent,
      prompt: resolved.prompt,
      ...(resolved.issue ? { issue: resolved.issue } : {}),
      ...(resolved.dispatchKey ? { dispatchKey: resolved.dispatchKey } : {}),
      ...(resolved.mergeRequest ? { mergeRequest: resolved.mergeRequest } : {}),
      metadata: resolved.metadata,
      frozenAt: timestamp,
      executionContract,
    });
    const resolvedRuntime = attachExecutionSpecBundle(
      scopeRuntimeContextBundles(resolveRuntimeContract({
        project,
        ...(parsed.runtime ? { override: parsed.runtime } : {}),
        contextBundles,
      }), runId),
      {
        runId,
        artifactUri,
        frozenAt: timestamp,
        executionContract,
        payload: executionSpecArtifact,
      },
    );

    const create = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO jobs (
          id, project_id, task_id, source, repo, base_branch, branch_name,
          agent, prompt, issue_snapshot, dispatch_key, mr_title, mr_body,
          runtime_override, metadata, created_at, updated_at
        )
        VALUES (
          @id, @projectId, @taskId, @source, @repo, @baseBranch, @branchName,
          @agent, @prompt, @issueSnapshot, @dispatchKey, @mrTitle, @mrBody,
          @runtimeOverride, @metadata, @createdAt, @updatedAt
        )
      `).run({
        id: jobId,
        projectId: resolved.projectId,
        taskId: resolved.taskId,
        source: resolved.source,
        repo: resolved.repo,
        baseBranch: resolved.baseBranch,
        branchName: resolved.branchName,
        agent: resolved.agent,
        prompt: resolved.prompt,
        issueSnapshot: resolved.issue ? jsonStringify(resolved.issue) : null,
        dispatchKey: resolved.dispatchKey ?? null,
        mrTitle: resolved.mergeRequest?.title ?? null,
        mrBody: resolved.mergeRequest?.body ?? null,
        runtimeOverride: resolved.runtime ? jsonStringify(resolved.runtime) : null,
        metadata: jsonStringify(resolved.metadata),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      this.db.prepare(`
        INSERT INTO runs (id, job_id, state, attempt, resolved_runtime, created_at, updated_at)
        VALUES (?, ?, 'queued', 1, ?, ?, ?)
      `).run(runId, jobId, jsonStringify(resolvedRuntime), timestamp, timestamp);
      this.db.prepare(`
        INSERT INTO artifacts (id, run_id, job_id, kind, name, uri, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        artifactId,
        runId,
        jobId,
        executionSpecArtifact.kind,
        EXECUTION_SPEC_FILE_NAME,
        artifactUri,
        jsonStringify({
          payload: executionSpecArtifact,
          executionContract,
          bundle: {
            slug: EXECUTION_SPEC_BUNDLE_SLUG,
            mountPath: EXECUTION_SPEC_MOUNT_PATH,
            materializationRef: executionSpecMaterializationRef(runId),
          },
        }),
        timestamp,
      );
      this.insertEvent(runId, jobId, "job.created", "info", { taskId: resolved.taskId }, timestamp);
      this.insertEvent(runId, jobId, "artifact.created", "info", {
        artifactId,
        kind: executionSpecArtifact.kind,
        uri: artifactUri,
      }, timestamp);
      this.insertEvent(runId, jobId, "run.queued", "info", {}, timestamp);
      return jobId;
    });

    let createdJobId: string;
    try {
      createdJobId = create();
    } catch (error) {
      if (
        resolved.dispatchKey
        && error instanceof Error
        && error.message.includes("UNIQUE constraint failed: jobs.dispatch_key")
      ) {
        throw new Error(`DISPATCH_CONFLICT: Issue dispatch already exists: ${resolved.dispatchKey}`);
      }
      throw error;
    }

    const snapshot = this.getJob(createdJobId);
    if (!snapshot) {
      throw new Error("Created job has no snapshot");
    }
    return snapshot;
  }

  getJob(jobId: string): JobSnapshot | undefined {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as Row | undefined;
    if (!row) {
      return undefined;
    }
    return this.snapshotFromJobRow(row);
  }

  getJobByDispatchKey(dispatchKey: string): JobSnapshot | undefined {
    const row = this.db.prepare("SELECT * FROM jobs WHERE dispatch_key = ?").get(dispatchKey) as Row | undefined;
    return row ? this.snapshotFromJobRow(row) : undefined;
  }

  getJobSummary(jobId: string) {
    const snapshot = this.getJob(jobId);
    if (!snapshot) {
      return undefined;
    }

    return projectCoordinationRunSummary({
      job: snapshot.job,
      run: snapshot.run,
      recentEvents: snapshot.events,
      ...(snapshot.project?.slug ? { projectSlug: snapshot.project.slug } : {}),
    });
  }

  getJobByRunId(runId: string): JobSnapshot | undefined {
    const run = this.runById(runId);
    return run ? this.getJob(run.jobId) : undefined;
  }

  listJobs(): JobSnapshot[] {
    const rows = this.db.prepare("SELECT * FROM jobs ORDER BY created_at DESC").all() as Row[];
    return rows.map((row) => this.snapshotFromJobRow(row));
  }

  cancelJob(jobId: string): CancelJobOutcome & { snapshot: JobSnapshot } {
    const snapshot = this.getJob(jobId);
    if (!snapshot) {
      throw new Error(`JOB_NOT_FOUND: Job not found: ${jobId}`);
    }
    const timestamp = now();

    if (activeStates.has(snapshot.run.state) && snapshot.run.state !== "queued" && snapshot.run.state !== "dispatching") {
      // Runner-owned work: record cancellation request metadata, don't terminalize
      const cancellationRequest: CancellationRequestMetadata = {
        requestedAt: timestamp,
      };
      this.db.prepare(`
        UPDATE runs
        SET cancellation_request = ?,
            updated_at = ?
        WHERE id = ?
      `).run(jsonStringify(cancellationRequest), timestamp, snapshot.run.id);
      this.insertEvent(snapshot.run.id, jobId, "cancellation.requested", "warn", { requestedAt: timestamp }, timestamp);
      const updated = this.getJob(jobId);
      if (!updated) {
        throw new Error("Job snapshot lost after cancellation request");
      }
      return { kind: "cancellation_requested", snapshot: updated };
    }

    // Queued/dispatching work: terminalize immediately
    this.transitionRun(snapshot.run.id, "canceled", timestamp);
    if (snapshot.run.assignedRunnerSessionId) {
      this.decrementRunner(snapshot.run.assignedRunnerSessionId);
    }
    this.insertEvent(snapshot.run.id, jobId, "run.canceled", "warn", {}, timestamp);
    const updated = this.getJob(jobId);
    if (!updated) {
      throw new Error("Job snapshot lost after cancellation");
    }
    return { kind: "canceled", snapshot: updated };
  }

  registerRunner(input: RegisterRunnerInput): RunnerSession {
    const timestamp = now();
    const capabilities = normalizeRunnerCapabilities(input.capabilities);
    const session: RunnerSession = {
      id: id(),
      token: id(),
      runnerName: input.runnerName,
      capabilities,
      maxConcurrency: input.maxConcurrency ?? 1,
      activeRunCount: 0,
      staleAfterSeconds: input.staleAfterSeconds ?? 90,
      ...(input.eligibleProjectIds ? { eligibleProjectIds: input.eligibleProjectIds } : {}),
      ...(input.eligibleRuntimeProviders ? { eligibleRuntimeProviders: input.eligibleRuntimeProviders } : {}),
      lastHeartbeatAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.db.prepare(`
      INSERT INTO runner_sessions (
        id, runner_name, token, capabilities, max_concurrency, active_run_count,
        stale_after_seconds, eligible_project_ids, eligible_runtime_providers,
        last_heartbeat_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id,
      session.runnerName,
      session.token,
      jsonStringify(session.capabilities),
      session.maxConcurrency,
      session.activeRunCount,
      session.staleAfterSeconds,
      session.eligibleProjectIds ? jsonStringify(session.eligibleProjectIds) : null,
      session.eligibleRuntimeProviders ? jsonStringify(session.eligibleRuntimeProviders) : null,
      session.lastHeartbeatAt,
      session.createdAt,
      session.updatedAt,
    );
    return session;
  }

  authenticateRunner(token: string | null): RunnerSession | undefined {
    if (!token) {
      return undefined;
    }
    const row = this.db.prepare("SELECT * FROM runner_sessions WHERE token = ?").get(token) as Row | undefined;
    return row ? this.runnerFromRow(row) : undefined;
  }

  heartbeatRunner(runnerId: string): RunnerSession {
    const timestamp = now();
    this.db.prepare("UPDATE runner_sessions SET last_heartbeat_at = ?, updated_at = ? WHERE id = ?")
      .run(timestamp, timestamp, runnerId);
    const row = this.db.prepare("SELECT * FROM runner_sessions WHERE id = ?").get(runnerId) as Row | undefined;
    if (!row) {
      throw new Error(`RUNNER_NOT_FOUND: Runner not found: ${runnerId}`);
    }
    return this.runnerFromRow(row);
  }

  listRunners(): PublicRunnerSession[] {
    const rows = this.db.prepare("SELECT * FROM runner_sessions ORDER BY last_heartbeat_at DESC").all() as Row[];
    return rows.map((row) => publicRunner(this.runnerFromRow(row)));
  }

  claimNextRun(runnerId: string): JobSnapshot | undefined {
    const claim = this.db.transaction(() => {
      const runner = this.runnerById(runnerId);
      if (!runner) {
        throw new Error(`RUNNER_NOT_FOUND: Runner not found: ${runnerId}`);
      }

      // Calculate active work from durable active runs, not activeRunCount
      const activeRuns = this.db.prepare(`
        SELECT COUNT(*) AS count FROM runs
        WHERE assigned_runner_session_id = ?
          AND state IN ('assigned', 'starting', 'running')
      `).get(runnerId) as Row;
      const activeCount = numberField(activeRuns, "count");
      if (activeCount >= runner.maxConcurrency) {
        return undefined;
      }

      // Build eligibility filter for projects
      const eligibleProjectIds = runner.eligibleProjectIds;
      const eligibleRuntimeProviders = runner.eligibleRuntimeProviders;

      const rows = this.db.prepare(`
        SELECT runs.*, jobs.agent AS job_agent, jobs.project_id AS job_project_id
        FROM runs
        JOIN jobs ON jobs.id = runs.job_id
        WHERE state = 'queued'
        ORDER BY runs.created_at ASC
      `).all() as Row[];
      const row = rows.find((candidate) => {
        const runtime = parseResolvedRuntime(candidate, "resolved_runtime", stringField(candidate, "id"));
        const agent = agentNameSchema.parse(stringField(candidate, "job_agent"));
        if (!runnerSupportsRuntime(runner.capabilities, agent, runtime)) {
          return false;
        }
        // Check project eligibility
        if (eligibleProjectIds && eligibleProjectIds.length > 0) {
          const projectId = nullableStringField(candidate, "job_project_id");
          if (!projectId || !eligibleProjectIds.includes(projectId)) {
            return false;
          }
        }
        // Check runtime provider eligibility
        if (eligibleRuntimeProviders && eligibleRuntimeProviders.length > 0 && runtime) {
          if (!eligibleRuntimeProviders.includes(runtime.provider)) {
            return false;
          }
        }
        return true;
      });
      if (!row) {
        return undefined;
      }
      const runId = stringField(row, "id");
      const jobId = stringField(row, "job_id");
      const timestamp = now();
      this.db.prepare(`
        UPDATE runs
        SET state = 'assigned',
            assigned_runner_session_id = ?,
            updated_at = ?
        WHERE id = ?
      `).run(runnerId, timestamp, runId);
      this.db.prepare(`
        UPDATE runner_sessions
        SET active_run_count = active_run_count + 1,
            updated_at = ?
        WHERE id = ?
      `).run(timestamp, runnerId);
      this.insertEvent(runId, jobId, "run.assigned", "info", { runnerSessionId: runnerId }, timestamp);
      return jobId;
    });

    const jobId = claim();
    return jobId ? this.getJob(jobId) : undefined;
  }

  appendRunEvent(runnerId: string, runId: string, input: unknown): RunEvent {
    const run = this.runById(runId);
    if (!run || run.assignedRunnerSessionId !== runnerId) {
      throw new Error("Run is not assigned to this runner");
    }

    const timestamp = now();
    const event = runEventSchema.parse({
      ...(input as Record<string, unknown>),
      runId,
      jobId: run.jobId,
      timestamp,
    });
    this.insertEvent(runId, run.jobId, event.type, event.severity, event.data, timestamp);

    if (event.type === "container.started" && run.state === "assigned") {
      this.transitionRun(run.id, "starting", timestamp);
    }
    if (event.type === "agent.started" && ["assigned", "starting"].includes(run.state)) {
      this.transitionRun(run.id, "running", timestamp);
    }

    return event;
  }

  completeRun(runnerId: string, runId: string, input: unknown): JobSnapshot {
    const run = this.runById(runId);
    if (!run || run.assignedRunnerSessionId !== runnerId) {
      throw new Error("Run is not assigned to this runner");
    }

    const result = runResultSchema.parse(input);
    const timestamp = now();
    this.transitionRun(runId, result.status, timestamp, result);
    this.decrementRunner(runnerId);
    const severity = result.status === "succeeded" || result.status === "waiting_for_review" ? "info" : "error";
    this.insertEvent(runId, run.jobId, `run.${result.status}` as RunEventType, severity, {
      summary: result.summary,
    }, timestamp);

    const snapshot = this.getJob(run.jobId);
    if (!snapshot) {
      throw new Error("Completed run has no job snapshot");
    }
    return snapshot;
  }

  markStaleRunners(): StaleMarkingResult[] {
    const timestamp = now();
    const results: StaleMarkingResult[] = [];

    const runners = this.db.prepare("SELECT * FROM runner_sessions").all() as Row[];
    for (const row of runners) {
      const runnerId = stringField(row, "id");
      const staleAfterSeconds = numberField(row, "stale_after_seconds");
      const lastHeartbeatAt = stringField(row, "last_heartbeat_at");
      const heartbeatAgeMs = new Date(timestamp).getTime() - new Date(lastHeartbeatAt).getTime();
      if (heartbeatAgeMs <= staleAfterSeconds * 1000) {
        continue;
      }

      // Mark active runs as failed with stale reason
      const staleRuns = this.db.prepare(`
        SELECT id FROM runs
        WHERE assigned_runner_session_id = ?
          AND state IN ('assigned', 'starting', 'running')
      `).all(runnerId) as Row[];

      const staleRunIds: string[] = [];
      for (const runRow of staleRuns) {
        const runId = stringField(runRow, "id");
        staleRunIds.push(runId);
        this.db.prepare(`
          UPDATE runs
          SET state = 'failed',
              stale_reason = 'runner_stale',
              stale_marked_at = ?,
              failure_reason = 'Runner session stopped reporting heartbeats',
              finished_at = ?,
              updated_at = ?
          WHERE id = ?
        `).run(timestamp, timestamp, timestamp, runId);
        this.insertEvent(runId, this.runById(runId)?.jobId ?? "", "run.stale_marked", "error", {
          reason: "runner_stale",
          runnerSessionId: runnerId,
        }, timestamp);
        this.decrementRunner(runnerId);
      }

      if (staleRunIds.length > 0) {
        results.push({ runnerSessionId: runnerId, staleRunIds });
      }
    }

    return results;
  }

  private projectFromRow(row: Row): Project {
    const projectId = stringField(row, "id");
    return projectSchema.parse({
      id: projectId,
      name: stringField(row, "name"),
      slug: stringField(row, "slug"),
      repo: stringField(row, "repo"),
      baseBranch: stringField(row, "base_branch"),
      defaultAgent: stringField(row, "default_agent"),
      runtime: projectRuntimeConfigSchema.parse(parseJsonObject(row, "runtime", projectId)),
      prewarmConfig: parseJsonObject(row, "prewarm_config", projectId),
      metadata: parseJsonObject(row, "metadata", projectId),
      archivedAt: nullableStringField(row, "archived_at") ?? null,
      createdAt: stringField(row, "created_at"),
      updatedAt: stringField(row, "updated_at"),
    });
  }

  private contextBundleFromRow(row: Row): ContextBundle {
    const bundleId = stringField(row, "id");
    return contextBundleSchema.parse({
      id: bundleId,
      slug: stringField(row, "slug"),
      displayName: stringField(row, "display_name"),
      source: parseContextBundleSource(row, "source", bundleId),
      accessMode: stringField(row, "access_mode"),
      mountPath: nullableStringField(row, "mount_path"),
      freshness: parseJsonObject(row, "freshness", bundleId),
      failureMode: stringField(row, "failure_mode"),
      metadata: parseJsonObject(row, "metadata", bundleId),
      archivedAt: nullableStringField(row, "archived_at") ?? null,
      createdAt: stringField(row, "created_at"),
      updatedAt: stringField(row, "updated_at"),
    });
  }

  private jobFromRow(row: Row): JobRecord {
    const projectId = nullableStringField(row, "project_id");
    if (!projectId) {
      throw new Error(`Job ${stringField(row, "id")} has no project_id`);
    }
    const mergeTitle = nullableStringField(row, "mr_title");
    const mergeBody = nullableStringField(row, "mr_body");
    const runtimeOverride = nullableStringField(row, "runtime_override");
    const issueSnapshot = nullableStringField(row, "issue_snapshot");
    const dispatchKey = nullableStringField(row, "dispatch_key");
    const jobId = stringField(row, "id");
    const spec: JobSpec = jobSpecSchema.parse({
      taskId: stringField(row, "task_id"),
      source: stringField(row, "source"),
      projectId,
      repo: stringField(row, "repo"),
      baseBranch: stringField(row, "base_branch"),
      branchName: stringField(row, "branch_name"),
      agent: stringField(row, "agent"),
      prompt: stringField(row, "prompt"),
      ...(issueSnapshot ? { issue: parseIssueSnapshot(issueSnapshot, jobId) } : {}),
      ...(dispatchKey ? { dispatchKey } : {}),
      ...(mergeTitle || mergeBody ? { mergeRequest: { ...(mergeTitle ? { title: mergeTitle } : {}), ...(mergeBody ? { body: mergeBody } : {}) } } : {}),
      ...(runtimeOverride ? { runtime: JSON.parse(runtimeOverride) as unknown } : {}),
      metadata: parseJsonObject(row, "metadata", jobId),
    });
    return {
      id: jobId,
      spec,
      createdAt: stringField(row, "created_at"),
      updatedAt: stringField(row, "updated_at"),
    };
  }

  private runFromRow(row: Row): RunRecord {
    const runId = stringField(row, "id");
    const assignedRunnerSessionId = nullableStringField(row, "assigned_runner_session_id");
    const result = parseJsonResult(row, "result", runId);
    const resolvedRuntime = parseResolvedRuntime(row, "resolved_runtime", runId);
    const failureReason = nullableStringField(row, "failure_reason");
    const startedAt = nullableStringField(row, "started_at");
    const finishedAt = nullableStringField(row, "finished_at");
    const cancellationRequestRaw = nullableStringField(row, "cancellation_request");
    const staleReason = nullableStringField(row, "stale_reason");
    const staleMarkedAt = nullableStringField(row, "stale_marked_at");
    let cancellationRequest: CancellationRequestMetadata | undefined;
    if (cancellationRequestRaw) {
      try {
        cancellationRequest = JSON.parse(cancellationRequestRaw) as CancellationRequestMetadata;
      } catch {
        cancellationRequest = undefined;
      }
    }
    return {
      id: runId,
      jobId: stringField(row, "job_id"),
      state: stringField(row, "state") as RunState,
      attempt: numberField(row, "attempt"),
      ...(assignedRunnerSessionId ? { assignedRunnerSessionId } : {}),
      ...(resolvedRuntime ? { resolvedRuntime } : {}),
      ...(result ? { result } : {}),
      ...(failureReason ? { failureReason } : {}),
      ...(cancellationRequest ? { cancellationRequest } : {}),
      ...(staleReason ? { staleReason } : {}),
      ...(staleMarkedAt ? { staleMarkedAt } : {}),
      createdAt: stringField(row, "created_at"),
      updatedAt: stringField(row, "updated_at"),
      ...(startedAt ? { startedAt } : {}),
      ...(finishedAt ? { finishedAt } : {}),
    };
  }

  private runnerFromRow(row: Row): RunnerSession {
    const runnerId = stringField(row, "id");
    const eligibleProjectIdsRaw = nullableStringField(row, "eligible_project_ids");
    const eligibleRuntimeProvidersRaw = nullableStringField(row, "eligible_runtime_providers");
    let eligibleProjectIds: string[] | undefined;
    if (eligibleProjectIdsRaw) {
      try {
        eligibleProjectIds = JSON.parse(eligibleProjectIdsRaw) as string[];
      } catch {
        eligibleProjectIds = undefined;
      }
    }
    let eligibleRuntimeProviders: string[] | undefined;
    if (eligibleRuntimeProvidersRaw) {
      try {
        eligibleRuntimeProviders = JSON.parse(eligibleRuntimeProvidersRaw) as string[];
      } catch {
        eligibleRuntimeProviders = undefined;
      }
    }
    return {
      id: runnerId,
      token: stringField(row, "token"),
      runnerName: stringField(row, "runner_name"),
      capabilities: platformCapabilitiesSchema.parse(parseJsonObject(row, "capabilities", runnerId)),
      maxConcurrency: numberField(row, "max_concurrency"),
      activeRunCount: numberField(row, "active_run_count"),
      staleAfterSeconds: numberField(row, "stale_after_seconds"),
      ...(eligibleProjectIds ? { eligibleProjectIds } : {}),
      ...(eligibleRuntimeProviders ? { eligibleRuntimeProviders } : {}),
      lastHeartbeatAt: stringField(row, "last_heartbeat_at"),
      createdAt: stringField(row, "created_at"),
      updatedAt: stringField(row, "updated_at"),
    };
  }

  private eventFromRow(row: Row): RunEvent {
    return runEventSchema.parse({
      runId: stringField(row, "run_id"),
      jobId: stringField(row, "job_id"),
      timestamp: stringField(row, "created_at"),
      type: stringField(row, "type"),
      severity: stringField(row, "severity"),
      data: parseJsonObject(row, "data", stringField(row, "id")),
    });
  }

  private projectClaim(projectId: string): ProjectClaim {
    const project = this.getProjectById(projectId);
    if (!project) {
      throw new Error(`PROJECT_NOT_FOUND: Project not found: ${projectId}`);
    }
    return {
      id: project.id,
      slug: project.slug,
      runtime: project.runtime,
      prewarmConfig: project.prewarmConfig,
    };
  }

  private snapshotFromJobRow(row: Row): JobSnapshot {
    const job = this.jobFromRow(row);
    const runRow = this.db.prepare("SELECT * FROM runs WHERE job_id = ? ORDER BY attempt DESC LIMIT 1").get(job.id) as Row | undefined;
    if (!runRow) {
      throw new Error(`Job ${job.id} has no run`);
    }
    const run = this.runFromRow(runRow);
    const eventRows = this.db.prepare("SELECT * FROM run_events WHERE job_id = ? ORDER BY created_at ASC").all(job.id) as Row[];
    const events = eventRows.map((eventRow) => this.eventFromRow(eventRow));
    return {
      job,
      run,
      events,
      project: this.projectClaim(job.spec.projectId),
      ...(run.resolvedRuntime ? { runtime: run.resolvedRuntime } : {}),
    };
  }

  private runnerById(runnerId: string): RunnerSession | undefined {
    const row = this.db.prepare("SELECT * FROM runner_sessions WHERE id = ?").get(runnerId) as Row | undefined;
    return row ? this.runnerFromRow(row) : undefined;
  }

  private runById(runId: string): RunRecord | undefined {
    const row = this.db.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as Row | undefined;
    return row ? this.runFromRow(row) : undefined;
  }

  private insertEvent(
    runId: string,
    jobId: string,
    type: RunEventType,
    severity: RunEventSeverity,
    data: Record<string, unknown>,
    timestamp = now(),
  ): void {
    this.db.prepare(`
      INSERT INTO run_events (id, run_id, job_id, type, severity, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id(), runId, jobId, type, severity, jsonStringify(data), timestamp);
  }

  private transitionRun(runId: string, nextState: RunState, timestamp: string, result?: RunResult): void {
    const run = this.runById(runId);
    if (!run) {
      throw new Error(`RUN_NOT_FOUND: Run not found: ${runId}`);
    }
    assertRunStateTransition(run.state, nextState);
    this.db.prepare(`
      UPDATE runs
      SET state = ?,
          updated_at = ?,
          started_at = COALESCE(started_at, ?),
          finished_at = ?,
          result = COALESCE(?, result),
          failure_reason = COALESCE(?, failure_reason)
      WHERE id = ?
    `).run(
      nextState,
      timestamp,
      nextState === "running" ? timestamp : null,
      terminalStates.has(nextState) ? timestamp : run.finishedAt ?? null,
      result ? jsonStringify(result) : null,
      result && !["succeeded", "waiting_for_review"].includes(result.status)
        ? result.errorMessage ?? result.summary
        : null,
      runId,
    );
  }

  private decrementRunner(runnerId: string): void {
    this.db.prepare(`
      UPDATE runner_sessions
      SET active_run_count = CASE WHEN active_run_count > 0 THEN active_run_count - 1 ELSE 0 END,
          updated_at = ?
      WHERE id = ?
    `).run(now(), runnerId);
  }
}
