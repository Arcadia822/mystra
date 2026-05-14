import { describe, expect, it } from "vitest";
import mvpCodingBlueprintData from "./mvp-coding-blueprint.json" with { type: "json" };
import {
  LocalWorkflowProvider,
  type WorkflowBlueprint,
  type WorkflowExecutionContext,
  type WorkflowExecutionResult,
  type WorkflowNodeKind,
  type WorkflowProvider,
  createWorkflowProviderRegistry,
  mvpCodingBlueprint,
  validateBlueprint,
  workflowBlueprintSchema,
} from "./index.js";

describe("workflow blueprints", () => {
  it("validates the default MVP coding blueprint", () => {
    const blueprint = validateBlueprint(mvpCodingBlueprint);

    expect(blueprint.name).toBe("mvp.coding");
    expect(blueprint.entryNodes).toEqual(["clone"]);
    expect(blueprint.nodes.map((node) => node.id)).toEqual([
      "clone",
      "agent",
      "quality_gate",
      "push",
      "review_create",
    ]);
  });

  it("parses the MVP coding blueprint from JSON data", async () => {
    const blueprint = workflowBlueprintSchema.parse(mvpCodingBlueprintData);
    const provider = new LocalWorkflowProvider({
      blueprints: [blueprint],
    });

    expect(blueprint).toEqual(mvpCodingBlueprint);
    await expect(provider.executeBlueprint(blueprint, {
      workflowInput: {
        repo: "git@example.com:repo.git",
        prompt: "Implement the requested change",
      },
      handlers: {
        "git.clone": async () => ({ workspacePath: "/tmp/repo" }),
        "agent.execute": async () => ({ branchName: "feature/json", changedFiles: ["src/index.ts"] }),
        "quality_gate.run": async () => ({ status: "passed" }),
        "git.push": async ({ branchName }) => ({ branchName }),
        "review.create": async () => ({ reviewUrl: "https://example.invalid/mr/json" }),
      },
    })).resolves.toEqual(expect.objectContaining({
      status: "succeeded",
      outputs: {
        branchName: "feature/json",
        reviewUrl: "https://example.invalid/mr/json",
        qualityGateStatus: "passed",
      },
    }));
  });

  it("rejects cyclic blueprints", () => {
    expect(() => validateBlueprint({
      name: "cycle",
      version: "1.0.0",
      nodes: [
        {
          id: "a",
          kind: "deterministic",
          handler: "git.clone",
          inputBindings: {},
          outputSchema: { workspacePath: "string" },
          metadata: {},
        },
        {
          id: "b",
          kind: "agentic",
          handler: "agent.execute",
          inputBindings: {},
          outputSchema: { patchSummary: "string" },
          metadata: {},
        },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ],
      entryNodes: ["a"],
      outputBindings: {
        branchName: { source: "workflow", key: "branchName" },
      },
    })).toThrow("Blueprint graph must be acyclic");
  });

  it("executes nodes in dependency order and resolves upstream outputs", async () => {
    const provider = new LocalWorkflowProvider({
      blueprints: [mvpCodingBlueprint],
    });
    const executionOrder: string[] = [];

    const result = await provider.executeBlueprint(mvpCodingBlueprint, {
      workflowInput: {
        repo: "git@example.com:repo.git",
        prompt: "Implement the requested change",
        branchName: "feature/workflow",
      },
      handlers: {
        "git.clone": async ({ repo }) => {
          executionOrder.push("clone");
          return { workspacePath: `/tmp/${String(repo).split(":").at(-1)}` };
        },
        "agent.execute": async ({ workspacePath, prompt }) => {
          executionOrder.push("agent");
          expect(workspacePath).toContain("/tmp/");
          expect(prompt).toBe("Implement the requested change");
          return { branchName: "feature/workflow", changedFiles: ["src/index.ts"] };
        },
        "quality_gate.run": async ({ changedFiles }) => {
          executionOrder.push("quality_gate");
          expect(changedFiles).toEqual(["src/index.ts"]);
          return { status: "passed" };
        },
        "git.push": async ({ branchName }) => {
          executionOrder.push("push");
          expect(branchName).toBe("feature/workflow");
          return { branchName };
        },
        "review.create": async ({ branchName }) => {
          executionOrder.push("review_create");
          expect(branchName).toBe("feature/workflow");
          return { reviewUrl: "https://example.invalid/mr/1" };
        },
      },
    });

    expect(executionOrder).toEqual([
      "clone",
      "agent",
      "quality_gate",
      "push",
      "review_create",
    ]);
    expect(result.status).toBe("succeeded");
    expect(result.outputs).toEqual({
      branchName: "feature/workflow",
      reviewUrl: "https://example.invalid/mr/1",
      qualityGateStatus: "passed",
    });
  });

  it("uses the local workflow provider as the default registry selection", () => {
    const registry = createWorkflowProviderRegistry({
      local: new LocalWorkflowProvider({
        blueprints: [mvpCodingBlueprint],
      }),
    });

    expect(registry.get()).toBeInstanceOf(LocalWorkflowProvider);
    expect(registry.get("local")).toBeInstanceOf(LocalWorkflowProvider);
  });

  it("exposes provider metadata and resolves the provider default blueprint", () => {
    const localProvider = new LocalWorkflowProvider({
      blueprints: [mvpCodingBlueprint],
    });
    const registry = createWorkflowProviderRegistry({
      local: localProvider,
    });

    expect(localProvider.providerName).toBe("local");
    expect(localProvider.defaultBlueprint).toBe("mvp.coding");
    expect(localProvider.supportedNodeKinds).toEqual(["deterministic", "agentic"]);
    expect(localProvider.capabilities.parallelNodeExecution).toBe(false);
    expect(registry.resolve()).toEqual({
      provider: localProvider,
      blueprint: mvpCodingBlueprint,
    });
  });

  it("allows a stub workflow provider to be registered and selected", async () => {
    const localProvider = new LocalWorkflowProvider({
      blueprints: [mvpCodingBlueprint],
    });
    const stubBlueprint: WorkflowBlueprint = {
      name: "stub.flow",
      version: "1.0.0",
      nodes: [
        {
          id: "clone",
          kind: "deterministic",
          handler: "git.clone",
          inputBindings: {},
          outputSchema: {
            workspacePath: "string",
          },
          metadata: {},
        },
      ],
      edges: [],
      entryNodes: ["clone"],
      outputBindings: {
        workspacePath: { source: "node", nodeId: "clone", key: "workspacePath" },
      },
    };
    const stubProvider: WorkflowProvider = {
      providerName: "stub",
      defaultBlueprint: stubBlueprint.name,
      supportedNodeKinds: ["deterministic"] as const satisfies readonly WorkflowNodeKind[],
      capabilities: {
        parallelNodeExecution: false,
      },
      loadBlueprint(name: string) {
        if (name !== stubBlueprint.name) {
          throw new Error(`Unknown stub blueprint "${name}"`);
        }
        return stubBlueprint;
      },
      validateBlueprint(blueprint: WorkflowBlueprint) {
        return validateBlueprint(blueprint);
      },
      async executeBlueprint(_blueprint: WorkflowBlueprint, _context: WorkflowExecutionContext): Promise<WorkflowExecutionResult> {
        return {
          status: "succeeded",
          outputs: {
            workspacePath: "/tmp/stub",
          },
          executions: [],
        };
      },
      async resumeExecution(_snapshot, _context) {
        return {
          status: "succeeded",
          outputs: {
            workspacePath: "/tmp/stub",
          },
          executions: [],
        };
      },
      supportsNodeKind(kind: WorkflowNodeKind) {
        return kind === "deterministic";
      },
    };
    const registry = createWorkflowProviderRegistry({
      local: localProvider,
      stub: stubProvider,
    });

    const resolved = registry.resolve("stub");

    expect(resolved.provider).toBe(stubProvider);
    expect(resolved.blueprint).toEqual(stubBlueprint);
    await expect(resolved.provider.executeBlueprint(resolved.blueprint, {
      workflowInput: {},
      handlers: {
        "git.clone": async () => ({ workspacePath: "/tmp/stub" }),
      },
    })).resolves.toEqual(expect.objectContaining({
      status: "succeeded",
      outputs: {
        workspacePath: "/tmp/stub",
      },
    }));
  });

  it("keeps the quality gate node terminal without an MVP retry policy", () => {
    const qualityGateNode = mvpCodingBlueprint.nodes.find((node) => node.id === "quality_gate");

    expect(qualityGateNode?.handler).toBe("quality_gate.run");
    expect(qualityGateNode?.retryPolicy).toBeUndefined();
  });
});
