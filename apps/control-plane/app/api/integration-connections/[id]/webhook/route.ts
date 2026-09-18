import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { integrationErrorResponse } from "@/lib/integrations/error-response"
import { WebhookEndpointService } from "@/lib/integrations/webhook-endpoint-service";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../../../_auth";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "webhook-endpoint-get");
    const active = await requireTeamPermission(db, subject, "team.integration.manage");

    // Fail closed without disclosing whether the connection exists in another Team.
    const connection = await db.getIntegrationConnectionRecord(id);
    if (!connection || connection.teamId !== active.team.id) {
      return noStore(
        NextResponse.json({ error: { code: "forbidden", message: "forbidden" } }, { status: 403 }),
      );
    }

    const service = new WebhookEndpointService(db);
    const result = await service.getOrCreateWebhookEndpoint(id, active.team.id);

    return noStore(NextResponse.json(result, { status: 200 }));
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      // Fall through to integration error handler
    }
    return noStore(integrationErrorResponse(error));
  }
}
