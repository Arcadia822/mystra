import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as dbModule from "@/lib/db";
import { getDb, resetDbForTests } from "@/lib/db";
import { GET as listContextBundles, POST as postContextBundle } from "./context-bundles/route";
import { GET as listIntegrations } from "./integrations/route";
import { GET as getIntegrationIssue } from "./integrations/[integration]/issues/[identifier]/route";
import { POST as dispatchIntegrationIssue } from "./integrations/[integration]/issues/[identifier]/dispatch/route";
import { GET as listIntegrationIssues } from "./integrations/[integration]/issues/route";
import { GET as listIntegrationRepositories } from "./integrations/[integration]/repositories/route";
import { GET as resolveIntegrationRepository } from "./integrations/[integration]/repositories/resolve/route";
import { POST as cancelJob } from "./jobs/[id]/cancel/route";
import { GET as getJob } from "./jobs/[id]/route";
import { GET as getJobSummary } from "./jobs/[id]/summary/route";
import { POST as postJob } from "./jobs/route";
import { POST as postMcp } from "./mcp/route";
import { GET as getProject, PATCH as patchProject, DELETE as deleteProject } from "./projects/[slug]/route";
import { GET as listProjects, POST as postProject } from "./projects/route";
import { POST as appendRunnerJobEvent } from "./runner/jobs/[id]/events/route";
import { POST as completeRunnerJob } from "./runner/jobs/[id]/result/route";
import { GET as getRunnerJob } from "./runner/jobs/[id]/route";
import { GET as claimRunnerJob } from "./runner/jobs/route";
import { POST as registerRunner } from "./runner/register/route";

let tempDir: string;

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function json<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

function projectPayload(slug = "local-fixture") {
  return {
    name: "Local Fixture",
    slug,
    repository: {
      integration: "github",
      identifier: "arcadia/mystra-fixture",
    },
    baseBranch: "main",
    defaultAgent: "codex",
    runtime: {
      provider: "docker",
      image: "mystra-runner:local",
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
    prewarmConfig: { manager: "pnpm" },
  };
}

function githubProjectPayload(slug = "github-fixture") {
  return {
    ...projectPayload(slug),
    defaultAgent: "copilot",
  };
}

const githubRepositoryPayload = {
  id: 42,
  full_name: "arcadia/mystra-fixture",
  html_url: "https://github.com/arcadia/mystra-fixture",
  clone_url: "https://github.com/arcadia/mystra-fixture.git",
  default_branch: "main",
  visibility: "private",
  archived: false,
};

const githubIssuePayload = {
  id: 101,
  number: 7,
  title: "Remote issue",
  body: "Exercise the GitHub scoped route.",
  html_url: "https://github.com/arcadia/mystra-fixture/issues/7",
  state: "open",
  state_reason: null,
  assignee: null,
  labels: [],
  created_at: "2026-07-25T01:00:00.000Z",
  updated_at: "2026-07-25T02:00:00.000Z",
};

const linearIssuePayload = {
  id: "linear-issue-101",
  identifier: "MYS-101",
  title: "Ship the demo",
  description: "Complete the vertical slice.",
  url: "https://linear.app/mystra/issue/MYS-101",
  priority: 2,
  priorityLabel: "High",
  state: { id: "state-todo", name: "Todo", type: "unstarted" },
  assignee: null,
  labels: { nodes: [{ id: "label-demo", name: "demo" }] },
  createdAt: "2026-07-23T01:00:00.000Z",
  updatedAt: "2026-07-23T02:00:00.000Z",
};

function stubLinearFetch(
  body: unknown = { data: { issue: linearIssuePayload } },
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const responseBody = url.startsWith("https://api.github.com/")
      ? githubRepositoryPayload
      : body;
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  process.env.LINEAR_API_KEY = "linear-route-test-key";
  return fetchMock;
}

async function createProject(slug = "local-fixture") {
  const response = await postProject(jsonRequest("http://localhost/api/projects", projectPayload(slug)));
  expect(response.status).toBe(201);
  return await json<{ project: { id: string; slug: string } }>(response);
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "mystra-routes-"));
  process.env.MYSTRA_DB_PATH = path.join(tempDir, "mystra.db");
  process.env.MYSTRA_GITHUB_TOKEN = "github-route-test-key";
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify(githubRepositoryPayload), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
  resetDbForTests();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetDbForTests();
  delete process.env.MYSTRA_DB_PATH;
  delete process.env.LINEAR_API_KEY;
  delete process.env.MYSTRA_GITHUB_TOKEN;
  await rm(tempDir, { force: true, recursive: true });
});

