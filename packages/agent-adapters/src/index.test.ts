import { describe, expect, it } from "vitest";
import {
  CodexAdapter,
  CopilotAdapter,
  createAgentAdapterRegistry,
} from "./index.js";

describe("agent adapters", () => {
  it("builds the codex command and environment from a typed adapter", () => {
    const adapter = new CodexAdapter({
      authDir: "/auth/codex",
    });

    expect(adapter.buildCommand({
      prompt: "Implement the requested change",
      workingDirectory: "/repo",
    })).toEqual([
      "codex",
      "exec",
      "--dangerously-bypass-approvals-and-sandbox",
      "--cd",
      "/repo",
      "Implement the requested change",
    ]);
    expect(adapter.buildEnvironment({
      prompt: "Implement the requested change",
      workingDirectory: "/repo",
    })).toEqual({
      CODEX_HOME: "/auth/codex",
    });
    expect(adapter.isSuccess({ exitCode: 0, stdout: "", stderr: "" })).toBe(true);
    expect(adapter.parseOutput({ exitCode: 1, stdout: "", stderr: "codex failed" })).toEqual({
      success: false,
      errorMessage: "codex failed",
      metadata: {},
    });
  });

  it("builds the copilot command and sandbox environment from a typed adapter", () => {
    const adapter = new CopilotAdapter({
      cliConfigDir: "/sandbox/.copilot",
      homeDir: "/sandbox",
      configDir: "/sandbox/.config",
      cacheDir: "/sandbox/.cache",
      denyMcpServers: ["linear"],
      deniedUrls: ["mcp.linear.app"],
    });

    expect(adapter.buildCommand({
      prompt: "Implement the requested change",
      workingDirectory: "/repo",
    })).toEqual([
      "copilot",
      "--config-dir",
      "/sandbox/.copilot",
      "--disable-mcp-server",
      "linear",
      "--deny-url",
      "mcp.linear.app",
      "--prompt",
      "Implement the requested change",
      "--allow-all",
      "--no-ask-user",
      "--no-color",
      "--stream",
      "off",
    ]);
    expect(adapter.buildEnvironment({
      prompt: "Implement the requested change",
      workingDirectory: "/repo",
    })).toEqual({
      HOME: "/sandbox",
      XDG_CONFIG_HOME: "/sandbox/.config",
      XDG_CACHE_HOME: "/sandbox/.cache",
      COPILOT_CLI_CONFIG_DIR: "/sandbox/.copilot",
    });
    expect(adapter.isSuccess({ exitCode: 0, stdout: "", stderr: "" })).toBe(true);
  });

  it("registers adapters by agent name and supports startup extension", () => {
    const registry = createAgentAdapterRegistry({
      codex: new CodexAdapter({
        authDir: "/auth/codex",
      }),
      copilot: new CopilotAdapter({
        cliConfigDir: "/sandbox/.copilot",
        homeDir: "/sandbox",
        configDir: "/sandbox/.config",
        cacheDir: "/sandbox/.cache",
      }),
    });

    expect(registry.get("codex")).toBeInstanceOf(CodexAdapter);
    expect(registry.get("copilot")).toBeInstanceOf(CopilotAdapter);
    expect(() => registry.get("claude")).toThrow('Unknown agent adapter "claude"');
  });
});
