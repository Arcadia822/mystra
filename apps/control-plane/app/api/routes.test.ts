import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetDbForTests } from "@/lib/db";
import { GET as listContextBundles, POST as postContextBundle } from "./context-bundles/route";
import { POST as postJob } from "./jobs/route";
import { POST as postMcp } from "./mcp/route";
import { GET as getProject, PATCH as patchProject, DELETE as deleteProject } from "./projects/[slug]/route";
import { GET as listProjects, POST as postProject } from "./projects/route";
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
    repo: "local/fixture",
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

async function createProject(slug = "local-fixture") {
  const response = await postProject(jsonRequest("http://localhost/api/projects", projectPayload(slug)));
  expect(response.status).toBe(201);
  return await json<{ project: { id: string; slug: string } }>(response);
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "mystra-routes-"));
  process.env.MYSTRA_DB_PATH = path.join(tempDir, "mystra.db");
  resetDbForTests();
});

afterEach(async () => {
  resetDbForTests();
  delete process.env.MYSTRA_DB_PATH;
  await rm(tempDir, { force: true, recursive: true });
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
      repo: "local/invalid-runtime",
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
        ref: "/tmp/mystra-castrel-runner-image/skills",
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
    const snapshot = await json<{ job: { spec: { repo: string; projectId: string } } }>(response);
    expect(snapshot.job.spec.projectId).toBe(created.project.id);
    expect(snapshot.job.spec.repo).toBe("local/fixture");
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
    const snapshot = JSON.parse(jobRpc.result.content[0]?.text ?? "{}") as { job: { spec: { repo: string } } };
    expect(snapshot.job.spec.repo).toBe("local/fixture");
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

    expect(response.status).toBe(400);
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

    expect(createJobTool?.inputSchema.properties.runtime).toEqual(expect.objectContaining({
      additionalProperties: false,
    }));
    expect(createProjectTool?.inputSchema.properties.runtime).toEqual(expect.objectContaining({
      additionalProperties: false,
    }));
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
          repo: "local/invalid-mcp-project",
          defaultAgent: "codex",
          image: "mystra-runner:local",
        },
      },
    }));

    expect(response.status).toBe(400);
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