describe("Issue Integration API routes", () => {
  it("exposes descriptors, repository capabilities, and scoped GitHub Issues", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/issues")
        ? [githubIssuePayload]
        : url.includes("/user/repos")
          ? [githubRepositoryPayload]
          : githubRepositoryPayload;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));

    const descriptors = await listIntegrations();
    expect(await json<{ integrations: Array<{ name: string }> }>(descriptors))
      .toEqual({
        integrations: [
          { name: "github", provider: "github", capabilities: ["repositories", "issues"] },
          { name: "linear", provider: "linear", capabilities: ["issues"] },
        ],
      });

    const repositories = await listIntegrationRepositories(
      new Request("http://localhost/api/integrations/github/repositories?limit=10"),
      { params: Promise.resolve({ integration: "github" }) },
    );
    expect(repositories.status).toBe(200);
    expect((await json<{ items: Array<{ fullName: string }> }>(repositories)).items[0]?.fullName)
      .toBe("arcadia/mystra-fixture");

    const resolved = await resolveIntegrationRepository(
      new Request(
        "http://localhost/api/integrations/github/repositories/resolve"
        + "?identifier=arcadia%2Fmystra-fixture",
      ),
      { params: Promise.resolve({ integration: "github" }) },
    );
    expect(resolved.status).toBe(200);

    const missingScope = await listIntegrationIssues(
      new Request("http://localhost/api/integrations/github/issues"),
      { params: Promise.resolve({ integration: "github" }) },
    );
    expect(missingScope.status).toBe(400);
    expect(await json(missingScope)).toEqual({
      error: expect.objectContaining({ code: "REPOSITORY_SCOPE_REQUIRED" }),
    });

    const issues = await listIntegrationIssues(
      new Request(
        "http://localhost/api/integrations/github/issues"
        + "?repository=arcadia%2Fmystra-fixture",
      ),
      { params: Promise.resolve({ integration: "github" }) },
    );
    expect(issues.status).toBe(200);
    expect((await json<{ items: Array<{ reference: { identifier: string } }> }>(issues))
      .items[0]?.reference.identifier).toBe("7");
  });

  it("lists and gets normalized Linear Issues", async () => {
    const fetchMock = stubLinearFetch({
      data: {
        issues: {
          nodes: [linearIssuePayload],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    });
    const listed = await listIntegrationIssues(
      new Request("http://localhost/api/integrations/linear/issues?limit=10&cursor=opaque"),
      { params: Promise.resolve({ integration: "linear" }) },
    );

    expect(listed.status).toBe(200);
    expect(await json(listed)).toEqual({
      items: [expect.objectContaining({
        reference: expect.objectContaining({ identifier: "MYS-101" }),
        title: "Ship the demo",
      })],
      pageInfo: { hasNextPage: false, endCursor: null },
    });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      data: { issue: linearIssuePayload },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const read = await getIntegrationIssue(
      new Request("http://localhost/api/integrations/linear/issues/MYS-101"),
      { params: Promise.resolve({ integration: "linear", identifier: "MYS-101" }) },
    );
    expect(read.status).toBe(200);
    expect(await json(read)).toEqual({
      issue: expect.objectContaining({
        reference: expect.objectContaining({ externalId: "linear-issue-101" }),
      }),
    });
  });

  it("returns stable structured errors for missing Integrations, Issues, and GraphQL failures", async () => {
    stubLinearFetch({ data: { issue: null } });

    const missingIntegration = await getIntegrationIssue(
      new Request("http://localhost/api/integrations/missing/issues/MYS-101"),
      { params: Promise.resolve({ integration: "missing", identifier: "MYS-101" }) },
    );
    expect(missingIntegration.status).toBe(404);
    expect(await json(missingIntegration)).toEqual({
      error: expect.objectContaining({ code: "INTEGRATION_NOT_FOUND" }),
    });

    const missingIssue = await getIntegrationIssue(
      new Request("http://localhost/api/integrations/linear/issues/MYS-404"),
      { params: Promise.resolve({ integration: "linear", identifier: "MYS-404" }) },
    );
    expect(missingIssue.status).toBe(404);
    expect(await json(missingIssue)).toEqual({
      error: expect.objectContaining({ code: "ISSUE_NOT_FOUND" }),
    });

    stubLinearFetch({
      data: { issue: linearIssuePayload },
      errors: [{ message: "partial failure" }],
    });
    const graphQlFailure = await getIntegrationIssue(
      new Request("http://localhost/api/integrations/linear/issues/MYS-101"),
      { params: Promise.resolve({ integration: "linear", identifier: "MYS-101" }) },
    );
    expect(graphQlFailure.status).toBe(502);
    expect(await json(graphQlFailure)).toEqual({
      error: expect.objectContaining({ code: "INTEGRATION_UPSTREAM_ERROR" }),
    });
  });

  it("refetches exactly once and atomically freezes an Issue during dispatch", async () => {
    const fetchMock = stubLinearFetch();
    const projectResponse = await postProject(jsonRequest(
      "http://localhost/api/projects",
      githubProjectPayload("issue-dispatch"),
    ));
    const project = await json<{ project: { id: string } }>(projectResponse);
    fetchMock.mockClear();

    const response = await dispatchIntegrationIssue(
      jsonRequest("http://localhost/api/integrations/linear/issues/MYS-101/dispatch", {
        projectId: project.project.id,
        agent: "copilot",
        branchName: "codex/mys-101-demo",
      }),
      { params: Promise.resolve({ integration: "linear", identifier: "MYS-101" }) },
    );

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const snapshot = await json<{
      job: {
        id: string;
        spec: {
          taskId: string;
          source: string;
          issue: typeof linearIssuePayload & { reference: { identifier: string } };
          dispatchKey: string;
          prompt: string;
          mergeRequest: { title: string; body: string };
        };
      };
    }>(response);
    expect(snapshot.job.spec).toEqual(expect.objectContaining({
      taskId: "MYS-101",
      source: "issue",
      issue: expect.objectContaining({
        reference: expect.objectContaining({ identifier: "MYS-101" }),
        title: "Ship the demo",
      }),
      dispatchKey: expect.stringContaining(`linear:linear-issue-101:${project.project.id}:codex/mys-101-demo`),
      prompt: expect.stringContaining("Complete the vertical slice."),
      mergeRequest: {
        title: "[MYS-101] Ship the demo",
        body: expect.stringContaining("https://linear.app/mystra/issue/MYS-101"),
      },
    }));
    expect(getDb().listJobs()).toHaveLength(1);
  });

  it("returns the existing Job ID on duplicate dispatch without creating a second Job", async () => {
    stubLinearFetch();
    const project = await json<{ project: { id: string } }>(
      await postProject(jsonRequest(
        "http://localhost/api/projects",
        githubProjectPayload("issue-dispatch-duplicate"),
      )),
    );
    const dispatch = () =>
      dispatchIntegrationIssue(
        jsonRequest("http://localhost/api/integrations/linear/issues/MYS-101/dispatch", {
          projectId: project.project.id,
          agent: "copilot",
          branchName: "codex/mys-101-demo",
        }),
        { params: Promise.resolve({ integration: "linear", identifier: "MYS-101" }) },
      );

    const first = await json<{ job: { id: string } }>(await dispatch());
    const duplicate = await dispatch();

    expect(duplicate.status).toBe(409);
    expect(await json(duplicate)).toEqual({
      error: expect.objectContaining({
        code: "DISPATCH_CONFLICT",
        details: { existingJobId: first.job.id },
      }),
    });
    expect(getDb().listJobs()).toHaveLength(1);
  });

  it("rejects invalid Project, Agent, and runtime with zero partial Jobs", async () => {
    stubLinearFetch();
    const localProject = await createProject("not-github");
    const cases = [
      {
        body: {
          projectId: crypto.randomUUID(),
          agent: "copilot",
          branchName: "codex/missing-project",
        },
      },
      {
        body: {
          projectId: localProject.project.id,
          agent: "unknown",
          branchName: "codex/invalid-agent",
        },
      },
      {
        body: {
          projectId: localProject.project.id,
          agent: "copilot",
          branchName: "codex/invalid-runtime",
          runtime: { provider: "kubernetes" },
        },
      },
    ];

    for (const [index, entry] of cases.entries()) {
      const response = await dispatchIntegrationIssue(
        jsonRequest("http://localhost/api/integrations/linear/issues/MYS-101/dispatch", entry.body),
        { params: Promise.resolve({ integration: "linear", identifier: "MYS-101" }) },
      );
      expect(response.status).toBe(index === 0 ? 404 : 400);
    }
    expect(getDb().listJobs()).toHaveLength(0);
  });

  it("creates no Job when the dispatch-time Linear refetch fails", async () => {
    stubLinearFetch({ errors: [{ message: "upstream failed" }] });
    const project = await json<{ project: { id: string } }>(
      await postProject(jsonRequest(
        "http://localhost/api/projects",
        githubProjectPayload("issue-dispatch-atomic"),
      )),
    );

    const response = await dispatchIntegrationIssue(
      jsonRequest("http://localhost/api/integrations/linear/issues/MYS-101/dispatch", {
        projectId: project.project.id,
        agent: "copilot",
        branchName: "codex/mys-101-demo",
      }),
      { params: Promise.resolve({ integration: "linear", identifier: "MYS-101" }) },
    );

    expect(response.status).toBe(502);
    expect(getDb().listJobs()).toHaveLength(0);
  });
});

