import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const agentOs = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@rivet-dev/agentos-core", () => ({ AgentOs: agentOs }));
vi.mock("@agentos-software/pi", () => ({ default: { name: "pi" } }));

// @ts-expect-error AgentOS loads this provider bridge as native ESM JavaScript.
import { permissionsForModelEndpoint, runPiInAgentOs } from "./agentos-runner.mjs";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

describe("AgentOS Pi isolation", () => {
  it("allows only the configured HTTPS model endpoint", () => {
    expect(permissionsForModelEndpoint("https://model.example.test:8443/v1")).toEqual({
      fs: "allow",
      childProcess: "allow",
      process: "allow",
      env: "allow",
      binding: "allow",
      network: {
        default: "deny",
        rules: [{ mode: "allow", operations: ["*"], patterns: ["tcp://model.example.test:8443"] }],
      },
    });
    expect(permissionsForModelEndpoint("https://model.example.test/v1").network.rules).toEqual([
      { mode: "allow", operations: ["*"], patterns: ["tcp://model.example.test:443"] },
    ]);
    expect(() => permissionsForModelEndpoint("http://model.example.test/v1")).toThrow("must be HTTPS");
    expect(() => permissionsForModelEndpoint("https://user:secret@model.example.test/v1")).toThrow(
      "must not contain credentials",
    );
  });

  it("removes the ephemeral model credential before any caller prompt runs", async () => {
    const workspaceDirectory = await temporaryDirectory("agentos-workspace-");
    const stateRoot = await temporaryDirectory("agentos-state-");
    const modelConfigPath = path.join(await temporaryDirectory("agentos-model-"), "model.json");
    await writeFile(modelConfigPath, JSON.stringify({
      model: {
        provider: "example",
        baseUrl: "https://model.example.test/v1",
        api: "openai-completions",
        apiKey: "model-secret",
        id: "example-model",
      },
    }));

    const order: string[] = [];
    // Mirror the real `vm.filesystem` surface (AgentOS Core 0.2.19 exposes `remove`,
    // not `removeFile`); a mock named after the call site hides a wrong method name.
    const filesystem = {
      writeFile: vi.fn(async (filePath: string) => {
        if (filePath.endsWith("/models.json")) order.push("write-model");
      }),
      remove: vi.fn(async (filePath: string) => {
        expect(filePath).toBe("/home/agentos/.pi/agent/models.json");
        order.push("remove-model");
      }),
    };
    const vm = {
      filesystem,
      sessions: {
        open: vi.fn(async () => { order.push("open"); }),
        get: vi.fn(async ({ sessionId }: { sessionId: string }) => ({ sessionId, latestSequence: 1 })),
        prompt: vi.fn(async () => {
          order.push("prompt");
          return { stopReason: "end_turn", message: { content: [{ type: "text", text: "done" }] } };
        }),
        cancelPrompt: vi.fn(async () => ({ status: "canceled" })),
      },
      dispose: vi.fn(async () => ({ disposed: true })),
    };
    agentOs.create.mockResolvedValue(vm);

    await expect(runPiInAgentOs({
      workspaceDirectory,
      userMessage: "Read the task and deliver it.",
      systemPrompt: "System instructions",
      sessionId: "00000000-0000-4000-8000-000000000059",
      mode: "start",
      agentPath: "/opt/mystra-agent",
      controlPlaneUrl: "https://control.example.test",
      executionCode: "execution-secret",
      capabilities: ["context:read"],
      stateRoot,
      modelConfigPath,
      onLog: vi.fn(),
    })).resolves.toMatchObject({ success: true, message: "done" });

    expect(order).toEqual(["write-model", "open", "remove-model", "prompt"]);
    const createOptions = agentOs.create.mock.calls[0]?.[0];
    expect(createOptions.mounts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: "/home/agentos/.pi/agent",
        plugin: { id: "memory", config: {} },
      }),
      expect.objectContaining({
        path: "/home/agentos/workspace/.pi/extensions",
        readOnly: true,
        plugin: { id: "memory", config: {} },
      }),
    ]));
    expect(JSON.stringify(createOptions)).not.toContain("model-secret");
    expect(filesystem.remove).toHaveBeenCalledOnce();
  });

  it("fails closed without cleanup calls when the VM cannot be created", async () => {
    const workspaceDirectory = await temporaryDirectory("agentos-workspace-");
    const stateRoot = await temporaryDirectory("agentos-state-");
    const modelConfigPath = path.join(await temporaryDirectory("agentos-model-"), "model.json");
    await writeFile(modelConfigPath, JSON.stringify({
      model: {
        provider: "example",
        baseUrl: "https://model.example.test/v1",
        api: "openai-completions",
        apiKey: "model-secret",
        id: "example-model",
      },
    }));
    agentOs.create.mockRejectedValue(new Error("AgentOS sidecar is unavailable"));

    await expect(runPiInAgentOs({
      workspaceDirectory,
      userMessage: "Read the task and deliver it.",
      systemPrompt: "System instructions",
      sessionId: "00000000-0000-4000-8000-000000000060",
      mode: "start",
      agentPath: "/opt/mystra-agent",
      controlPlaneUrl: "https://control.example.test",
      executionCode: "execution-secret",
      capabilities: ["context:read"],
      stateRoot,
      modelConfigPath,
      onLog: vi.fn(),
    })).rejects.toThrow("AgentOS sidecar is unavailable");
    expect(agentOs.create).toHaveBeenCalledOnce();
  });
});
