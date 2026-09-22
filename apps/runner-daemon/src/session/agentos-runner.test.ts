import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const agentOs = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@rivet-dev/agentos-core", () => ({ AgentOs: agentOs }));
vi.mock("@agentos-software/pi", () => ({ default: { name: "pi" } }));

// @ts-expect-error AgentOS loads this provider bridge as native ESM JavaScript.
import { loopbackExemptPortsFor, permissionsForEndpoints, runPiInAgentOs } from "./agentos-runner.mjs";

const temporaryDirectories: string[] = [];
const previousEnvironment = {
  cliDirectory: process.env.MYSTRA_AGENTOS_GUEST_CLI_DIR,
  controlPlaneUrl: process.env.MYSTRA_AGENTOS_CONTROL_PLANE_URL,
};

beforeEach(async () => {
  // The adapter requires the bundled workload CLI to exist on the host before it starts.
  const cliDirectory = await temporaryDirectory("agentos-cli-");
  await writeFile(path.join(cliDirectory, "mystra-agent.cjs"), "#!/usr/bin/env node\n");
  process.env.MYSTRA_AGENTOS_GUEST_CLI_DIR = cliDirectory;
  delete process.env.MYSTRA_AGENTOS_CONTROL_PLANE_URL;
});

afterEach(async () => {
  vi.clearAllMocks();
  restoreEnvironment();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function restoreEnvironment(): void {
  for (const [key, value] of [
    ["MYSTRA_AGENTOS_GUEST_CLI_DIR", previousEnvironment.cliDirectory],
    ["MYSTRA_AGENTOS_CONTROL_PLANE_URL", previousEnvironment.controlPlaneUrl],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

async function modelConfigPath(): Promise<string> {
  const file = path.join(await temporaryDirectory("agentos-model-"), "model.json");
  await writeFile(file, JSON.stringify({
    model: {
      provider: "example",
      baseUrl: "https://model.example.test/v1",
      api: "openai-completions",
      apiKey: "model-secret",
      id: "example-model",
    },
  }));
  return file;
}

function workloadVm(options: {
  order?: string[];
  whoamiExitCode?: number;
} = {}) {
  const order = options.order;
  return {
    filesystem: {
      writeFile: vi.fn(async (filePath: string) => {
        if (filePath.endsWith("/models.json")) order?.push("write-model");
      }),
      remove: vi.fn(async (filePath: string) => {
        expect(filePath).toBe("/home/agentos/.pi/agent/models.json");
        order?.push("remove-model");
      }),
    },
    process: {
      // Call 1 stages the guest-local CLI copy; call 2 asks the CLI to resolve its Session.
      exec: vi.fn(async (command: string) => ({
        exitCode: command.includes(" whoami") ? (options.whoamiExitCode ?? 0) : 0,
        stdout: options.whoamiExitCode === undefined || options.whoamiExitCode === 0
          ? JSON.stringify({ sessionId: "00000000-0000-4000-8000-000000000059" })
          : "",
        stderr: options.whoamiExitCode === undefined || options.whoamiExitCode === 0
          ? ""
          : "{\"error\":{\"code\":\"control_plane_unavailable\",\"message\":\"Control Plane request failed\"}}",
      })),
    },
    sessions: {
      open: vi.fn(async () => { order?.push("open"); }),
      get: vi.fn(async ({ sessionId }: { sessionId: string }) => ({ sessionId, latestSequence: 1 })),
      prompt: vi.fn(async () => {
        order?.push("prompt");
        return { stopReason: "end_turn", message: { content: [{ type: "text", text: "done" }] } };
      }),
      cancelPrompt: vi.fn(async () => ({ status: "canceled" })),
    },
    dispose: vi.fn(async () => ({ disposed: true })),
  };
}

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    workspaceDirectory: "/host/workspaces/task",
    userMessage: "Read the task and deliver it.",
    systemPrompt: "System instructions",
    sessionId: "00000000-0000-4000-8000-000000000059",
    mode: "start",
    agentPath: "/opt/mystra-agent",
    controlPlaneUrl: "http://127.0.0.1:3000",
    executionCode: "execution-secret",
    capabilities: ["context:read"],
    stateRoot: "/tmp/agentos-state",
    modelConfigPath: "/tmp/agentos-model/model.json",
    onLog: vi.fn(),
    ...overrides,
  };
}

describe("AgentOS guest egress policy", () => {
  it("allows the model endpoint and the guest-reachable Control Plane origin only", () => {
    expect(permissionsForEndpoints("https://model.example.test:8443/v1", "http://127.0.0.1:3000")).toEqual({
      fs: "allow",
      childProcess: "allow",
      process: "allow",
      env: "allow",
      binding: "allow",
      network: {
        default: "deny",
        rules: [
          { mode: "allow", operations: ["*"], patterns: ["tcp://model.example.test:8443"] },
          { mode: "allow", operations: ["*"], patterns: ["tcp://127.0.0.1:3000"] },
        ],
      },
    });
    expect(permissionsForEndpoints("https://model.example.test/v1", "http://127.0.0.1:3000").network.rules).toEqual([
      { mode: "allow", operations: ["*"], patterns: ["tcp://model.example.test:443"] },
      { mode: "allow", operations: ["*"], patterns: ["tcp://127.0.0.1:3000"] },
    ]);
    expect(permissionsForEndpoints("https://model.example.test/v1", "https://control.example.test").network.rules[1]).toEqual(
      { mode: "allow", operations: ["*"], patterns: ["tcp://control.example.test:443"] },
    );
    expect(() => permissionsForEndpoints("http://model.example.test/v1", "http://127.0.0.1:3000")).toThrow("must be HTTPS");
    expect(() => permissionsForEndpoints("https://user:secret@model.example.test/v1", "http://127.0.0.1:3000")).toThrow(
      "must not contain credentials",
    );
    expect(() => permissionsForEndpoints("https://model.example.test/v1", "http://user:secret@127.0.0.1:3000")).toThrow(
      "must not contain credentials",
    );
    expect(() => permissionsForEndpoints("https://model.example.test/v1", "file:///tmp/socket")).toThrow(
      "must be HTTP or HTTPS",
    );
  });

  it("exempts the loopback port the guest uses to reach the Control Plane", () => {
    // Without the exemption AgentOS blocks the request as SSRF and the Session fails
    // closed even though the egress rule exists (measured on host-c1).
    expect(loopbackExemptPortsFor("http://127.0.0.1:3000")).toEqual([3000]);
    expect(loopbackExemptPortsFor("http://localhost:3000")).toEqual([3000]);
    expect(loopbackExemptPortsFor("http://[::1]:3000")).toEqual([3000]);
    expect(loopbackExemptPortsFor("https://100.89.186.36:3000")).toEqual([]);
    expect(loopbackExemptPortsFor("https://control.example.test")).toEqual([]);
  });
});

describe("AgentOS Pi isolation", () => {
  it("injects the Session capability, projects the CLI, and removes the model credential before prompting", async () => {
    const order: string[] = [];
    const vm = workloadVm({ order });
    agentOs.create.mockResolvedValue(vm);

    await expect(runPiInAgentOs(assignment({ modelConfigPath: await modelConfigPath() })))
      .resolves.toMatchObject({ success: true, message: "done" });

    expect(order).toEqual(["write-model", "open", "remove-model", "prompt"]);
    const createOptions = agentOs.create.mock.calls[0]?.[0] as {
      mounts: { path: string; readOnly: boolean; plugin: { id: string; config: unknown } }[];
      loopbackExemptPorts: number[];
      bindings?: unknown;
    };
    expect(createOptions).not.toHaveProperty("bindings");
    expect(createOptions.loopbackExemptPorts).toEqual([3000]);
    expect(createOptions.mounts).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "/home/agentos/.pi/agent", plugin: { id: "memory", config: {} } }),
      expect.objectContaining({
        path: "/home/agentos/workspace/.pi/extensions",
        readOnly: true,
        plugin: { id: "memory", config: {} },
      }),
      expect.objectContaining({
        path: "/opt/mystra-agent-cli",
        readOnly: true,
        plugin: { id: "host_dir", config: expect.objectContaining({ readOnly: true }) },
      }),
    ]));
    expect(createOptions.mounts.map((mount: { path: string }) => mount.path)).not.toContain("/usr/local/sbin");
    // The model credential never leaves the ephemeral mount, and the CLI bundle carries no secret.
    expect(JSON.stringify(createOptions)).not.toContain("model-secret");

    const openOptions = vm.sessions.open.mock.calls[0] as unknown as [{ env: Record<string, string> }];
    expect(openOptions[0].env).toEqual({
      MYSTRA_AGENT_PATH: "/tmp/mystra-agent-cli/mystra-agent.cjs",
      MYSTRA_CONTROL_PLANE_URL: "http://127.0.0.1:3000",
      MYSTRA_EXECUTION_CODE: "execution-secret",
      MYSTRA_WORKSPACE_ROOT: "/home/agentos/workspace",
    });
    const prepareCall = vm.process.exec.mock.calls[0] as unknown as [string, unknown];
    expect(prepareCall[0]).toContain("cp /opt/mystra-agent-cli/mystra-agent.cjs /tmp/mystra-agent-cli/mystra-agent.cjs");
    expect(prepareCall[0]).toContain("chmod 0755");
    const probeCall = vm.process.exec.mock.calls[1] as unknown as [string, { env: Record<string, string> }];
    expect(probeCall[0]).toBe("/tmp/mystra-agent-cli/mystra-agent.cjs whoami");
    expect(probeCall[1]).toMatchObject({ env: openOptions[0].env });
    expect(vm.filesystem.remove).toHaveBeenCalledOnce();
  });

  it("uses a guest-reachable Control Plane URL override for the injected capability", async () => {
    const vm = workloadVm();
    agentOs.create.mockResolvedValue(vm);
    process.env.MYSTRA_AGENTOS_CONTROL_PLANE_URL = "https://control.example.test";

    await runPiInAgentOs(assignment({ modelConfigPath: await modelConfigPath() }));

    const createOptions = agentOs.create.mock.calls[0]?.[0] as { loopbackExemptPorts: number[] };
    const openOptions = vm.sessions.open.mock.calls[0] as unknown as [{ env: Record<string, string> }];
    expect(createOptions.loopbackExemptPorts).toEqual([]);
    expect(openOptions[0].env.MYSTRA_CONTROL_PLANE_URL).toBe("https://control.example.test");
  });

  it("completes an end_turn even when the agent wrote the deliverable without assistant text", async () => {
    const vm = workloadVm();
    vm.sessions.prompt = vi.fn(async () => ({ stopReason: "end_turn", message: { content: [] } }));
    agentOs.create.mockResolvedValue(vm);

    await expect(runPiInAgentOs(assignment({
      modelConfigPath: await modelConfigPath(),
      sessionId: "00000000-0000-4000-8000-000000000061",
    }))).resolves.toEqual({
      success: true,
      stopReason: "end_turn",
      message: "",
      providerSessionId: "00000000-0000-4000-8000-000000000061",
    });
  });

  it("fails closed before writing a credential when the guest cannot use the workload CLI", async () => {
    const vm = workloadVm({ whoamiExitCode: 1 });
    agentOs.create.mockResolvedValue(vm);

    await expect(runPiInAgentOs(assignment({ modelConfigPath: await modelConfigPath() })))
      .rejects.toThrow(/cannot reach the Runtime-provided workload CLI/u);

    // An unprovable capability must stop the Session instead of running it silently.
    expect(vm.filesystem.writeFile).not.toHaveBeenCalled();
    expect(vm.sessions.open).not.toHaveBeenCalled();
  });

  it("refuses to start without the bundled workload CLI on the host", async () => {
    const missing = path.join(await temporaryDirectory("agentos-cli-missing-"), "nested");
    process.env.MYSTRA_AGENTOS_GUEST_CLI_DIR = missing;

    await expect(runPiInAgentOs(assignment({ modelConfigPath: await modelConfigPath() })))
      .rejects.toThrow(/workload CLI bundle is missing/u);
    expect(existsSync(missing)).toBe(false);
    expect(agentOs.create).not.toHaveBeenCalled();
  });

  it("fails closed without cleanup calls when the VM cannot be created", async () => {
    agentOs.create.mockRejectedValue(new Error("AgentOS sidecar is unavailable"));

    await expect(runPiInAgentOs(assignment({ modelConfigPath: await modelConfigPath() })))
      .rejects.toThrow("AgentOS sidecar is unavailable");
    expect(agentOs.create).toHaveBeenCalledOnce();
  });
});