describe("Project API routes", () => {
  it("creates, lists, reads, archives, and restores Projects", async () => {
    const created = await createProject();

    const listed = await json<{ projects: Array<{ slug: string }> }>(
      await listProjects(new Request("http://localhost/api/projects")),
    );
    expect(listed.projects.map((project) => project.slug)).toEqual(["local-fixture"]);

    const read = await json<{ project: { id: string; prewarmConfig: Record<string, unknown> } }>(
      await getProject(new Request("http://localhost/api/projects/local-fixture"), {
        params: Promise.resolve({ slug: "local-fixture" }),
      }),
    );
    expect(read.project.id).toBe(created.project.id);
    expect(read.project.prewarmConfig).toEqual({ manager: "pnpm" });

    const archived = await deleteProject(new Request("http://localhost/api/projects/local-fixture"), {
      params: Promise.resolve({ slug: "local-fixture" }),
    });
    expect(archived.status).toBe(200);
    expect((await json<{ projects: unknown[] }>(await listProjects(new Request("http://localhost/api/projects")))).projects)
      .toHaveLength(0);

    const restored = await patchProject(jsonRequest("http://localhost/api/projects/local-fixture", { archivedAt: null }), {
      params: Promise.resolve({ slug: "local-fixture" }),
    });
    expect(restored.status).toBe(200);
  });

  it("returns normalized Project errors", async () => {
    await createProject();
    const conflict = await postProject(jsonRequest("http://localhost/api/projects", projectPayload()));

    expect(conflict.status).toBe(409);
    expect(await json(conflict)).toEqual({
      error: {
        code: "PROJECT_SLUG_CONFLICT",
        message: expect.stringContaining("PROJECT_SLUG_CONFLICT"),
      },
    });

    const missing = await getProject(new Request("http://localhost/api/projects/missing"), {
      params: Promise.resolve({ slug: "missing" }),
    });
    expect(missing.status).toBe(404);
    expect(await json(missing)).toEqual({
      error: {
        code: "PROJECT_NOT_FOUND",
        message: "Project not found: missing",
      },
    });
  });

  it("creates Projects with runtime.image and exposes runtime config", async () => {
    const created = await json<{ project: { runtime: { image: string } } }>(
      await postProject(jsonRequest("http://localhost/api/projects", projectPayload("runtime-fixture"))),
    );

    expect(created.project.runtime.image).toBe("mystra-runner:local");
  });

  it("rejects Projects that use top-level image instead of runtime.image", async () => {
    const response = await postProject(jsonRequest("http://localhost/api/projects", {
      name: "Invalid Runtime",
      slug: "invalid-runtime",
      repository: {
        integration: "github",
        identifier: "arcadia/mystra-fixture",
      },
      defaultAgent: "codex",
      image: "mystra-runner:local",
    }));

    expect(response.status).toBe(400);
  });

  it("rejects Project updates that try to add top-level image", async () => {
    await createProject("patch-runtime");

    const response = await patchProject(jsonRequest("http://localhost/api/projects/patch-runtime", {
      image: "mystra-runner:other",
    }), {
      params: Promise.resolve({ slug: "patch-runtime" }),
    });

    expect(response.status).toBe(400);
  });
});

