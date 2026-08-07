import type { RuntimeView } from "@mystra/shared";

import { HostLivenessRegistry, resolveRuntimeStatus } from "./host-liveness";

const registryKey = "__mystraHostLivenessRegistry";

type GlobalWithHostLivenessRegistry = typeof globalThis & {
  [registryKey]?: HostLivenessRegistry;
};

export function getHostLivenessRegistry(): HostLivenessRegistry {
  const global = globalThis as GlobalWithHostLivenessRegistry;
  return (global[registryKey] ??= new HostLivenessRegistry());
}

export function withDerivedHostLiveness(runtime: RuntimeView, now = new Date()): RuntimeView {
  const lastSeenAt = getHostLivenessRegistry().getLastSeen(runtime.metadata.runnerId);
  return {
    ...runtime,
    lastSeenAt,
    status: resolveRuntimeStatus(lastSeenAt, now),
  };
}
