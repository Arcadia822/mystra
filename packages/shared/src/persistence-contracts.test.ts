import { describe, expect, it } from "vitest";

import {
  integrationCapabilitiesSchema,
  integrationConnectionActivationSchema,
  integrationConnectionSchema,
} from "./integrations.js";
import {
  projectCreateSchema,
  projectSchema,
  taskCreateRequestSchema,
} from "./schemas.js";
import { taskRecordSchema } from "./management.js";

const connectionId = "00000000-0000-4000-8000-000000000040";
const projectId = "00000000-0000-4000-8000-000000000041";

describe("owner-approved persistence contracts", () => {
  it("validates provider-neutral IntegrationConnection capabilities", () => {
    const capabilities = integrationCapabilitiesSchema.parse({
      repositories: {
        state: "enabled",
        config: { selection: "selected" },
        permissions: { contents: "write" },
        accessSummary: { repositoryCount: 3 },
        verifiedAt: "2026-08-06T10:00:00.000Z",
      },
      ci: {
        state: "unavailable",
        config: {},
        permissions: {},
        accessSummary: {},
        verifiedAt: null,
      },
    });

    expect(capabilities.repositories?.state).toBe("enabled");
    expect(() => integrationCapabilitiesSchema.parse({ repositories: { state: "ready" } })).toThrow();

    const activation = integrationConnectionActivationSchema.parse({
      teamId: "00000000-0000-4000-8000-000000000040",
      integration: "github",
      provider: "github-cloud",
      authMethod: "github-app",
      providerExternalId: "18492",
      displayName: null,
      providerSubject: { externalId: "42", login: "arcadia", type: "User" },
      connectionConfig: {},
      capabilities,
      credentialState: "ready",
    });
    const connection = integrationConnectionSchema.parse({
      ...activation,
      id: connectionId,
      status: "active",
      createdAt: "2026-08-06T10:00:00.000Z",
      updatedAt: "2026-08-06T10:00:00.000Z",
    });

    expect(connection.displayName).toBeNull();
    expect(() => integrationConnectionSchema.parse({ ...connection, credentialRef: "secret/ref" })).toThrow();
    expect(() => integrationConnectionSchema.parse({ ...connection, repositorySelection: "selected" })).toThrow();
  });

  it("persists only stable Project repository identity and prefixed branch config", () => {
    const input = projectCreateSchema.parse({
      teamId: "00000000-0000-4000-8000-000000000040",
      name: "Mystra",
      slug: "mystra",
      repositoryConnectionId: connectionId,
      repositoryExternalId: "R_kgDOStable",
      repositoryBaseBranch: "main",
      metadata: {},
    });
    const project = projectSchema.parse({
      ...input,
      id: projectId,
      archivedAt: null,
      createdAt: "2026-08-06T10:00:00.000Z",
      updatedAt: "2026-08-06T10:00:00.000Z",
    });

    expect(project.repositoryExternalId).toBe("R_kgDOStable");
    for (const removed of [
      { repository: { fullName: "Arcadia822/mystra" } },
      { baseBranch: "main" },
      { defaultAgent: "codex" },
      { runtime: { provider: "docker" } },
      { prewarmConfig: {} },
    ]) {
      expect(() => projectSchema.parse({ ...project, ...removed })).toThrow();
    }
  });

  it("limits public Task persistence to owned text and exact context references", () => {
    const input = taskCreateRequestSchema.parse({
      title: "Fix the issue",
      description: null,
      projectId,
      idempotencyKey: "00000000-0000-4000-8000-000000000043",
    });
    const task = taskRecordSchema.parse({
      id: "00000000-0000-4000-8000-000000000042",
      teamId: "00000000-0000-4000-8000-000000000040",
      title: input.title,
      description: input.description,
      projectId: input.projectId,
      issue: null,
      status: "pending",
      metadata: input.metadata,
      statusRevision: 1,
      statusNote: null,
      statusUpdatedAt: "2026-08-06T10:00:00.000Z",
      statusActor: { kind: "system", actorId: null, agentId: null, executionContextId: null, sessionId: null },
      createdAt: "2026-08-06T10:00:00.000Z",
      updatedAt: "2026-08-06T10:00:00.000Z",
    });

    expect(task.issue).toBeNull();
    expect(task.metadata).toEqual({});
    for (const removed of [
      { source: "issue" },
      { objective: "removed" },
      { dispatchKey: "legacy" },
      { issueDispatchKey: "github:repo:issue:42" },
      { repository: { externalId: "repo" } },
    ]) {
      expect(() => taskRecordSchema.parse({ ...task, ...removed })).toThrow();
    }
  });
});
