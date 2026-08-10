import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ProviderSessionCommand } from "@mystra/agent-adapters";

import { runProviderProcess } from "./provider-process.js";

const directories: string[] = [];

function command(argv: string[], workingDirectory: string): ProviderSessionCommand {
  return { argv, workingDirectory, environment: {}, executionOptions: {} };
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("runProviderProcess", () => {
  it("spawns argv without a shell in the resolved Workspace directory", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "mystra-provider-process-"));
    directories.push(directory);

    const result = await runProviderProcess(command([
      process.execPath,
      "-e",
      "process.stdout.write(process.cwd())",
    ], directory));

    expect(result).toEqual({ exitCode: 0, stdout: realpathSync(directory), stderr: "" });
  });

  it("bounds captured stdout and stderr", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "mystra-provider-output-"));
    directories.push(directory);

    const result = await runProviderProcess(command([
      process.execPath,
      "-e",
      "process.stdout.write('x'.repeat(1100000)); process.stderr.write('y'.repeat(1100000))",
    ], directory));

    expect(result.stdout).toHaveLength(1_048_576);
    expect(result.stderr).toHaveLength(1_048_576);
  });

  it("cancels the child process through AbortSignal", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "mystra-provider-abort-"));
    directories.push(directory);
    const controller = new AbortController();
    const running = runProviderProcess(command([
      process.execPath,
      "-e",
      "setInterval(() => {}, 1000)",
    ], directory), controller.signal);
    controller.abort();

    await expect(running).rejects.toMatchObject({ name: "AbortError" });
  });
});
