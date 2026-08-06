import { NextResponse } from "next/server";

import { IntegrationFailure, integrationErrorResponse } from "@/lib/integrations/errors";
import { defaultIntegrationRegistry } from "@/lib/integrations/registry";
import { getDb } from "@/lib/db";

export async function GET(
  request: Request,
  context: { params: Promise<{ integration: string }> },
) {
  try {
    const { integration } = await context.params;
    const identifier = new URL(request.url).searchParams.get("identifier")?.trim();
    const connectionId = new URL(request.url).searchParams.get("connectionId")?.trim();
    if (!identifier) {
      return NextResponse.json({
        error: {
          code: "INVALID_REQUEST",
          message: "Repository identifier is required",
        },
      }, { status: 400 });
    }
    const db = getDb();
    const activeConnections = connectionId
      ? []
      : db.listIntegrationConnections({ integration }).filter((candidate) => candidate.status === "active");
    if (!connectionId && activeConnections.length > 1) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_SELECTION_REQUIRED",
        message: "Select an Integration connection explicitly",
      });
    }
    const connection = connectionId
      ? db.getIntegrationConnection(connectionId)
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
    const repository = await defaultIntegrationRegistry({ githubConnectionId: connection.id })
      .requireRepoProvider(integration)
      .getRepository(identifier);
    if (!repository) {
      throw new IntegrationFailure({
        code: "REPOSITORY_NOT_FOUND",
        message: `Repository not found: ${identifier}`,
      });
    }
    return NextResponse.json({ repository });
  } catch (error) {
    return integrationErrorResponse(error);
  }
}
