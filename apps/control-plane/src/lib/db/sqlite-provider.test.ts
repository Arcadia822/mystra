import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SqliteRdbProvider } from "./sqlite-provider";

let tempDir: string;
let dbPath: string;
let db: SqliteRdbProvider;

function projectInput(slug = "castrel-ai") {
  return {
    name: "Castrel AI",
    slug,
    repo: "git@gitlab.example.com:team/castrel-ai.git",
    baseBranch: "main",
    defaultAgent: "codex" as const,
    runtime: {
      provider: "docker" as const,
      image: "registry.example.com/castrel-ai/mystra-runner:latest",
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
    prewarmConfig: { branch: "main" },
    metadata: { owner: "platform" },
  };
}

function corrupt(sql: string, ...params: unknown[]): void {
  db.close();
  const raw = new Database(dbPath);
  raw.prepare(sql).run(...params);
  raw.close();
  db = new SqliteRdbProvider(dbPath);
}

function mutateRaw(sql: string, ...params: unknown[]): void {
  db.close();
  const raw = new Database(dbPath);
  raw.prepare(sql).run(...params);
  raw.close();
  db = new SqliteRdbProvider(dbPath);
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "mystra-sqlite-"));
  dbPath = path.join(tempDir, "mystra.db");
  db = new SqliteRdbProvider(dbPath);
});

afterEach(async () => {
  if (db) {
    db.close();
  }
  await rm(tempDir, { force: true, recursive: true });
});

describe("SqliteRdbProvider projects", () => {
  it("creates, lists, and reopens projects", () => {
    const project = db.createProject(projectInput());

    expect(project.slug).toBe("castrel-ai");
    expect(project.prewarmConfig).toEqual({ branch: "main" });
    expect(db.getProjectBySlug("castrel-ai")?.id).toBe(project.id);
    expect(db.listProjects()).toHaveLength(1);

    db.close();
    db = new SqliteRdbProvider(dbPath);

    expect(db.getProjectBySlug("castrel-ai")?.repo).toBe("git@gitlab.example.com:team/castrel-ai.git");
  });

  it("rejects duplicate slugs", () => {
    db.createProject(projectInput());

    expect(() => db.createProject(projectInput())).toThrow(/PROJECT_SLUG_CONFLICT/);
  });

  it("archives and restores projects", () => {
    db.createProject(projectInput());

    const archived = db.archiveProject("castrel-ai");
    expect(archived?.archivedAt).toEqual(expect.any(String));
    expect(db.listProjects()).toHaveLength(0);
    expect(db.listProjects({ includeArchived: true })).toHaveLength(1);

    const restored = db.updateProject("castrel-ai", { archivedAt: null });
    expect(restored?.archivedAt).toBeNull();
    expect(db.listProjects()).toHaveLength(1);
  });

  it("stores Project runtime config", () => {
    const project = db.createProject(projectInput("runtime-project"));

    expect(project.runtime.image).toBe("registry.example.com/castrel-ai/mystra-runner:latest");

    const runtime = project.runtime;
    const updated = db.updateProject("runtime-project", {
      runtime: {
        ...runtime,
        provider: "docker",
        image: "registry.example.com/runtime/updated-runner:latest",
      },
    });

    expect(updated?.runtime.image).toBe("registry.example.com/runtime/updated-runner:latest");
  });
});

describe("SqliteRdbProvider context bundles", () => {
  it("creates, lists, and reopens context bundles", () => {
    const bundle = db.createContextBundle({
      slug: "agent-skills",
      displayName: "Agent Skills",
      source: { kind: "local-template", ref: "agent-skills" },
      accessMode: "read-only",
      mountPath: "/mystra/skills",
      failureMode: "fail-run",
      metadata: { owner: "project" },
    });

    expect(bundle.slug).toBe("agent-skills");
    expect(db.getContextBundleBySlug("agent-skills")?.mountPath).toBe("/mystra/skills");
    expect(db.listContextBundles()).toHaveLength(1);

    db.close();
    db = new SqliteRdbProvider(dbPath);

    expect(db.getContextBundleBySlug("agent-skills")?.source).toEqual({
      kind: "local-template",
      ref: "agent-skills",
      metadata: {},
    });
  });

  it("rejects duplicate context bundle slugs", () => {
    db.createContextBundle({
      slug: "agent-skills",
      displayName: "Agent Skills",
      source: { kind: "local-template", ref: "agent-skills" },
      accessMode: "read-only",
      failureMode: "fail-run",
    });

    expect(() =>
      db.createContextBundle({
        slug: "agent-skills",
        displayName: "Agent Skills Again",
        source: { kind: "local-template", ref: "agent-skills" },
        accessMode: "read-only",
        failureMode: "fail-run",
      }),
    ).toThrow(/CONTEXT_BUNDLE_SLUG_CONFLICT/);
  });
});

