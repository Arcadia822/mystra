import { NextResponse } from "next/server";

import { IntegrationFailure, integrationErrorResponse } from "@/lib/integrations/errors";
import { defaultIntegrationRegistry } from "@/lib/integrations/registry";
import { getDb } from "@/lib/db";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../../../../_auth";

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
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "repository-resolve");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const activeConnections = connectionId
      ? []
      : (await db.listIntegrationConnections({ integration, teamId: active.team.id }))
        .filter((candidate) => candidate.status === "active");
    if (!connectionId && activeConnections.length > 1) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_SELECTION_REQUIRED",
        message: "Select an Integration connection explicitly",
      });
    }
    const connection = connectionId
      ? await db.getIntegrationConnection(connectionId)
      : activeConnections[0];
    if (!connection || connection.teamId !== active.team.id) {
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
    try {
      return authorizationErrorResponse(error);
    } catch {
      // Preserve the Integration error contract for provider failures.
    }
    return integrationErrorResponse(error);
  }
}
