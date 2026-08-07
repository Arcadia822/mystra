import type { IntegrationConnection, IntegrationConnectionListResponse } from "@mystra/shared";

export type GitHubConnectionView = {
  state: "loading" | "not-configured" | "disconnected" | "connected" | "error";
  action: "none" | "connect" | "reconnect" | "retry";
  connectUrl?: string;
  accountLogin?: string;
  repositorySelection?: "all" | "selected" | "token";
};

export function githubConnectionAccountLogin(connection: IntegrationConnection): string {
  const login = connection.providerSubject.login;
  return typeof login === "string" && login.trim() ? login : connection.providerExternalId;
}

export function githubConnectionRepositorySelection(
  connection: IntegrationConnection,
): "all" | "selected" | "token" | undefined {
  const selection = connection.capabilities.repositories?.config.selection;
  return selection === "all" || selection === "selected" || selection === "token"
    ? selection
    : undefined;
}

export function githubConnectionView(
  data: IntegrationConnectionListResponse | null,
  error: string | null,
  isLoading: boolean,
): GitHubConnectionView {
  if (isLoading) return { state: "loading", action: "none" };
  if (error || !data) return { state: "error", action: "retry" };
  const provider = data.providers.find((candidate) => candidate.integration === "github");
  if (!provider?.methods.some((method) => method.configured)) {
    return { state: "not-configured", action: "none" };
  }
  const appMethod = provider.methods.find((method) => method.type === "github-app");
  const connection = data.connections.find((candidate) => (
    candidate.integration === "github" && candidate.status === "active"
  ));
  if (!connection) {
    return {
      state: "disconnected",
      action: appMethod?.configured ? "connect" : "none",
      ...(appMethod ? { connectUrl: appMethod.connectUrl } : {}),
    };
  }
  const repositorySelection = githubConnectionRepositorySelection(connection);
  return {
    state: "connected",
    action: connection.authMethod === "github-app" ? "reconnect" : "none",
    ...(appMethod ? { connectUrl: appMethod.connectUrl } : {}),
    accountLogin: githubConnectionAccountLogin(connection),
    ...(repositorySelection ? { repositorySelection } : {}),
  };
}
