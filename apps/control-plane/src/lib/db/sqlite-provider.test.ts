import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { SqliteRdbProvider } from "./sqlite-provider";

const openProviders: SqliteRdbProvider[] = [];

function databasePath(name = "mystra.db"): string {
  return path.join(mkdtempSync(path.join(tmpdir(), "mystra-task-session-")), name);
}

function openProvider(dbPath = ":memory:", clock?: { now: string }): SqliteRdbProvider {
  const provider = new SqliteRdbProvider(dbPath, clock ? { now: () => clock.now } : undefined);
  openProviders.push(provider);
  return provider;
}

afterEach(() => {
  for (const provider of openProviders.splice(0)) {
    provider.close();
  }
});

const remoteRepository = {
  integration: "github",
  provider: "github",
  externalId: "R_kgDOFixture",
  fullName: "Arcadia822/mystra-remote-e2e",
  url: "https://github.com/Arcadia822/mystra-remote-e2e",
  cloneUrl: "https://github.com/Arcadia822/mystra-remote-e2e.git",
  defaultBranch: "main",
  visibility: "private",
  isArchived: false,
  fetchedAt: "2026-07-26T00:00:00.000Z",
} as const;

function createProject(provider: SqliteRdbProvider) {
  return provider.createProject({
    name: "Mystra",
    slug: "mystra",
    repository: remoteRepository,
    baseBranch: "main",
    defaultAgent: "codex",
    runtime: {
      provider: "docker",
      image: "ghcr.io/arcadia/mystra-runner:latest",
      contextBundleRefs: [],
      mounts: [],
      exposedPorts: [],
      cache: { coldStartAllowed: true, entries: [] },
      secretRefs: [],
      overridePolicy: {
        allowImageOverride: false,
        allowContextBundleAdditions: false,
        allowedContextBundleSlugs: [],
      },
      metadata: {},
    },
    prewarmConfig: {},
    metadata: {},
  });
}

function createTask(provider: SqliteRdbProvider) {
  const project = createProject(provider);
  const task = provider.createTask({
    projectId: project.id,
    source: "api",
    objective: "Implement the Task/Session model",
    metadata: {},
  });
  return { project, task };
}

function registerRunner(provider: SqliteRdbProvider, runnerName = "runner-a") {
  return provider.registerRunner({
    runnerName,
    capabilities: {
      agents: ["codex", "copilot"],
      executor: "docker",
      providers: ["docker"],
      contextBundleModes: ["read-only", "session-scoped"],
      mountKinds: ["workspace", "gitMirror", "cache", "contextBundle", "secret"],
      portExposure: { supportsDynamicHostPorts: true },
      secretInjectionModes: ["env", "file"],
    },
    maxConcurrency: 2,
    staleAfterSeconds: 30,
  });
}

