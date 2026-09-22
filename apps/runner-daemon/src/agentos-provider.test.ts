import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { discoverAgentOsPiCapability } from "./agentos-provider.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function executable(name: string, version: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "agentos-provider-"));
  temporaryDirectories.push(directory);
  const filePath = path.join(directory, name);
  await writeFile(filePath, `#!/bin/sh\nprintf '%s\\n' '${version}'\n`);
  await chmod(filePath, 0o700);
  return filePath;
}

describe("discoverAgentOsPiCapability", () => {
  it("requires an explicit AgentOS shim instead of resolving an unsandboxed PATH binary", async () => {
    await expect(discoverAgentOsPiCapability({ PATH: process.env.PATH })).rejects.toThrow("requires MYSTRA_PI_PATH");
    const nativePi = await executable("pi", "pi 1.0.0");
    await expect(discoverAgentOsPiCapability({ MYSTRA_PI_PATH: nativePi })).rejects.toThrow("pi-agentos-shim.mjs");
  });

  it("accepts only a probed AgentOS Pi shim identity", async () => {
    const shim = await executable(
      "pi-agentos-shim.mjs",
      "pi 0.2.7 (@agentos-software/pi) agentos-core 0.2.19 (@rivet-dev/agentos-core)",
    );
    await expect(discoverAgentOsPiCapability({ MYSTRA_PI_PATH: shim })).resolves.toEqual([
      expect.objectContaining({
        provider: "pi",
        available: true,
        source: "env-override",
        resolvedPath: shim,
      }),
    ]);

    const imposter = await executable("pi-agentos-shim.mjs", "pi 1.0.0");
    await expect(discoverAgentOsPiCapability({ MYSTRA_PI_PATH: imposter })).rejects.toThrow("did not identify");
  });
});
