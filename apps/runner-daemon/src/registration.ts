import type { AgentName, RunnerRegistration } from "@mystra/shared";

interface RunnerRegistrationConfig {
  runnerName: string;
  executor: "fake" | "docker";
  concurrency: number;
  staleAfterSeconds: number;
  eligibleProjectIds?: string[] | undefined;
  eligibleRuntimeProviders?: string[] | undefined;
}

const fakeExecutorAgents: AgentName[] = ["codex"];

export function buildRunnerRegistrationPayload(
  config: RunnerRegistrationConfig,
  registeredAgents: AgentName[] = [],
): RunnerRegistration {
  const supportsLocalDockerSmoke = config.executor === "fake";
  const agents = config.executor === "docker"
    ? registeredAgents
    : fakeExecutorAgents;
  const providers: RunnerRegistration["capabilities"]["providers"] = config.executor === "docker" || supportsLocalDockerSmoke
    ? ["docker"]
    : [];

  return {
    runnerName: config.runnerName,
    capabilities: {
      executor: config.executor,
      agents,
      providers,
      contextBundleModes: config.executor === "docker" ? ["read-only", "session-scoped"] : [],
      mountKinds: config.executor === "docker" ? ["workspace", "gitMirror", "cache", "contextBundle", "secret"] : [],
      portExposure: {
        supportsDynamicHostPorts: config.executor === "docker",
      },
      secretInjectionModes: config.executor === "docker" ? ["env"] : [],
    },
    maxConcurrency: config.concurrency,
    staleAfterSeconds: config.staleAfterSeconds,
    eligibleProjectIds: config.eligibleProjectIds,
    eligibleRuntimeProviders: config.eligibleRuntimeProviders,
  };
}
