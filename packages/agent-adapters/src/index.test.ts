import { describe, expect, it } from "vitest";
import {
  CodexProviderAdapter,
  CopilotProviderAdapter,
  createProviderAdapterRegistry,
} from "./index.js";

describe("Provider adapters", () => {
  it("builds the codex command and environment from a typed adapter", () => {
    const adapter = new CodexProviderAdapter({
      authDir: "/auth/codex",
      timeoutSeconds: 45,
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
      CODEX_TIMEOUT_SECONDS: "45",
    });
    expect(adapter.isSuccess({ exitCode: 0, stdout: "", stderr: "" })).toBe(true);
    expect(adapter.parseOutput({ exitCode: 1, stdout: "", stderr: "codex failed" })).toEqual({
      success: false,
      errorMessage: "codex failed",
      metadata: {},
    });
  });

  it("uses stdin-backed prompt files for codex when the prompt is spilled from argv", () => {
    const adapter = new CodexProviderAdapter();

    expect(adapter.buildCommand({
      prompt: "Implement the requested change",
      promptFilePath: "/mystra/workspace/agent-prompt.txt",
      workingDirectory: "/repo",
    })).toEqual([
      "codex",
      "exec",
      "--dangerously-bypass-approvals-and-sandbox",
      "--cd",
      "/repo",
      "-",
    ]);
    expect(adapter.buildExecutionOptions?.({
      prompt: "Implement the requested change",
      promptFilePath: "/mystra/workspace/agent-prompt.txt",
      workingDirectory: "/repo",
    })).toEqual({
      stdinFilePath: "/mystra/workspace/agent-prompt.txt",
    });
  });

  it("builds the copilot command and sandbox environment from a typed adapter", () => {
    const adapter = new CopilotProviderAdapter({
      cliConfigDir: "/sandbox/.copilot",
      homeDir: "/sandbox",
      configDir: "/sandbox/.config",
      cacheDir: "/sandbox/.cache",
      cliVersion: "1.0.69-0",
      maxAutopilotContinues: 10,
      denyMcpServers: ["linear"],
      deniedUrls: ["mcp.linear.app"],
    });

    expect(adapter.buildCommand({
      prompt: "Implement the requested change",
      workingDirectory: "/repo",
    })).toEqual([
      "copilot",
      "--disable-mcp-server",
      "linear",
      "--deny-url",
      "mcp.linear.app",
      "--prompt",
      "Implement the requested change",
      "--allow-all",
      "--autopilot",
      "--max-autopilot-continues",
      "10",
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
    expect(adapter.parseOutput({ exitCode: 9, stdout: "", stderr: "" })).toEqual({
      success: false,
      errorMessage: "copilot exited with 9",
      metadata: {
        provider: "copilot",
        cliVersion: "1.0.69-0",
        mode: "autopilot",
        maxAutopilotContinues: 10,
        exitCode: 9,
      },
    });
    expect(adapter.buildCommand({
      prompt: "Implement the requested change",
      workingDirectory: "/repo",
    })).not.toContain("--config-dir");
  });

  it("uses prompt attachments for copilot when the prompt is spilled from argv", () => {
    const adapter = new CopilotProviderAdapter({
      cliConfigDir: "/sandbox/.copilot",
      homeDir: "/sandbox",
      configDir: "/sandbox/.config",
      cacheDir: "/sandbox/.cache",
      cliVersion: "1.0.69-0",
      maxAutopilotContinues: 10,
    });

    expect(adapter.buildCommand({
      prompt: "Implement the requested change",
      promptFilePath: "/mystra/workspace/agent-prompt.txt",
      workingDirectory: "/repo",
    })).toEqual([
      "copilot",
      "--attachment",
      "/mystra/workspace/agent-prompt.txt",
      "--prompt",
      "Follow the attached instructions file as the complete user task.",
      "--allow-all",
      "--autopilot",
      "--max-autopilot-continues",
      "10",
      "--no-color",
      "--stream",
      "off",
    ]);
  });

  it("parses unexpected process output defensively instead of throwing", () => {
    const codex = new CodexProviderAdapter();
    const copilot = new CopilotProviderAdapter({
      cliConfigDir: "/sandbox/.copilot",
      homeDir: "/sandbox",
      configDir: "/sandbox/.config",
      cacheDir: "/sandbox/.cache",
      cliVersion: "1.0.69-0",
      maxAutopilotContinues: 10,
    });

    expect(codex.parseOutput({
      exitCode: 1,
      stdout: undefined,
      stderr: undefined,
    } as unknown as Parameters<typeof codex.parseOutput>[0])).toEqual({
      success: false,
      errorMessage: "codex exited with 1",
      metadata: {},
    });
    expect(copilot.parseOutput({
      exitCode: 1,
      stdout: 42,
      stderr: null,
    } as unknown as Parameters<typeof copilot.parseOutput>[0])).toEqual({
      success: false,
      errorMessage: "copilot exited with 1",
      metadata: {
        provider: "copilot",
        cliVersion: "1.0.69-0",
        mode: "autopilot",
        maxAutopilotContinues: 10,
        exitCode: 1,
      },
    });
  });

  it("registers adapters by Provider name and supports startup extension", () => {
    const registry = createProviderAdapterRegistry({
      codex: new CodexProviderAdapter({
        authDir: "/auth/codex",
      }),
      copilot: new CopilotProviderAdapter({
        cliConfigDir: "/sandbox/.copilot",
        homeDir: "/sandbox",
        configDir: "/sandbox/.config",
        cacheDir: "/sandbox/.cache",
        cliVersion: "1.0.69-0",
        maxAutopilotContinues: 10,
      }),
    });

    expect(registry.get("codex")).toBeInstanceOf(CodexProviderAdapter);
    expect(registry.get("copilot")).toBeInstanceOf(CopilotProviderAdapter);
    expect(() => registry.get("claude")).toThrow('Unknown Provider adapter "claude"');
  });
});
