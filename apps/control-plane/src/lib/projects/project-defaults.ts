import {
  agentNameSchema,
  projectRuntimeConfigInputSchema,
  type AgentName,
  type ProjectRuntimeConfig,
} from "@mystra/shared";

export interface ProjectDefaults {
  defaultAgent: AgentName;
  runtime: ProjectRuntimeConfig;
}

type ProjectDefaultsEnvironment = Readonly<Record<string, string | undefined>>;

export function readProjectDefaults(
  environment: ProjectDefaultsEnvironment = process.env,
): ProjectDefaults {
  const configuredAgent = environment.MYSTRA_DEFAULT_AGENT;
  const configuredImage = environment.MYSTRA_DEFAULT_DEV_IMAGE;

  if (configuredAgent === "") {
    throw new Error("MYSTRA_DEFAULT_AGENT must not be empty");
  }
  if (configuredImage === "") {
    throw new Error("MYSTRA_DEFAULT_DEV_IMAGE must not be empty");
  }

  const defaultAgent = agentNameSchema.safeParse(configuredAgent ?? "copilot");
  if (!defaultAgent.success) {
    throw new Error("MYSTRA_DEFAULT_AGENT must be codex or copilot");
  }

  const runtime = projectRuntimeConfigInputSchema.safeParse({
    provider: "docker",
    image: configuredImage ?? "mystra-runner:local",
  });
  if (!runtime.success) {
    throw new Error("MYSTRA_DEFAULT_DEV_IMAGE must be a non-empty image reference");
  }

  return { defaultAgent: defaultAgent.data, runtime: runtime.data };
}
