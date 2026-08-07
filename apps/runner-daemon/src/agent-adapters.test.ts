import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createRunnerAgentAdapterRegistry,
  supportedHostProviderKeys,
} from "./agent-adapters.js";

const tempDirs: string[] = [];

async function writeAdapterModule(source: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "mystra-agent-adapter-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, "adapter.mjs");
  await writeFile(filePath, source, "utf8");
  return filePath;
}

describe("runner agent adapters", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    }));
  });

  it("exposes the built-in host provider keys for discovery", () => {
    expect(supportedHostProviderKeys).toEqual(["codex", "copilot"]);
  });

  it("loads a startup-registered agent adapter module", async () => {
    const modulePath = await writeAdapterModule(`
      export const agentAdapters = {
        claude: {
          agentName: "claude",
          buildCommand(input) {
            return ["claude", input.prompt];
          },
          buildEnvironment() {
            return { CLAUDE_HOME: "/tmp/claude" };
          },
          parseOutput(result) {
            return {
              success: result.exitCode === 0,
              metadata: { adapter: "claude" },
            };
          },
          isSuccess(result) {
            return result.exitCode === 0;
          },
        },
      };
    `);

    const bundle = await createRunnerAgentAdapterRegistry({
      moduleSpecifiers: [modulePath],
    });

    expect(bundle.agentNames).toEqual(["codex", "copilot", "claude"]);
    expect(bundle.registry.get("codex").agentName).toBe("codex");
    expect(bundle.registry.get("copilot").agentName).toBe("copilot");
    expect(bundle.registry.get("claude").buildCommand({
      prompt: "Implement the requested change",
      workingDirectory: "/repo",
    })).toEqual(["claude", "Implement the requested change"]);
  });

  it("rejects duplicate startup agent adapter registrations", async () => {
    const modulePath = await writeAdapterModule(`
      export default {
        codex: {
          agentName: "codex",
          buildCommand() {
            return ["codex"];
          },
          buildEnvironment() {
            return {};
          },
          parseOutput() {
            return { success: true, metadata: {} };
          },
          isSuccess() {
            return true;
          },
        },
      };
    `);

    await expect(createRunnerAgentAdapterRegistry({
      moduleSpecifiers: [modulePath],
    })).rejects.toThrow('Agent adapter "codex" is already registered');
  });
});