describe("Context bundle API and MCP contracts", () => {
  function contextBundlePayload(slug = "agent-skills") {
    return {
      slug,
      displayName: "Agent Skills",
      source: {
        kind: "local-template",
        ref: "templates/agent-skills",
        metadata: { prompt: "Load project-provided skills." },
      },
      accessMode: "read-only",
      mountPath: "/mystra/skills",
      failureMode: "fail-run",
    };
  }

  it("creates and lists context bundles through HTTP routes", async () => {
    const created = await postContextBundle(jsonRequest(
      "http://localhost/api/context-bundles",
      contextBundlePayload(),
    ));
    expect(created.status).toBe(201);
    const createdBody = await json<{ contextBundle: { slug: string; source: { metadata: Record<string, unknown> } } }>(created);
    expect(createdBody.contextBundle.slug).toBe("agent-skills");
    expect(createdBody.contextBundle.source.metadata.prompt).toBe("Load project-provided skills.");

    const listed = await json<{ contextBundles: Array<{ slug: string }> }>(
      await listContextBundles(new Request("http://localhost/api/context-bundles")),
    );
    expect(listed.contextBundles.map((bundle) => bundle.slug)).toEqual(["agent-skills"]);
  });

  it("rejects duplicate context bundle slugs through HTTP routes", async () => {
    expect((await postContextBundle(jsonRequest(
      "http://localhost/api/context-bundles",
      contextBundlePayload("duplicate-context"),
    ))).status).toBe(201);

    const duplicate = await postContextBundle(jsonRequest(
      "http://localhost/api/context-bundles",
      contextBundlePayload("duplicate-context"),
    ));

    expect(duplicate.status).toBe(409);
  });

  it("creates and lists context bundles through MCP tools", async () => {
    const created = await postMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: "create-context-bundle",
      method: "tools/call",
      params: {
        name: "mystra_create_context_bundle",
        arguments: contextBundlePayload("mcp-context"),
      },
    }));
    expect(created.status).toBe(200);
    const createdRpc = await json<{ result: { content: Array<{ text: string }> } }>(created);
    const bundle = JSON.parse(createdRpc.result.content[0]?.text ?? "{}") as { contextBundle: { slug: string } };
    expect(bundle.contextBundle.slug).toBe("mcp-context");

    const listed = await postMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: "list-context-bundles",
      method: "tools/call",
      params: {
        name: "mystra_list_context_bundles",
        arguments: {},
      },
    }));
    expect(listed.status).toBe(200);
    const listedRpc = await json<{ result: { content: Array<{ text: string }> } }>(listed);
    const payload = JSON.parse(listedRpc.result.content[0]?.text ?? "{}") as { contextBundles: Array<{ slug: string }> };
    expect(payload.contextBundles.map((item) => item.slug)).toEqual(["mcp-context"]);
  });
});

