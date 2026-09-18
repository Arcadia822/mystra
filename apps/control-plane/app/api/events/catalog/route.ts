import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { defaultIntegrationRegistry } from "@/lib/integrations/registry";
import { EventCatalog } from "@/lib/events/catalog";
import {
  authorizationErrorResponse,
  requireHumanSession,
} from "../../_auth";
import { requirePermission } from "@/lib/rbac";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedTeamId = url.searchParams.get("teamId");
    if (!requestedTeamId) {
      return noStore(
        NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "teamId query parameter is required" } },
          { status: 400 },
        ),
      );
    }

    const db = await getDb();
    const subject = await requireHumanSession(db, request, "events-catalog");
    const context = await db.getTeamContext(subject.user.id, requestedTeamId);
    if (!context) {
      return noStore(
        NextResponse.json({ error: { code: "forbidden", message: "forbidden" } }, { status: 403 }),
      );
    }
    requirePermission(context, "team.resource.access", requestedTeamId);

    const registry = defaultIntegrationRegistry();
    const catalog = new EventCatalog(registry);

    return noStore(NextResponse.json(catalog.toResponse(), { status: 200 }));
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      return noStore(
        NextResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Failed to load event catalog" } },
          { status: 500 },
        ),
      );
    }
  }
}