describe("SqliteRdbProvider jobs", () => {
  it("creates jobs with project defaults and durable snapshots", () => {
    const project = db.createProject(projectInput());
    const snapshot = db.createJob({
      taskId: "task-1",
      source: "api",
      projectId: project.id,
      branchName: "mystra/task-1",
      prompt: "Update README",
    });

    expect(snapshot.job.spec.repo).toBe(project.repo);
    expect(snapshot.job.spec.baseBranch).toBe("main");
    expect(snapshot.job.spec.agent).toBe("codex");
    expect(snapshot.run.state).toBe("queued");
    expect(snapshot.runtime?.environment.image).toBe(project.runtime.image);
    expect(snapshot.events.map((event) => event.type)).toEqual(["job.created", "run.queued"]);

    db.updateProject("castrel-ai", { repo: "git@gitlab.example.com:team/changed.git" });
    expect(db.getJob(snapshot.job.id)?.job.spec.repo).toBe(project.repo);
    expect(db.getJob(snapshot.job.id)?.runtime?.environment.image).toBe(project.runtime.image);
  });

  it("allows explicit job overrides", () => {
    const project = db.createProject(projectInput());
    const snapshot = db.createJob({
      taskId: "task-2",
      source: "mcp",
      projectId: project.id,
      repo: "git@github.com:team/override.git",
      baseBranch: "develop",
      branchName: "mystra/task-2",
      agent: "copilot",
      prompt: "Use overrides",
    });

    expect(snapshot.job.spec.repo).toBe("git@github.com:team/override.git");
    expect(snapshot.job.spec.baseBranch).toBe("develop");
    expect(snapshot.job.spec.agent).toBe("copilot");
  });

  it("resolves required context bundles into run snapshots", () => {
    db.createContextBundle({
      slug: "agent-skills",
      displayName: "Agent Skills",
      source: { kind: "local-template", ref: "agent-skills" },
      accessMode: "read-only",
      mountPath: "/mystra/skills",
      failureMode: "fail-run",
    });
    const project = db.createProject({
      ...projectInput("context-project"),
      runtime: {
        ...projectInput("context-project").runtime,
        contextBundleRefs: [{ slug: "agent-skills", required: true, accessMode: "read-only" }],
      },
    });

    const snapshot = db.createJob({
      taskId: "task-context",
      source: "api",
      projectId: project.id,
      branchName: "mystra/context",
      prompt: "Use context",
    });

    expect(snapshot.runtime?.contextBundles[0]).toEqual(expect.objectContaining({
      slug: "agent-skills",
      mountPath: "/mystra/skills",
      source: { kind: "local-template", ref: "agent-skills", metadata: {} },
    }));
    expect(snapshot.runtime?.mounts).toContainEqual({
      kind: "contextBundle",
      owner: "project",
      target: "/mystra/skills",
      sourceRef: "agent-skills",
      readOnly: true,
    });
  });

  it("fails before run creation when a required context bundle is missing", () => {
    const project = db.createProject({
      ...projectInput("missing-context-project"),
      runtime: {
        ...projectInput("missing-context-project").runtime,
        contextBundleRefs: [{ slug: "agent-skills", required: true, accessMode: "read-only" }],
      },
    });

    expect(() =>
      db.createJob({
        taskId: "task-missing-context",
        source: "api",
        projectId: project.id,
        branchName: "mystra/missing-context",
        prompt: "Use missing context",
      }),
    ).toThrow(/RUNTIME_CONTEXT_BUNDLE_NOT_FOUND/);

    expect(db.listJobs()).toHaveLength(0);
  });

  it("rejects missing and archived projects", () => {
    expect(() =>
      db.createJob({
        taskId: "task-missing",
        source: "api",
        projectId: "00000000-0000-4000-8000-000000000099",
        branchName: "mystra/missing",
        prompt: "No project",
      }),
    ).toThrow(/PROJECT_NOT_FOUND/);

    const project = db.createProject(projectInput());
    db.archiveProject("castrel-ai");

    expect(() =>
      db.createJob({
        taskId: "task-archived",
        source: "api",
        projectId: project.id,
        branchName: "mystra/archived",
        prompt: "Archived project",
      }),
    ).toThrow(/PROJECT_ARCHIVED/);
  });
});

