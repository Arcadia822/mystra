import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createRunnerSandboxProviderRegistry } from "./sandbox-providers.js";

const tempDirs: string[] = [];

async function writeProviderModule(source: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "mystra-sandbox-provider-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, "provider.mjs");
  await writeFile(filePath, source, "utf8");
  return filePath;
}

describe("runner sandbox providers", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    }));
  });

  it("loads a startup-registered sandbox provider module", async () => {
    const modulePath = await writeProviderModule(`
      export const sandboxProviders = {
        stub: {
          providerName: "stub",
          async launch(input) {
            return {
              provider: "stub",
              sessionId: input.sessionId,
              status: "running",
              startedAt: "2026-05-14T00:00:00.000Z",
              retained: false,
            };
          },
          async inspect(session) {
            return {
              session,
              ports: [],
              metadata: {},
            };
          },
          async stop() {
            return {
              status: "succeeded",
              attemptedAt: "2026-05-14T00:05:00.000Z",
            };
          },
          async collectOutcome(session) {
            return {
              status: "succeeded",
              session,
              ports: [],
              cleanup: {
                status: "succeeded",
                attemptedAt: "2026-05-14T00:05:00.000Z",
              },
              metadata: {},
            };
          },
        },
      };
    `);

    const bundle = await createRunnerSandboxProviderRegistry({
      builtinProviders: {},
      moduleSpecifiers: [modulePath],
    });

    expect(bundle.providerNames).toEqual(["stub"]);
    expect(bundle.registry.get("stub")?.providerName).toBe("stub");
  });

  it("registers the built-in Docker sandbox provider by default", async () => {
    const bundle = await createRunnerSandboxProviderRegistry();
    expect(bundle.providerNames).toEqual(["docker"]);
    expect(bundle.registry.get("docker")?.providerName).toBe("docker");
  });

  it("rejects duplicate startup sandbox provider registrations", async () => {
    const firstModulePath = await writeProviderModule(`
      export const sandboxProviders = {
        docker: {
          providerName: "docker",
          async launch(input) {
            return {
              provider: "docker",
              sessionId: input.sessionId,
              status: "running",
              startedAt: "2026-05-14T00:00:00.000Z",
              retained: false,
            };
          },
          async inspect(session) {
            return {
              session,
              ports: [],
              metadata: {},
            };
          },
          async stop() {
            return {
              status: "succeeded",
              attemptedAt: "2026-05-14T00:05:00.000Z",
            };
          },
          async collectOutcome(session) {
            return {
              status: "succeeded",
              session,
              ports: [],
              cleanup: {
                status: "succeeded",
                attemptedAt: "2026-05-14T00:05:00.000Z",
              },
              metadata: {},
            };
          },
        },
      };
    `);
    const secondModulePath = await writeProviderModule(`
      export default {
        docker: {
          providerName: "docker",
          async launch(input) {
            return {
              provider: "docker",
              sessionId: input.sessionId,
              status: "running",
              startedAt: "2026-05-14T00:00:00.000Z",
              retained: false,
            };
          },
          async inspect(session) {
            return {
              session,
              ports: [],
              metadata: {},
            };
          },
          async stop() {
            return {
              status: "succeeded",
              attemptedAt: "2026-05-14T00:05:00.000Z",
            };
          },
          async collectOutcome(session) {
            return {
              status: "succeeded",
              session,
              ports: [],
              cleanup: {
                status: "succeeded",
                attemptedAt: "2026-05-14T00:05:00.000Z",
              },
              metadata: {},
            };
          },
        },
      };
    `);

    await expect(createRunnerSandboxProviderRegistry({
      builtinProviders: {},
      moduleSpecifiers: [firstModulePath, secondModulePath],
    })).rejects.toThrow('Sandbox provider "docker" is already registered');
  });
});