describe("Job and MCP project contracts", () => {
  it("rejects missing projectId and creates a project-based job", async () => {
    const missingProject = await postJob(jsonRequest("http://localhost/api/jobs", {
      taskId: "task-missing-project",
      source: "api",
      branchName: "mystra/missing-project",
      prompt: "Missing projectId",
    }));
    expect(missingProject.status).toBe(400);

    const created = await createProject();
    const response = await postJob(jsonRequest("http://localhost/api/jobs", {
      taskId: "task-1",
      source: "api",
      projectId: created.project.id,
      branchName: "mystra/task-1",
      prompt: "Use the Project defaults",
    }));

    expect(response.status).toBe(201);
    const snapshot = await json<{
      job: { spec: { repository: { fullName: string }; projectId: string } };
      runtime: { executionContract: { bundleSlug: string; filePath: string } };
    }>(response);
    expect(snapshot.job.spec.projectId).toBe(created.project.id);
    expect(snapshot.job.spec.repository.fullName).toBe("arcadia/mystra-fixture");
    expect(snapshot.runtime.executionContract.bundleSlug).toBe("execution-spec");
    expect(snapshot.runtime.executionContract.filePath).toBe("/mystra/context/execution-spec/execution-spec.json");
  });

  it("creates Projects and jobs through MCP tools", async () => {
    const projectResponse = await postMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: "create-project",
      method: "tools/call",
      params: {
        name: "mystra_create_project",
        arguments: projectPayload("mcp-project"),
      },
    }));
    expect(projectResponse.status).toBe(200);
    const projectRpc = await json<{ result: { content: Array<{ text: string }> } }>(projectResponse);
    const project = JSON.parse(projectRpc.result.content[0]?.text ?? "{}") as { id: string };
    expect(project.id).toEqual(expect.any(String));

    const jobResponse = await postMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: "create-job",
      method: "tools/call",
      params: {
        name: "mystra_create_job",
        arguments: {
          taskId: "mcp-task",
          source: "mcp",
          projectId: project.id,
          branchName: "mystra/mcp-task",
          prompt: "Create through MCP",
        },
      },
    }));
    expect(jobResponse.status).toBe(200);
    const jobRpc = await json<{ result: { content: Array<{ text: string }> } }>(jobResponse);
    const snapshot = JSON.parse(jobRpc.result.content[0]?.text ?? "{}") as {
      job: { spec: { repository: { fullName: string } } };
    };
    expect(snapshot.job.spec.repository.fullName).toBe("arcadia/mystra-fixture");
  });

  it("returns the persisted job snapshot through mystra_get_job", async () => {
    const created = await createProject("mcp-get-job");
    const createdJob = await json<{ job: { id: string; spec: { projectId: string } }; run: { state: string } }>(
      await postJob(jsonRequest("http://localhost/api/jobs", {
        taskId: "mcp-get-job-task",
        source: "api",
        projectId: created.project.id,
        branchName: "mystra/mcp-get-job",
        prompt: "Observe this job through MCP",
      })),
    );

    const response = await postMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: "get-job",
      method: "tools/call",
      params: {
        name: "mystra_get_job",
        arguments: {
          jobId: createdJob.job.id,
        },
      },
    }));

    expect(response.status).toBe(200);
    const rpc = await json<{ result: { content: Array<{ text: string }> } }>(response);
    const snapshot = JSON.parse(rpc.result.content[0]?.text ?? "{}") as {
      job: { id: string; spec: { projectId: string } };
      run: { state: string };
      events: Array<{ type: string }>;
    };
    expect(snapshot.job.id).toBe(createdJob.job.id);
    expect(snapshot.job.spec.projectId).toBe(created.project.id);
    expect(snapshot.run.state).toBe("queued");
    expect(snapshot.events.map((event) => event.type)).toEqual(expect.arrayContaining([
      "job.created",
      "run.queued",
    ]));
  });

  it("returns a compact HTTP job summary without raw event history", async () => {
    const created = await createProject("http-job-summary");
    const createdJob = await json<{ job: { id: string } }>(
      await postJob(jsonRequest("http://localhost/api/jobs", {
        taskId: "http-job-summary-task",
        source: "api",
        projectId: created.project.id,
        branchName: "mystra/http-job-summary",
        prompt: "Observe this compact summary through HTTP",
      })),
    );

    const response = await getJobSummary(new Request(`http://localhost/api/jobs/${createdJob.job.id}/summary`), {
      params: Promise.resolve({ id: createdJob.job.id }),
    });

    expect(response.status).toBe(200);
    const payload = await json<{
      summary: {
        runState: string;
        phase: string;
        milestone: { key: string };
        events?: unknown;
        workflow?: unknown;
      };
    }>(response);
    expect(payload.summary.runState).toBe("queued");
    expect(payload.summary.phase).toBe("queued");
    expect(payload.summary.milestone.key).toBe("queued");
    expect(payload.summary).not.toHaveProperty("events");
    expect(payload.summary).not.toHaveProperty("workflow");
  });

  it("returns the compact summary through mystra_get_job_summary", async () => {
    const created = await createProject("mcp-job-summary");
    const createdJob = await json<{ job: { id: string } }>(
      await postJob(jsonRequest("http://localhost/api/jobs", {
        taskId: "mcp-job-summary-task",
        source: "api",
        projectId: created.project.id,
        branchName: "mystra/mcp-job-summary",
        prompt: "Observe this compact summary through MCP",
      })),
    );

    const response = await postMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: "get-job-summary",
      method: "tools/call",
      params: {
        name: "mystra_get_job_summary",
        arguments: {
          jobId: createdJob.job.id,
        },
      },
    }));

    expect(response.status).toBe(200);
    const rpc = await json<{ result: { content: Array<{ text: string }> } }>(response);
    const payload = JSON.parse(rpc.result.content[0]?.text ?? "{}") as {
      summary: {
        runState: string;
        phase: string;
        milestone: { key: string };
      };
    };
    expect(payload.summary.runState).toBe("queued");
    expect(payload.summary.phase).toBe("queued");
    expect(payload.summary.milestone.key).toBe("queued");
  });

  it("returns validated runner payloads through mystra_list_runners", async () => {
    await registerRunner(jsonRequest("http://localhost/api/runner/register", {
      runnerName: "mcp-list-runners",
      capabilities: {
        agents: ["codex"],
        executor: "docker",
      },
      maxConcurrency: 2,
      staleAfterSeconds: 75,
      eligibleRuntimeProviders: ["docker"],
    }));

    const response = await postMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: "list-runners",
      method: "tools/call",
      params: {
        name: "mystra_list_runners",
        arguments: {},
      },
    }));

    expect(response.status).toBe(200);
    const rpc = await json<{ result: { content: Array<{ text: string }> } }>(response);
    const payload = JSON.parse(rpc.result.content[0]?.text ?? "{}") as {
      runners: Array<{
        runnerName: string;
        maxConcurrency: number;
        staleAfterSeconds: number;
        capabilities: { executor: string };
        eligibleRuntimeProviders?: string[];
      }>;
    };
    expect(payload.runners).toEqual(expect.arrayContaining([
      expect.objectContaining({
        runnerName: "mcp-list-runners",
        maxConcurrency: 2,
        staleAfterSeconds: 75,
        capabilities: expect.objectContaining({ executor: "docker" }),
        eligibleRuntimeProviders: ["docker"],
      }),
    ]));
  });

  it("rejects job runtime overrides for MVP-forbidden execution fields", async () => {
    const created = await createProject("forbidden-override");
    const response = await postJob(jsonRequest("http://localhost/api/jobs", {
      taskId: "task-forbidden-runtime",
      source: "api",
      projectId: created.project.id,
      branchName: "mystra/forbidden-runtime",
      prompt: "Try to change execution mounts",
      runtime: {
        mounts: [{ kind: "cache", target: "/mystra/cache/custom", readOnly: false }],
      },
    }));

    expect(response.status).toBe(400);
  });

  it("rejects reserved runtime profile selection until profiles are managed", async () => {
    const created = await createProject("profile-reserved");
    const response = await postJob(jsonRequest("http://localhost/api/jobs", {
      taskId: "task-profile-runtime",
      source: "api",
      projectId: created.project.id,
      branchName: "mystra/profile-runtime",
      prompt: "Try a future runtime profile",
      runtime: {
        runtimeProfile: "frontend-dev",
      },
    }));

    expect(response.status).toBe(400);
  });

  it("rejects MCP job runtime overrides for MVP-forbidden execution fields", async () => {
    const created = await createProject("mcp-forbidden-override");
    const response = await postMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: "create-job-invalid-runtime",
      method: "tools/call",
      params: {
        name: "mystra_create_job",
        arguments: {
          taskId: "mcp-forbidden-runtime",
          source: "mcp",
          projectId: created.project.id,
          branchName: "mystra/mcp-forbidden-runtime",
          prompt: "Create through MCP with invalid runtime override",
          runtime: {
            secretRefs: [{ name: "MYSTRA_GITLAB_TOKEN", mode: "env" }],
          },
        },
      },
    }));

    expect(response.status).toBe(200);
    const rpc = await json<{ error: { code: number; message: string; data?: { tool?: string; issues?: unknown[] } } }>(response);
    expect(rpc.error.code).toBe(-32602);
    expect(rpc.error.message).toBe("Invalid params");
    expect(rpc.error.data?.tool).toBe("mystra_create_job");
    expect(rpc.error.data?.issues).toEqual(expect.any(Array));
  });

  it("advertises constrained runtime schemas in MCP tools/list", async () => {
    const response = await postMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: "tools-list-runtime",
      method: "tools/list",
    }));

    expect(response.status).toBe(200);
    const rpc = await json<{ result: { tools: Array<{ name: string; inputSchema: { properties: Record<string, unknown> } }> } }>(response);
    const createJobTool = rpc.result.tools.find((tool) => tool.name === "mystra_create_job");
    const createProjectTool = rpc.result.tools.find((tool) => tool.name === "mystra_create_project");
    const getJobSummaryTool = rpc.result.tools.find((tool) => tool.name === "mystra_get_job_summary");

    expect(createJobTool?.inputSchema.properties.runtime).toEqual(expect.objectContaining({
      additionalProperties: false,
    }));
    expect(createJobTool?.inputSchema.properties).not.toHaveProperty("repo");
    expect(createJobTool?.inputSchema.properties).not.toHaveProperty("baseBranch");
    expect(createProjectTool?.inputSchema.properties.runtime).toEqual(expect.objectContaining({
      additionalProperties: false,
    }));
    expect(createProjectTool?.inputSchema).toEqual(expect.objectContaining({
      required: expect.arrayContaining(["repository"]),
      properties: expect.objectContaining({
        repository: expect.objectContaining({
          required: ["integration", "identifier"],
          additionalProperties: false,
        }),
      }),
    }));
    expect(createProjectTool?.inputSchema.properties).not.toHaveProperty("repo");
    expect(getJobSummaryTool?.inputSchema).toEqual({
      type: "object",
      required: ["jobId"],
      properties: {
        jobId: { type: "string" },
      },
    });
  });

  it("advertises shared lifecycle handoff metadata in MCP tools/list", async () => {
    const response = await postMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: "tools-list-lifecycle",
      method: "tools/list",
    }));

    expect(response.status).toBe(200);
    const rpc = await json<{
      result: {
        tools: Array<{
          name: string;
          lifecycle?: {
            handoffEvents?: string[];
            terminalEvents?: string[];
          };
        }>;
      };
    }>(response);

    const createJobTool = rpc.result.tools.find((tool) => tool.name === "mystra_create_job");
    const getJobTool = rpc.result.tools.find((tool) => tool.name === "mystra_get_job");

    expect(createJobTool?.lifecycle?.handoffEvents).toEqual([
      "job.created",
      "run.queued",
      "run.assigned",
    ]);
    expect(getJobTool?.lifecycle?.terminalEvents).toEqual([
      "run.succeeded",
      "run.failed",
      "run.canceled",
      "run.timed_out",
      "run.waiting_for_review",
    ]);
  });

  it("rejects MCP Project creation with top-level image", async () => {
    const response = await postMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: "create-project-invalid-image",
      method: "tools/call",
      params: {
        name: "mystra_create_project",
        arguments: {
          name: "Invalid MCP Project",
          slug: "invalid-mcp-project",
          repository: {
            integration: "github",
            identifier: "arcadia/mystra-fixture",
          },
          defaultAgent: "codex",
          image: "mystra-runner:local",
        },
      },
    }));

    expect(response.status).toBe(200);
    const rpc = await json<{ error: { code: number; message: string; data?: { tool?: string; issues?: unknown[] } } }>(response);
    expect(rpc.error.code).toBe(-32602);
    expect(rpc.error.message).toBe("Invalid params");
    expect(rpc.error.data?.tool).toBe("mystra_create_project");
    expect(rpc.error.data?.issues).toEqual(expect.any(Array));
  });

  it("returns MCP health with healthy and degraded runner projection", async () => {
    const healthy = await json<{ runnerSessionId: string }>(await registerRunner(jsonRequest("http://localhost/api/runner/register", {
      runnerName: "runner-healthy",
      capabilities: {
        agents: ["codex"],
        executor: "docker",
      },
      maxConcurrency: 1,
      staleAfterSeconds: 60,
    })));
    const degraded = await json<{ runnerSessionId: string }>(await registerRunner(jsonRequest("http://localhost/api/runner/register", {
      runnerName: "runner-degraded",
      capabilities: {
        agents: ["codex"],
        executor: "docker",
      },
      maxConcurrency: 1,
      staleAfterSeconds: 30,
    })));

    const dbPath = process.env.MYSTRA_DB_PATH;
    expect(dbPath).toBeTruthy();
    const sqlite = new Database(dbPath!);
    const staleTimestamp = new Date(Date.now() - 120_000).toISOString();
    sqlite.prepare("UPDATE runner_sessions SET last_heartbeat_at = ?, updated_at = ? WHERE id = ?")
      .run(staleTimestamp, staleTimestamp, degraded.runnerSessionId);
    sqlite.close();

    const response = await postMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: "health",
      method: "tools/call",
      params: {
        name: "mystra_health",
        arguments: {},
      },
    }));

    expect(response.status).toBe(200);
    const rpc = await json<{ result: { content: Array<{ text: string }> } }>(response);
    const health = JSON.parse(rpc.result.content[0]?.text ?? "{}") as {
      controlPlane: { status: string };
      runnerSummary: { total: number; healthy: number; degraded: number; activeRuns: number };
      runners: Array<{ id: string; status: string }>;
    };

    expect(health.controlPlane.status).toBe("healthy");
    expect(health.runnerSummary).toEqual({
      total: 2,
      healthy: 1,
      degraded: 1,
      activeRuns: 0,
    });
    expect(health.runners).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: healthy.runnerSessionId, status: "healthy" }),
      expect.objectContaining({ id: degraded.runnerSessionId, status: "degraded" }),
    ]));
  });

  it("returns JSON-RPC errors for unknown MCP tools and methods", async () => {
    const unknownTool = await postMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: "unknown-tool",
      method: "tools/call",
      params: {
        name: "mystra_unknown_tool",
        arguments: {},
      },
    }));

    expect(unknownTool.status).toBe(200);
    const unknownToolRpc = await json<{ id: string; error: { code: number; message: string; data?: { tool?: string } } }>(unknownTool);
    expect(unknownToolRpc.id).toBe("unknown-tool");
    expect(unknownToolRpc.error).toEqual({
      code: -32601,
      message: "Unknown tool: mystra_unknown_tool",
      data: { tool: "mystra_unknown_tool" },
    });

    const unknownMethod = await postMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: "unknown-method",
      method: "mystra/not-real",
    }));

    expect(unknownMethod.status).toBe(200);
    const unknownMethodRpc = await json<{ id: string; error: { code: number; message: string } }>(unknownMethod);
    expect(unknownMethodRpc.id).toBe("unknown-method");
    expect(unknownMethodRpc.error).toEqual({
      code: -32601,
      message: "Unknown method: mystra/not-real",
    });
  });

  it("does not leak internal errors through MCP responses", async () => {
    vi.spyOn(dbModule, "getDb").mockReturnValue({
      listRunners() {
        throw new Error("RUNNER_NOT_FOUND: Runner not found: sensitive-runner-id");
      },
    } as unknown as ReturnType<typeof getDb>);

    const response = await postMcp(jsonRequest("http://localhost/api/mcp", {
      jsonrpc: "2.0",
      id: "health-internal-error",
      method: "tools/call",
      params: {
        name: "mystra_health",
        arguments: {},
      },
    }));

    expect(response.status).toBe(200);
    const rpc = await json<{ id: string; error: { code: number; message: string } }>(response);
    expect(rpc.id).toBeNull();
    expect(rpc.error).toEqual({
      code: -32000,
      message: "An internal error occurred processing the MCP request",
    });
  });

  it("returns resolved runtime in runner claim responses", async () => {
    const created = await createProject("claim-runtime");
    await postJob(jsonRequest("http://localhost/api/jobs", {
      taskId: "task-runtime-claim",
      source: "api",
      projectId: created.project.id,
      branchName: "mystra/runtime-claim",
      prompt: "Use the Project runtime",
    }));

    const registered = await json<{ runnerToken: string }>(await registerRunner(jsonRequest("http://localhost/api/runner/register", {
      runnerName: "runner-runtime",
      capabilities: {
        agents: ["codex"],
        executor: "docker",
      },
      maxConcurrency: 1,
    })));

    const claim = await json<{ runtime: { environment: { image: string } } }>(
      await claimRunnerJob(new Request("http://localhost/api/runner/jobs", {
        headers: { authorization: `Bearer ${registered.runnerToken}` },
      })),
    );

    expect(claim.runtime.environment.image).toBe("mystra-runner:local");
  });

  it("stores config-derived runner registration fields", async () => {
    const created = await createProject("runner-registration-config");
    const response = await registerRunner(jsonRequest("http://localhost/api/runner/register", {
      runnerName: "runner-config",
      capabilities: {
        agents: ["codex"],
        executor: "docker",
      },
      maxConcurrency: 2,
      staleAfterSeconds: 45,
      eligibleProjectIds: [created.project.id],
      eligibleRuntimeProviders: ["docker"],
    }));
    expect(response.status).toBe(200);

    const runner = getDb().listRunners()[0];
    expect(runner?.maxConcurrency).toBe(2);
    expect(runner?.staleAfterSeconds).toBe(45);
    expect(runner?.eligibleProjectIds).toEqual([created.project.id]);
    expect(runner?.eligibleRuntimeProviders).toEqual(["docker"]);
  });

  it("exposes cancellation requests and runner observations through existing routes", async () => {
    const created = await createProject("runner-observation-routes");
    const createdJob = await json<{ job: { id: string } }>(await postJob(jsonRequest("http://localhost/api/jobs", {
      taskId: "task-runner-observation-routes",
      source: "api",
      projectId: created.project.id,
      branchName: "mystra/runner-observation-routes",
      prompt: "Cancel through route",
    })));
    const registered = await json<{ runnerToken: string }>(await registerRunner(jsonRequest("http://localhost/api/runner/register", {
      runnerName: "runner-observation",
      capabilities: {
        agents: ["codex"],
        executor: "docker",
      },
      maxConcurrency: 1,
    })));
    const authRequest = (url: string, body: unknown) =>
      new Request(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${registered.runnerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    const claimed = await json<{ run: { id: string; state: string } }>(
      await claimRunnerJob(new Request("http://localhost/api/runner/jobs", {
        headers: { authorization: `Bearer ${registered.runnerToken}` },
      })),
    );
    expect(claimed.run.state).toBe("assigned");

    const cancellation = await json<{ kind: string; snapshot: { run: { cancellationRequest?: { requestedAt: string } } } }>(
      await cancelJob(jsonRequest(`http://localhost/api/jobs/${createdJob.job.id}/cancel`, {}), {
        params: Promise.resolve({ id: createdJob.job.id }),
      }),
    );
    expect(cancellation.kind).toBe("cancellation_requested");
    expect(cancellation.snapshot.run.cancellationRequest?.requestedAt).toEqual(expect.any(String));

    const inspectedRun = await json<{ run: { cancellationRequest?: { requestedAt: string } } }>(
      await getRunnerJob(new Request(`http://localhost/api/runner/jobs/${claimed.run.id}`, {
        headers: { authorization: `Bearer ${registered.runnerToken}` },
      }), {
        params: Promise.resolve({ id: claimed.run.id }),
      }),
    );
    expect(inspectedRun.run.cancellationRequest?.requestedAt).toEqual(expect.any(String));

    const cleanup = await json<{ event: { type: string } }>(await appendRunnerJobEvent(
      authRequest(`http://localhost/api/runner/jobs/${claimed.run.id}/events`, {
        type: "cleanup.started",
        severity: "warn",
        data: { reason: "cancel" },
      }),
      { params: Promise.resolve({ id: claimed.run.id }) },
    ));
    expect(cleanup.event.type).toBe("cleanup.started");

    const result = await json<{ run: { state: string; result?: { status: string } }; events: Array<{ type: string }> }>(
      await completeRunnerJob(
        authRequest(`http://localhost/api/runner/jobs/${claimed.run.id}/result`, {
          status: "canceled",
          summary: "Runner observed cancellation and cleaned up.",
        }),
        { params: Promise.resolve({ id: claimed.run.id }) },
      ),
    );
    expect(result.run.state).toBe("canceled");
    expect(result.run.result?.status).toBe("canceled");
    expect(result.events.map((event) => event.type)).toContain("cleanup.started");
    expect(result.events.map((event) => event.type)).toContain("run.canceled");
  });

  it("exposes stale-marked runs through the existing job inspection route", async () => {
    const created = await createProject("runner-stale-route");
    const createdJob = await json<{ job: { id: string }; run: { id: string } }>(await postJob(jsonRequest("http://localhost/api/jobs", {
      taskId: "task-runner-stale-route",
      source: "api",
      projectId: created.project.id,
      branchName: "mystra/runner-stale-route",
      prompt: "Runner will become stale",
    })));
    const registered = await json<{ runnerToken: string; runnerSessionId: string }>(await registerRunner(jsonRequest("http://localhost/api/runner/register", {
      runnerName: "runner-stale-route",
      capabilities: {
        agents: ["codex"],
        executor: "docker",
      },
      maxConcurrency: 1,
      staleAfterSeconds: 1,
    })));
    await claimRunnerJob(new Request("http://localhost/api/runner/jobs", {
      headers: { authorization: `Bearer ${registered.runnerToken}` },
    }));
    getDb().close();
    resetDbForTests();
    // Test-only timestamp adjustment: stale evaluation itself remains provider-owned.
    const database = new Database(process.env.MYSTRA_DB_PATH ?? "");
    database.prepare("UPDATE runner_sessions SET last_heartbeat_at = ? WHERE id = ?").run(
      "2026-05-10T00:00:00.000Z",
      registered.runnerSessionId,
    );
    database.close();
    resetDbForTests();

    expect(getDb().markStaleRunners()).toEqual([
      { runnerSessionId: registered.runnerSessionId, staleRunIds: [createdJob.run.id] },
    ]);
    const inspected = await json<{ run: { state: string; staleReason?: string }; events: Array<{ type: string }> }>(
      await getJob(new Request(`http://localhost/api/jobs/${createdJob.job.id}`), {
        params: Promise.resolve({ id: createdJob.job.id }),
      }),
    );

    expect(inspected.run.state).toBe("failed");
    expect(inspected.run.staleReason).toBe("runner_stale");
    expect(inspected.events.map((event) => event.type)).toContain("run.stale_marked");
  });

  it("rejects removed workflow lifecycle events from the runner", async () => {
    const created = await createProject("workflow-events-removed");
    const createdJob = await json<{ job: { id: string }; run: { id: string } }>(await postJob(jsonRequest("http://localhost/api/jobs", {
      taskId: "task-workflow-events-removed",
      source: "api",
      projectId: created.project.id,
      branchName: "mystra/workflow-events-removed",
      prompt: "Execute without workflow events",
    })));
    const registered = await json<{ runnerToken: string }>(await registerRunner(jsonRequest("http://localhost/api/runner/register", {
      runnerName: "runner-node-events",
      capabilities: {
        agents: ["codex"],
        executor: "docker",
      },
      maxConcurrency: 1,
    })));
    const authRequest = (url: string, body: unknown) =>
      new Request(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${registered.runnerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    const claimed = await json<{ run: { id: string } }>(
      await claimRunnerJob(new Request("http://localhost/api/runner/jobs", {
        headers: { authorization: `Bearer ${registered.runnerToken}` },
      })),
    );

    const response = await appendRunnerJobEvent(
      authRequest(`http://localhost/api/runner/jobs/${claimed.run.id}/events`, {
        type: "workflow.started",
        severity: "info",
        data: {},
      }),
      { params: Promise.resolve({ id: claimed.run.id }) },
    );
    expect(response.status).toBe(400);

    const inspected = await json<{
      events: Array<{ type: string; data: Record<string, unknown> }>;
    }>(
      await getJob(new Request(`http://localhost/api/jobs/${createdJob.job.id}`), {
        params: Promise.resolve({ id: createdJob.job.id }),
      }),
    );
    expect(inspected.events.map((event) => event.type)).not.toContain("workflow.started");
    expect("workflow" in inspected).toBe(false);
  });

  it("rejects runner registration with untyped capabilities", async () => {
    const response = await registerRunner(jsonRequest("http://localhost/api/runner/register", {
      runnerName: "runner-invalid",
      capabilities: {
        supportsDocker: true,
      },
    }));

    expect(response.status).toBe(400);
  });
});
