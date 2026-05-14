import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRunnerWorkflowProviderRegistry } from "./workflow-providers.js";

const tempDirs: string[] = [];

async function writeProviderModule(source: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "mystra-workflow-provider-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, "provider.mjs");
  await writeFile(filePath, source, "utf8");
  return filePath;
}

describe("runner workflow providers", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    }));
  });

  it("loads a startup-registered workflow provider module", async () => {
    const modulePath = await writeProviderModule(`
      const blueprint = {
        name: "stub.flow",
        version: "1.0.0",
        nodes: [
          {
            id: "clone",
            kind: "deterministic",
            handler: "git.clone",
            inputBindings: {},
            outputSchema: { workspacePath: "string" },
            metadata: {},
          },
        ],
        edges: [],
        entryNodes: ["clone"],
        outputBindings: {
          workspacePath: { source: "node", nodeId: "clone", key: "workspacePath" },
        },
      };

      export const workflowProviders = {
        stub: {
          providerName: "stub",
          defaultBlueprint: blueprint.name,
          supportedNodeKinds: ["deterministic"],
          capabilities: { parallelNodeExecution: false },
          loadBlueprint(name) {
            if (name !== blueprint.name) {
              throw new Error(\`Unknown stub blueprint "\${name}"\`);
            }
            return blueprint;
          },
          validateBlueprint(input) {
            return input;
          },
          async executeBlueprint() {
            return { status: "succeeded", outputs: { workspacePath: "/tmp/stub" }, executions: [] };
          },
          async resumeExecution() {
            return { status: "succeeded", outputs: { workspacePath: "/tmp/stub" }, executions: [] };
          },
          supportsNodeKind(kind) {
            return kind === "deterministic";
          },
        },
      };
    `);

    const registry = await createRunnerWorkflowProviderRegistry({
      moduleSpecifiers: [modulePath],
    });
    const resolved = registry.resolve("stub");

    expect(resolved.provider.providerName).toBe("stub");
    expect(resolved.blueprint.name).toBe("stub.flow");
  });

  it("rejects duplicate workflow provider registrations", async () => {
    const modulePath = await writeProviderModule(`
      export default {
        local: {
          providerName: "local",
          defaultBlueprint: "stub.flow",
          supportedNodeKinds: ["deterministic"],
          capabilities: { parallelNodeExecution: false },
          loadBlueprint() {
            return {
              name: "stub.flow",
              version: "1.0.0",
              nodes: [],
              edges: [],
              entryNodes: [],
              outputBindings: {},
            };
          },
          validateBlueprint(input) {
            return input;
          },
          async executeBlueprint() {
            return { status: "succeeded", outputs: {}, executions: [] };
          },
          async resumeExecution() {
            return { status: "succeeded", outputs: {}, executions: [] };
          },
          supportsNodeKind(kind) {
            return kind === "deterministic";
          },
        },
      };
    `);

    await expect(createRunnerWorkflowProviderRegistry({
      moduleSpecifiers: [modulePath],
    })).rejects.toThrow(
      'Workflow provider "local" is already registered',
    );
  });

  it("loads additional local blueprints from startup JSON files", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "mystra-workflow-blueprint-"));
    tempDirs.push(dir);
    const blueprintPath = path.join(dir, "reviewless.flow.json");
    await writeFile(blueprintPath, JSON.stringify({
      name: "reviewless.flow",
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
        {
          id: "push",
          kind: "deterministic",
          handler: "git.push",
          inputBindings: {
            branchName: { source: "workflow", key: "branchName" },
          },
          outputSchema: {
            branchName: "string",
          },
          metadata: {},
        },
      ],
      edges: [{ from: "clone", to: "push" }],
      entryNodes: ["clone"],
      outputBindings: {
        branchName: { source: "node", nodeId: "push", key: "branchName" },
      },
    }, null, 2));

    const registry = await createRunnerWorkflowProviderRegistry({
      blueprintFiles: [blueprintPath],
    });
    const resolved = registry.resolve("local", "reviewless.flow");

    expect(resolved.provider.providerName).toBe("local");
    expect(resolved.blueprint.name).toBe("reviewless.flow");
  });

  it("rejects duplicate startup blueprint names", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "mystra-workflow-blueprint-"));
    tempDirs.push(dir);
    const blueprintPath = path.join(dir, "duplicate.flow.json");
    await writeFile(blueprintPath, JSON.stringify({
      name: "mvp.coding",
      version: "2.0.0",
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
    }, null, 2));

    await expect(createRunnerWorkflowProviderRegistry({
      blueprintFiles: [blueprintPath],
    })).rejects.toThrow("Workflow blueprint names must be unique: mvp.coding");
  });
});
