import type { IntegrationConnectionListResponse } from "@mystra/shared";

export type GitHubConnectionView = {
  state: "loading" | "not-configured" | "disconnected" | "connected" | "error";
  action: "none" | "connect" | "reconnect" | "retry";
  connectUrl?: string;
  accountLogin?: string;
  repositorySelection?: "all" | "selected";
};

export function githubConnectionView(
  data: IntegrationConnectionListResponse | null,
  error: string | null,
  isLoading: boolean,
): GitHubConnectionView {
  if (isLoading) return { state: "loading", action: "none" };
  if (error || !data) return { state: "error", action: "retry" };
  const provider = data.providers.find((candidate) => candidate.integration === "github");
  if (!provider?.configured) return { state: "not-configured", action: "none" };
  const connection = data.connections.find((candidate) => (
    candidate.integration === "github" && candidate.status === "active"
  ));
  if (!connection) return { state: "disconnected", action: "connect", connectUrl: provider.connectUrl };
  return {
    state: "connected",
    action: "reconnect",
    connectUrl: provider.connectUrl,
    accountLogin: connection.account.login,
    repositorySelection: connection.repositorySelection,
  };
}
