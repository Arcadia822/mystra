import path from "node:path";

import type { ProviderCapability } from "@mystra/shared";

import { discoverProviderCapabilities } from "./provider-discovery.js";

const AGENTOS_PI_SHIM_NAME = "pi-agentos-shim.mjs";

export async function discoverAgentOsPiCapability(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<ProviderCapability[]> {
  const configuredPath = environment.MYSTRA_PI_PATH?.trim();
  if (!configuredPath) {
    throw new Error("AgentOS Runtime requires MYSTRA_PI_PATH to identify the AgentOS Pi shim");
  }
  if (!path.isAbsolute(configuredPath) || path.basename(configuredPath) !== AGENTOS_PI_SHIM_NAME) {
    throw new Error(`MYSTRA_PI_PATH must be an absolute path to ${AGENTOS_PI_SHIM_NAME}`);
  }

  const providers = await discoverProviderCapabilities({
    providerKeys: ["pi"],
    environment: { MYSTRA_PI_PATH: configuredPath },
  });
  const capability = providers[0];
  if (
    capability?.available
    && (
      capability.source !== "env-override"
      || capability.resolvedPath !== configuredPath
      || !capability.version?.includes("(@agentos-software/pi)")
      || !capability.version.includes("agentos-core ")
    )
  ) {
    throw new Error("MYSTRA_PI_PATH did not identify the AgentOS Pi shim");
  }
  return providers;
}
