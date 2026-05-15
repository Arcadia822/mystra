import type { RepoProviderKind } from "@mystra/shared";

interface RepositoryHostKindOptions {
  gitlabHttpBaseUrl?: string | undefined;
  githubHttpBaseUrl?: string | undefined;
}

function configuredHostname(baseUrl: string | undefined): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function repositoryHostname(repoUrl: string): string | undefined {
  try {
    const url = new URL(repoUrl.includes("://") ? repoUrl : `https://${repoUrl}`);
    return url.hostname.toLowerCase();
  } catch {
    const scpLikeMatch = repoUrl.match(/^(?:[^@]+@)?([^:/]+)(?::\d+)?[:/].+$/);
    return scpLikeMatch?.[1]?.toLowerCase();
  }
}

export function detectRepositoryHostKind(
  repoUrl: string,
  options: RepositoryHostKindOptions = {},
): RepoProviderKind | "unknown" {
  const hostname = repositoryHostname(repoUrl);
  const gitlabHostname = configuredHostname(options.gitlabHttpBaseUrl);
  const githubHostname = configuredHostname(options.githubHttpBaseUrl);

  if (hostname && gitlabHostname && hostname === gitlabHostname) {
    return "gitlab";
  }
  if (hostname && githubHostname && hostname === githubHostname) {
    return "github";
  }

  const haystack = `${hostname ?? ""} ${repoUrl}`.toLowerCase();
  if (haystack.includes("gitlab")) {
    return "gitlab";
  }
  if (haystack.includes("github")) {
    return "github";
  }
  return "unknown";
}