describe("SqliteRdbProvider runner lifecycle", () => {
  it("registers, heartbeats, claims, appends events, completes, cancels, and reopens state", () => {
    const project = db.createProject(projectInput());
    const first = db.createJob({
      taskId: "task-runner",
      source: "api",
      projectId: project.id,
      branchName: "mystra/runner",
      prompt: "Run it",
    });
    const runner = db.registerRunner({
      runnerName: "runner-1",
      capabilities: { agents: ["codex"], executor: "docker" },
      maxConcurrency: 1,
    });
    const heartbeat = db.heartbeatRunner(runner.id);
    expect(heartbeat.lastHeartbeatAt).toEqual(expect.any(String));

    const claimed = db.claimNextRun(runner.id);
    expect(claimed?.run.state).toBe("assigned");
    expect(claimed?.project?.runtime.image).toBe(project.runtime.image);
    expect(claimed?.runtime?.environment.image).toBe(project.runtime.image);

    const event = db.appendRunEvent(runner.id, claimed?.run.id ?? "", {
      type: "container.started",
      severity: "info",
      data: { containerId: "abc" },
    });
    expect(event.type).toBe("container.started");
    db.appendRunEvent(runner.id, claimed?.run.id ?? "", {
      type: "agent.started",
      severity: "info",
      data: {},
    });

    const completed = db.completeRun(runner.id, claimed?.run.id ?? "", {
      status: "succeeded",
      summary: "Done",
      branch: "mystra/runner",
    });
    expect(completed.run.state).toBe("succeeded");
    expect(completed.run.result?.summary).toBe("Done");
    expect(db.listRunners()[0]?.activeRunCount).toBe(0);

    const second = db.createJob({
      taskId: "task-cancel",
      source: "api",
      projectId: project.id,
      branchName: "mystra/cancel",
      prompt: "Cancel it",
    });
    expect(db.cancelJob(second.job.id).snapshot.run.state).toBe("canceled");

    db.close();
    db = new SqliteRdbProvider(dbPath);

    expect(db.getJob(first.job.id)?.run.state).toBe("succeeded");
    expect(db.getJob(second.job.id)?.run.state).toBe("canceled");
    expect(db.listRunners()[0]?.runnerName).toBe("runner-1");
  });

  it("only assigns queued runs to runners with compatible runtime capabilities", () => {
    const project = db.createProject(projectInput("runtime-compat"));
    db.createJob({
      taskId: "task-runtime-compat",
      source: "api",
      projectId: project.id,
      branchName: "mystra/runtime-compat",
      prompt: "Use Docker runtime",
    });

    const fakeRunner = db.registerRunner({
      runnerName: "runner-fake",
      capabilities: { agents: ["codex"], executor: "fake" },
      maxConcurrency: 1,
    });
    expect(db.claimNextRun(fakeRunner.id)).toBeUndefined();

    const dockerRunner = db.registerRunner({
      runnerName: "runner-docker",
      capabilities: {
        agents: ["codex"],
        executor: "docker",
        providers: ["docker"],
        contextBundleModes: ["read-only"],
        mountKinds: ["workspace", "gitMirror", "cache"],
        portExposure: { supportsDynamicHostPorts: true },
        secretInjectionModes: ["env"],
      },
      maxConcurrency: 1,
    });
    const claimed = db.claimNextRun(dockerRunner.id);

    expect(claimed?.run.state).toBe("assigned");
    expect(claimed?.runtime?.provider).toBe("docker");
    expect(claimed?.runtime?.environment.image).toBe(project.runtime.image);
  });

  it("persists config-derived runner registration fields across reopen", () => {
    const project = db.createProject(projectInput("eligible-runner"));
    const runner = db.registerRunner({
      runnerName: "runner-configured",
      capabilities: { agents: ["codex"], executor: "docker" },
      maxConcurrency: 2,
      staleAfterSeconds: 45,
      eligibleProjectIds: [project.id],
      eligibleRuntimeProviders: ["docker"],
    });

    expect(runner.maxConcurrency).toBe(2);
    expect(runner.staleAfterSeconds).toBe(45);
    expect(runner.eligibleProjectIds).toEqual([project.id]);
    expect(runner.eligibleRuntimeProviders).toEqual(["docker"]);

    db.close();
    db = new SqliteRdbProvider(dbPath);

    const reopened = db.listRunners()[0];
    expect(reopened?.maxConcurrency).toBe(2);
    expect(reopened?.staleAfterSeconds).toBe(45);
    expect(reopened?.eligibleProjectIds).toEqual([project.id]);
    expect(reopened?.eligibleRuntimeProviders).toEqual(["docker"]);
  });

  it("calculates runner capacity from durable active runs instead of activeRunCount", () => {
    const project = db.createProject(projectInput("durable-capacity"));
    db.createJob({
      taskId: "task-durable-capacity-1",
      source: "api",
      projectId: project.id,
      branchName: "mystra/durable-capacity-1",
      prompt: "First",
    });
    db.createJob({
      taskId: "task-durable-capacity-2",
      source: "api",
      projectId: project.id,
      branchName: "mystra/durable-capacity-2",
      prompt: "Second",
    });
    const runner = db.registerRunner({
      runnerName: "runner-durable-capacity",
      capabilities: { agents: ["codex"], executor: "docker" },
      maxConcurrency: 1,
    });

    expect(db.claimNextRun(runner.id)?.run.state).toBe("assigned");
    mutateRaw("UPDATE runner_sessions SET active_run_count = 0 WHERE id = ?", runner.id);

    expect(db.claimNextRun(runner.id)).toBeUndefined();
  });

  it("respects project and runtime provider eligibility while claiming", () => {
    const ineligibleProject = db.createProject(projectInput("claim-ineligible"));
    const eligibleProject = db.createProject(projectInput("claim-eligible"));
    db.createJob({
      taskId: "task-ineligible-project",
      source: "api",
      projectId: ineligibleProject.id,
      branchName: "mystra/ineligible-project",
      prompt: "Should not be claimed",
    });
    db.createJob({
      taskId: "task-eligible-project",
      source: "api",
      projectId: eligibleProject.id,
      branchName: "mystra/eligible-project",
      prompt: "Should be claimed",
    });
    const wrongRuntimeRunner = db.registerRunner({
      runnerName: "runner-wrong-runtime",
      capabilities: {
        agents: ["codex"],
        executor: "docker",
        providers: ["docker"],
        contextBundleModes: ["read-only"],
        mountKinds: ["workspace", "gitMirror", "cache"],
        portExposure: { supportsDynamicHostPorts: true },
        secretInjectionModes: ["env"],
      },
      maxConcurrency: 1,
      eligibleProjectIds: [eligibleProject.id],
      eligibleRuntimeProviders: ["fake"],
    });
    expect(db.claimNextRun(wrongRuntimeRunner.id)).toBeUndefined();

    const eligibleRunner = db.registerRunner({
      runnerName: "runner-eligible",
      capabilities: {
        agents: ["codex"],
        executor: "docker",
        providers: ["docker"],
        contextBundleModes: ["read-only"],
        mountKinds: ["workspace", "gitMirror", "cache"],
        portExposure: { supportsDynamicHostPorts: true },
        secretInjectionModes: ["env"],
      },
      maxConcurrency: 1,
      eligibleProjectIds: [eligibleProject.id],
      eligibleRuntimeProviders: ["docker"],
    });
    const claimed = db.claimNextRun(eligibleRunner.id);

    expect(claimed?.job.spec.taskId).toBe("task-eligible-project");
    expect(claimed?.project?.id).toBe(eligibleProject.id);
  });

  it("records cancellation request metadata for runner-owned work", () => {
    const project = db.createProject(projectInput("cancel-owned"));
    const snapshot = db.createJob({
      taskId: "task-cancel-owned",
      source: "api",
      projectId: project.id,
      branchName: "mystra/cancel-owned",
      prompt: "Cancel while running",
    });
    const runner = db.registerRunner({
      runnerName: "runner-cancel-owned",
      capabilities: { agents: ["codex"], executor: "docker" },
      maxConcurrency: 1,
    });
    const claimed = db.claimNextRun(runner.id);
    expect(claimed?.job.id).toBe(snapshot.job.id);

    const outcome = db.cancelJob(snapshot.job.id);

    expect(outcome.kind).toBe("cancellation_requested");
    expect(outcome.snapshot.run.state).toBe("assigned");
    expect(outcome.snapshot.run.cancellationRequest?.requestedAt).toEqual(expect.any(String));
    expect(outcome.snapshot.events.map((event) => event.type)).toContain("cancellation.requested");

    db.close();
    db = new SqliteRdbProvider(dbPath);

    expect(db.getJob(snapshot.job.id)?.run.cancellationRequest?.requestedAt).toEqual(expect.any(String));
  });

  it("marks stale runner-owned runs as failed without requeueing or reassigning", () => {
    const project = db.createProject(projectInput("stale-runner"));
    const snapshot = db.createJob({
      taskId: "task-stale-runner",
      source: "api",
      projectId: project.id,
      branchName: "mystra/stale-runner",
      prompt: "Runner disappears",
    });
    const runner = db.registerRunner({
      runnerName: "runner-stale",
      capabilities: { agents: ["codex"], executor: "docker" },
      maxConcurrency: 1,
      staleAfterSeconds: 1,
    });
    expect(db.claimNextRun(runner.id)?.run.id).toBe(snapshot.run.id);
    mutateRaw(
      "UPDATE runner_sessions SET last_heartbeat_at = ? WHERE id = ?",
      "2026-05-10T00:00:00.000Z",
      runner.id,
    );

    const stale = db.markStaleRunners();
    const marked = db.getJob(snapshot.job.id);
    const replacementRunner = db.registerRunner({
      runnerName: "runner-replacement",
      capabilities: { agents: ["codex"], executor: "docker" },
      maxConcurrency: 1,
    });

    expect(stale).toEqual([{ runnerSessionId: runner.id, staleRunIds: [snapshot.run.id] }]);
    expect(marked?.run.state).toBe("failed");
    expect(marked?.run.staleReason).toBe("runner_stale");
    expect(marked?.events.map((event) => event.type)).toContain("run.stale_marked");
    expect(db.claimNextRun(replacementRunner.id)).toBeUndefined();
  });

  it("records cleanup observations before accepting a canceled terminal result", () => {
    const project = db.createProject(projectInput("cleanup-cancel"));
    const snapshot = db.createJob({
      taskId: "task-cleanup-cancel",
      source: "api",
      projectId: project.id,
      branchName: "mystra/cleanup-cancel",
      prompt: "Cancel and clean up",
    });
    const runner = db.registerRunner({
      runnerName: "runner-cleanup-cancel",
      capabilities: { agents: ["codex"], executor: "docker" },
      maxConcurrency: 1,
    });
    const claimed = db.claimNextRun(runner.id);
    expect(claimed?.run.id).toBe(snapshot.run.id);

    db.appendRunEvent(runner.id, snapshot.run.id, {
      type: "container.started",
      severity: "info",
      data: { containerId: "container-cleanup-cancel" },
    });
    db.appendRunEvent(runner.id, snapshot.run.id, {
      type: "agent.started",
      severity: "info",
      data: {},
    });
    db.appendRunEvent(runner.id, snapshot.run.id, {
      type: "cleanup.started",
      severity: "warn",
      data: { reason: "cancel" },
    });

    const canceled = db.completeRun(runner.id, snapshot.run.id, {
      status: "canceled",
      summary: "Runner stopped work after cancellation request.",
    });

    expect(canceled.run.state).toBe("canceled");
    expect(canceled.run.result?.status).toBe("canceled");
    expect(canceled.events.map((event) => event.type)).toEqual([
      "job.created",
      "run.queued",
      "run.assigned",
      "container.started",
      "agent.started",
      "cleanup.started",
      "run.canceled",
    ]);
    expect(db.listRunners()[0]?.activeRunCount).toBe(0);
    expect(() =>
      db.completeRun(runner.id, snapshot.run.id, {
        status: "succeeded",
        summary: "Late success should not overwrite cancellation.",
      }),
    ).toThrow(/Invalid run state transition/);
  });

  it("records cleanup failures and rejects stale terminal observations after timeout", () => {
    const project = db.createProject(projectInput("cleanup-timeout"));
    const snapshot = db.createJob({
      taskId: "task-cleanup-timeout",
      source: "api",
      projectId: project.id,
      branchName: "mystra/cleanup-timeout",
      prompt: "Timeout and clean up",
    });
    const runner = db.registerRunner({
      runnerName: "runner-cleanup-timeout",
      capabilities: { agents: ["codex"], executor: "docker" },
      maxConcurrency: 1,
    });
    expect(db.claimNextRun(runner.id)?.run.id).toBe(snapshot.run.id);

    db.appendRunEvent(runner.id, snapshot.run.id, {
      type: "container.started",
      severity: "info",
      data: { containerId: "container-cleanup-timeout" },
    });
    db.appendRunEvent(runner.id, snapshot.run.id, {
      type: "agent.started",
      severity: "info",
      data: {},
    });
    db.appendRunEvent(runner.id, snapshot.run.id, {
      type: "cleanup.started",
      severity: "warn",
      data: { reason: "timeout" },
    });
    db.appendRunEvent(runner.id, snapshot.run.id, {
      type: "run.cleanup_failed",
      severity: "error",
      data: { summary: "Container stop exceeded cleanup timeout." },
    });

    const timedOut = db.completeRun(runner.id, snapshot.run.id, {
      status: "timed_out",
      summary: "Execution exceeded timeout.",
    });

    expect(timedOut.run.state).toBe("timed_out");
    expect(timedOut.events.map((event) => event.type)).toContain("run.cleanup_failed");
    expect(timedOut.events.map((event) => event.type)).toContain("run.timed_out");
    expect(() =>
      db.completeRun(runner.id, snapshot.run.id, {
        status: "failed",
        summary: "Late failure should not overwrite timeout.",
      }),
    ).toThrow(/Invalid run state transition/);
  });
});