describe("schema recognition and destructive reset", () => {
  it("creates only the current Task/Session/Runner schema for a fresh database", () => {
    const dbPath = databasePath();
    openProvider(dbPath).close();
    openProviders.pop();

    const db = new Database(dbPath, { readonly: true });
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{ name: string }>)
      .map((row) => row.name)
      .filter((name) => !name.startsWith("sqlite_"));
    db.close();

    expect(tables).toEqual([
      "artifacts",
      "context_bundles",
      "mystra_schema",
      "projects",
      "runners",
      "session_events",
      "sessions",
      "tasks",
    ]);
  });

  it("rebuilds an exact known legacy fingerprint without deleting the database file", () => {
    const dbPath = databasePath();
    const db = new Database(dbPath);
    // legacy-term-audit: allow -- exact destructive-reset fixture.
    db.exec("CREATE TABLE projects (id TEXT PRIMARY KEY, repo TEXT NOT NULL)");
    // legacy-term-audit: allow -- exact destructive-reset fixture.
    db.exec("CREATE TABLE jobs (id TEXT PRIMARY KEY, project_id TEXT, task_id TEXT, source TEXT, repository_snapshot TEXT, base_branch TEXT, branch_name TEXT, agent TEXT, prompt TEXT, issue_snapshot TEXT, dispatch_key TEXT, mr_title TEXT, mr_body TEXT, runtime_override TEXT, metadata TEXT, created_at TEXT, updated_at TEXT)");
    // legacy-term-audit: allow -- exact destructive-reset fixture.
    db.exec("CREATE TABLE runner_sessions (id TEXT PRIMARY KEY, runner_name TEXT, token TEXT, capabilities TEXT, max_concurrency INTEGER, active_run_count INTEGER, stale_after_seconds INTEGER, eligible_project_ids TEXT, eligible_runtime_providers TEXT, last_heartbeat_at TEXT, created_at TEXT, updated_at TEXT)");
    // legacy-term-audit: allow -- exact destructive-reset fixture.
    db.exec("CREATE TABLE runs (id TEXT PRIMARY KEY, job_id TEXT, state TEXT, attempt INTEGER, assigned_runner_session_id TEXT, resolved_runtime TEXT, started_at TEXT, finished_at TEXT, result TEXT, failure_reason TEXT, cancellation_request TEXT, stale_reason TEXT, stale_marked_at TEXT, created_at TEXT, updated_at TEXT)");
    // legacy-term-audit: allow -- exact destructive-reset fixture.
    db.exec("CREATE TABLE run_events (id TEXT PRIMARY KEY, run_id TEXT, job_id TEXT, type TEXT, severity TEXT, data TEXT, created_at TEXT)");
    db.exec("CREATE TABLE context_bundles (id TEXT PRIMARY KEY, slug TEXT, display_name TEXT, source TEXT, access_mode TEXT, mount_path TEXT, freshness TEXT, failure_mode TEXT, metadata TEXT, archived_at TEXT, created_at TEXT, updated_at TEXT)");
    // legacy-term-audit: allow -- exact destructive-reset fixture.
    db.exec("CREATE TABLE artifacts (id TEXT PRIMARY KEY, run_id TEXT, job_id TEXT, kind TEXT, name TEXT, uri TEXT, metadata TEXT, created_at TEXT)");
    db.close();

    openProvider(dbPath).close();
    openProviders.pop();
    const verified = new Database(dbPath, { readonly: true });
    expect(verified.prepare("SELECT version FROM mystra_schema").pluck().get()).toBe(3);
    expect(verified.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'").pluck().get()).toBe("tasks");
    verified.close();
  });

  it("fails closed for unknown or mixed schemas and preserves their data", () => {
    const dbPath = databasePath();
    const db = new Database(dbPath);
    db.exec("CREATE TABLE customer_data (id TEXT PRIMARY KEY, value TEXT NOT NULL)");
    db.prepare("INSERT INTO customer_data (id, value) VALUES (?, ?)").run("1", "preserve-me");
    db.close();

    expect(() => openProvider(dbPath)).toThrow(/UNKNOWN_DATABASE_SCHEMA/);
    const verified = new Database(dbPath, { readonly: true });
    expect(verified.prepare("SELECT value FROM customer_data WHERE id='1'").pluck().get()).toBe("preserve-me");
    verified.close();

    const mixedPath = databasePath("mixed.db");
    openProvider(mixedPath).close();
    openProviders.pop();
    const mixed = new Database(mixedPath);
    mixed.exec("CREATE TABLE customer_data (id TEXT PRIMARY KEY, value TEXT NOT NULL)");
    mixed.prepare("INSERT INTO customer_data (id, value) VALUES (?, ?)").run("2", "preserve-mixed");
    mixed.close();

    expect(() => openProvider(mixedPath)).toThrow(/UNKNOWN_DATABASE_SCHEMA/);
    const verifiedMixed = new Database(mixedPath, { readonly: true });
    expect(verifiedMixed.prepare("SELECT value FROM customer_data WHERE id='2'").pluck().get()).toBe("preserve-mixed");
    expect(verifiedMixed.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'").pluck().get()).toBe("tasks");
    verifiedMixed.close();
  });
});

describe("Task and Session persistence", () => {
  it("keeps an empty Task valid and supports ten independent sibling Sessions", () => {
    const provider = openProvider();
    const { task } = createTask(provider);
    expect(provider.getTaskSessionSummary(task.id)).toEqual({ sessionCount: 0, activeSessionCount: 0 });

    const sessions = Array.from({ length: 10 }, (_, index) => provider.createSession(task.id, {
      title: `Subtask ${index + 1}`,
      objective: `Complete slice ${index + 1}`,
      branch: `codex/task-session-${index + 1}`,
    }));

    expect(new Set(sessions.map((item) => item.id)).size).toBe(10);
    expect(provider.listSessions(task.id)).toHaveLength(10);
    expect(provider.getTaskSessionSummary(task.id)).toMatchObject({ sessionCount: 10, activeSessionCount: 10 });
    expect(provider.getTask(task.id)).not.toHaveProperty("state");
  });

  it("rejects Task ownership overrides and active branch collisions", () => {
    const provider = openProvider();
    const { project, task } = createTask(provider);
    expect(() => provider.createSession(task.id, {
      title: "Invalid ownership",
      objective: "Attempt to move context",
      branch: "codex/invalid",
      projectId: project.id,
    } as never)).toThrow();

    provider.createSession(task.id, {
      title: "First owner",
      objective: "Use the branch",
      branch: "codex/shared-branch",
    });
    expect(() => provider.createSession(task.id, {
      title: "Second owner",
      objective: "Collide with the branch",
      branch: "codex/shared-branch",
    })).toThrow(/SESSION_BRANCH_CONFLICT/);
  });

  it("atomically reuses the same Task and initial Session for repeated Issue dispatch", () => {
    const provider = openProvider();
    const project = createProject(provider);
    const issue = {
      reference: {
        integration: "linear",
        provider: "linear",
        externalId: "issue-id",
        identifier: "ENG-123",
        url: "https://linear.app/example/issue/ENG-123/example",
      },
      title: "Implement an indicator",
      description: null,
      state: { id: "state-1", name: "Todo" },
      priority: null,
      assignee: null,
      labels: [],
      createdAt: "2026-07-22T00:00:00.000Z",
      updatedAt: "2026-07-23T00:00:00.000Z",
      fetchedAt: "2026-07-23T01:00:00.000Z",
    };
    const input = {
      task: {
        projectId: project.id,
        source: "issue" as const,
        objective: issue.title,
        issue,
        dispatchKey: "linear:issue-id:mystra",
        repository: project.repository,
        metadata: {},
      },
      session: {
        title: "Initial implementation",
        objective: issue.title,
        agent: "copilot" as const,
        branch: "codex/eng-123",
      },
    };

    const first = provider.dispatchIssue(input);
    const repeated = provider.dispatchIssue(input);
    expect(first.created).toBe(true);
    expect(repeated.created).toBe(false);
    expect(repeated.task.id).toBe(first.task.id);
    expect(repeated.session.id).toBe(first.session.id);
  });
});

describe("stable Runner and Session execution transactions", () => {
  it("keeps one Runner ID across registration, rotates credentials and claims each Session once", () => {
    const dbPath = databasePath();
    const provider = openProvider(dbPath);
    const { task } = createTask(provider);
    const session = provider.createSession(task.id, {
      title: "Execute once",
      objective: "Claim atomically",
      branch: "codex/claim-once",
    });
    const firstRegistration = registerRunner(provider);
    const secondRegistration = registerRunner(provider);

    expect(secondRegistration.runner.id).toBe(firstRegistration.runner.id);
    expect(provider.authenticateRunner(firstRegistration.credential)).toBeUndefined();
    expect(provider.authenticateRunner(secondRegistration.credential)?.id).toBe(firstRegistration.runner.id);

    const otherConnection = openProvider(dbPath);
    const firstClaim = provider.claimNextSession(firstRegistration.runner.id);
    const secondClaim = otherConnection.claimNextSession(firstRegistration.runner.id);
    expect(firstClaim?.session.id).toBe(session.id);
    expect(secondClaim).toBeUndefined();
  });

  it("rolls back an invalid terminal result without appending a terminal fact", () => {
    const provider = openProvider();
    const { task } = createTask(provider);
    const session = provider.createSession(task.id, {
      title: "Validate completion",
      objective: "Reject incomplete review evidence",
      branch: "codex/invalid-result",
    });
    const registration = registerRunner(provider);
    provider.claimNextSession(registration.runner.id);

    expect(() => provider.completeSession(registration.runner.id, session.id, {
      status: "waiting_for_review",
      summary: "Missing evidence",
    })).toThrow();
    expect(provider.getSession(session.id)?.state).toBe("assigned");
    expect(provider.listInternalSessionEvents(session.id).map((event) => event.type)).not.toContain("session.waiting_for_review");
  });

  it("marks only active Sessions assigned to a stale Runner", () => {
    const clock = { now: "2026-08-03T00:00:00.000Z" };
    const provider = openProvider(":memory:", clock);
    const { task } = createTask(provider);
    const assigned = provider.createSession(task.id, {
      title: "Assigned",
      objective: "Become stale",
      branch: "codex/stale-assigned",
    });
    const untouched = provider.createSession(task.id, {
      title: "Unassigned",
      objective: "Remain queued",
      branch: "codex/stale-unassigned",
    });
    const registration = registerRunner(provider);
    const claim = provider.claimNextSession(registration.runner.id);
    const claimedId = claim?.session.id;
    const queuedId = claimedId === assigned.id ? untouched.id : assigned.id;
    clock.now = "2026-08-03T00:01:00.000Z";

    const results = provider.markStaleRunners();
    expect(results[0]?.runnerId).toBe(registration.runner.id);
    expect(results[0]?.staleSessionIds).toEqual([claimedId]);
    expect(claimedId ? provider.getSession(claimedId)?.state : undefined).toBe("failed");
    expect(provider.getSession(queuedId)?.state).toBe("queued");
  });
});
