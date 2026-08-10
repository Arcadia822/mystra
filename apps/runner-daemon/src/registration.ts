import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { HostRuntimeRegistration, ProviderCapability } from "@mystra/shared";

export interface RunnerIdStore {
  read(filePath: string): Promise<string>;
  write(filePath: string, value: string): Promise<void>;
}

const runnerIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const localRunnerIdStore: RunnerIdStore = {
  async read(filePath) {
    return readFile(filePath, "utf8");
  },
  async write(filePath, value) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${value}\n`, { encoding: "utf8", mode: 0o600 });
  },
};

export const defaultRunnerIdPath = path.join(homedir(), ".mystra", "runner-id");

export async function getStableRunnerId(options: {
  filePath?: string;
  store?: RunnerIdStore;
} = {}): Promise<string> {
  const filePath = options.filePath ?? defaultRunnerIdPath;
  const store = options.store ?? localRunnerIdStore;

  try {
    const runnerId = (await store.read(filePath)).trim();
    if (!runnerIdPattern.test(runnerId)) {
      throw new Error(`Persisted runner ID at ${filePath} is not a valid UUID`);
    }
    return runnerId;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const runnerId = randomUUID();
  await store.write(filePath, runnerId);
  return runnerId;
}

export function buildHostRuntimeRegistrationPayload(input: {
  runnerId: string;
  name: string;
  platform: string;
  providers: ProviderCapability[];
}): HostRuntimeRegistration {
  return {
    runnerId: input.runnerId,
    name: input.name,
    type: "host",
    platform: input.platform,
    providers: input.providers,
    workspaceMaterialization: {
      version: 1,
      kinds: ["task-repository"],
      sharingModes: ["shared-mutable"],
    },
  };
}