describe("SqliteRdbProvider corrupt JSON handling", () => {
  it("throws with field and record id for corrupt Project JSON", () => {
    const project = db.createProject(projectInput());

    corrupt("UPDATE projects SET prewarm_config = ? WHERE id = ?", "not-json", project.id);
    expect(() => db.getProjectBySlug("castrel-ai")).toThrow(
      new RegExp(`Invalid JSON in prewarm_config for record ${project.id}`),
    );

    corrupt("UPDATE projects SET prewarm_config = ?, metadata = ? WHERE id = ?", "{}", "[]", project.id);
    expect(() => db.getProjectBySlug("castrel-ai")).toThrow(
      new RegExp(`Invalid JSON in metadata for record ${project.id}`),
    );
  });

  it("throws with field and record id for corrupt run, runner, and event JSON", () => {
    const project = db.createProject(projectInput());
    const snapshot = db.createJob({
      taskId: "task-corrupt",
      source: "api",
      projectId: project.id,
      branchName: "mystra/corrupt",
      prompt: "Corrupt records",
    });
    const runner = db.registerRunner({
      runnerName: "runner-corrupt",
      capabilities: { agents: ["codex"], executor: "docker" },
      maxConcurrency: 1,
    });
    const claimed = db.claimNextRun(runner.id);
    db.appendRunEvent(runner.id, claimed?.run.id ?? "", {
      type: "container.started",
      severity: "info",
      data: { containerId: "abc" },
    });
    db.appendRunEvent(runner.id, claimed?.run.id ?? "", {
      type: "agent.started",
      severity: "info",
      data: {},
    });
    db.completeRun(runner.id, claimed?.run.id ?? "", {
      status: "succeeded",
      summary: "Done",
    });

    corrupt("UPDATE runs SET result = ? WHERE id = ?", "not-json", snapshot.run.id);
    expect(() => db.getJob(snapshot.job.id)).toThrow(
      new RegExp(`Invalid JSON in result for record ${snapshot.run.id}`),
    );

    corrupt("UPDATE runs SET result = ? WHERE id = ?", "{\"status\":\"succeeded\",\"summary\":\"Done\"}", snapshot.run.id);
    corrupt("UPDATE runner_sessions SET capabilities = ? WHERE id = ?", "[]", runner.id);
    expect(() => db.listRunners()).toThrow(
      new RegExp(`Invalid JSON in capabilities for record ${runner.id}`),
    );

    corrupt("UPDATE runner_sessions SET capabilities = ? WHERE id = ?", "{\"agents\":[\"codex\"],\"executor\":\"docker\"}", runner.id);
    const raw = new Database(dbPath);
    const eventId = (raw.prepare("SELECT id FROM run_events WHERE job_id = ? LIMIT 1").get(snapshot.job.id) as { id: string }).id;
    raw.close();
    corrupt("UPDATE run_events SET data = ? WHERE id = ?", "not-json", eventId);
    expect(() => db.getJob(snapshot.job.id)).toThrow(
      new RegExp(`Invalid JSON in data for record ${eventId}`),
    );
  });
});
