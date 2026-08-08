import type { IntegrationConnection, IntegrationConnectionListResponse } from "@mystra/shared";

export function linearConnections(data: IntegrationConnectionListResponse | null): IntegrationConnection[] {
  return data?.connections.filter((connection) => (
    connection.integration === "linear" && connection.authMethod === "api-key"
  )) ?? [];
}

export function linearConnectionSummary(connection: IntegrationConnection): string {
  const organization = typeof connection.providerSubject.organizationName === "string"
    ? connection.providerSubject.organizationName
    : connection.providerExternalId;
  return `${organization} · API key · ${connection.status}/${connection.credentialState}`;
}
