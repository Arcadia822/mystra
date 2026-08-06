import { NextResponse } from "next/server";
import { repositoryListRequestSchema } from "@mystra/shared";

import { integrationErrorResponse } from "@/lib/integrations/errors";
import { defaultIntegrationRegistry } from "@/lib/integrations/registry";
import { getDb } from "@/lib/db";
import { IntegrationFailure } from "@/lib/integrations/errors";

export async function GET(
  request: Request,
  context: { params: Promise<{ integration: string }> },
) {
  try {
    const { integration } = await context.params;
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor");
    const requestedConnectionId = url.searchParams.get("connectionId");
    const db = getDb();
    const activeConnections = requestedConnectionId
      ? []
      : db.listIntegrationConnections({ integration }).filter((candidate) => candidate.status === "active");
    if (!requestedConnectionId && activeConnections.length > 1) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_SELECTION_REQUIRED",
        message: "Select an Integration connection explicitly",
      });
    }
    const connection = requestedConnectionId
      ? db.getIntegrationConnection(requestedConnectionId)
      : activeConnections[0];
    if (!connection) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_NOT_FOUND",
        message: "Repository connection is not available",
      });
    }
    if (connection.integration !== integration) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_MISMATCH",
        message: "Repository integration does not match the selected connection",
      });
    }
    const input = repositoryListRequestSchema.parse({
      ...(limit !== null ? { first: Number(limit) } : {}),
      ...(cursor ? { after: cursor } : {}),
    });
    const repositories = await defaultIntegrationRegistry({ githubConnectionId: connection.id })
      .requireRepoProvider(integration)
      .listRepositories(input);
    const response = NextResponse.json(repositories);
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    return integrationErrorResponse(error);
  }
}
