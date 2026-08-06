import { IntegrationFailure } from "./errors";

export type DeploymentCapabilities = {
  githubApp: boolean;
};

export const selfHostedDeploymentCapabilities: DeploymentCapabilities = Object.freeze({
  githubApp: false,
});

export function assertGitHubAppAvailable(
  capabilities: DeploymentCapabilities = selfHostedDeploymentCapabilities,
): void {
  if (capabilities.githubApp) return;
  throw new IntegrationFailure({
    code: "INTEGRATION_CONNECTION_METHOD_UNAVAILABLE",
    message: "GitHub App connections are available only on Mystra Cloud",
    details: { reasonCode: "HOSTED_ONLY" },
  });
}
