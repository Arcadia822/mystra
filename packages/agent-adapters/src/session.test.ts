import { describe, expect, it } from "vitest";

import { CodexProviderAdapter, CopilotProviderAdapter, PiProviderAdapter } from "./index.js";
import { createProviderSessionAdapter } from "./session.js";
const copilot = new CopilotProviderAdapter({
  cliConfigDir: "/config/copilot",
  homeDir: "/home/runner",
  configDir: "/config",
  cacheDir: "/cache",
});

describe("ProviderSessionAdapter", () => {
  it("starts Codex in JSONL mode and extracts its durable thread id", () => {
    const adapter = createProviderSessionAdapter(new CodexProviderAdapter());
    const command = adapter.buildStartCommand({
      mystraSessionId: "550e8400-e29b-41d4-a716-446655440000",
      systemPrompt: "System contract",
      userMessage: "Implement the change",
      workingDirectory: "/workspace",
    });

    expect(command.argv).toContain("--json");
    expect(command.argv.at(-1)).toContain("System contract");
    expect(command.workingDirectory).toBe("/workspace");
    expect(adapter.parseResult({
      exitCode: 0,
      stdout: '{"type":"thread.started","thread_id":"codex-thread-1"}\n',
      stderr: "",
    }).providerSessionId).toBe("codex-thread-1");
  });

  it("continues Codex with the same provider session id", () => {
    const adapter = createProviderSessionAdapter(new CodexProviderAdapter());
    expect(adapter.buildContinueCommand({
      mystraSessionId: "550e8400-e29b-41d4-a716-446655440000",
      providerSessionId: "codex-thread-1",
      userMessage: "Now run tests",
      workingDirectory: "/workspace",
    }).argv).toEqual([
      "codex", "exec", "resume", "--json", "--dangerously-bypass-approvals-and-sandbox",
      "--cd", "/workspace", "codex-thread-1", "Now run tests",
    ]);
  });

  it("uses a stable Copilot session id for start and continuation", () => {
    const adapter = createProviderSessionAdapter(copilot);
    const start = adapter.buildStartCommand({
      mystraSessionId: "550e8400-e29b-41d4-a716-446655440000",
      systemPrompt: "System contract",
      userMessage: "Implement the change",
      workingDirectory: "/workspace",
    });
    const continuation = adapter.buildContinueCommand({
      mystraSessionId: "550e8400-e29b-41d4-a716-446655440000",
      providerSessionId: "550e8400-e29b-41d4-a716-446655440000",
      userMessage: "Now run tests",
      workingDirectory: "/workspace",
    });

    expect(start.argv).toContain("--session-id");
    expect(start.argv).toContain("550e8400-e29b-41d4-a716-446655440000");
    expect(start.workingDirectory).toBe("/workspace");
    expect(continuation.argv).toContain("--session-id");
    expect(adapter.parseResult({ exitCode: 0, stdout: "done", stderr: "" }).providerSessionId)
      .toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("hands Pi the user message and carries the Session contract out of band", () => {
    const adapter = createProviderSessionAdapter(new PiProviderAdapter());
    const start = adapter.buildStartCommand({
      mystraSessionId: "550e8400-e29b-41d4-a716-446655440000",
      systemPrompt: "System contract",
      userMessage: "Write a function",
      workingDirectory: "/workspace",
    });

    expect(start.argv).toEqual(["pi", "--cd", "/workspace", "Write a function"]);
    expect(start.environment.MYSTRA_SESSION_ID).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(start.environment.MYSTRA_SESSION_MODE).toBe("start");
    expect(start.environment.MYSTRA_SESSION_SYSTEM_PROMPT).toBe("System contract");

    const continuation = adapter.buildContinueCommand({
      mystraSessionId: "550e8400-e29b-41d4-a716-446655440000",
      providerSessionId: "550e8400-e29b-41d4-a716-446655440000",
      systemPrompt: "System contract",
      userMessage: "Now document it",
      workingDirectory: "/workspace",
    });

    expect(continuation.argv).toEqual(["pi", "--cd", "/workspace", "Now document it"]);
    expect(continuation.environment.MYSTRA_SESSION_ID).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(continuation.environment.MYSTRA_SESSION_MODE).toBe("continue");
    expect(continuation.environment.MYSTRA_SESSION_SYSTEM_PROMPT).toBe("System contract");
    expect(adapter.parseResult({ exitCode: 0, stdout: "done", stderr: "" }).providerSessionId)
      .toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});
