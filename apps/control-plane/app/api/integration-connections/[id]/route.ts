import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { GitHubPatConnectionService } from "@/lib/integrations/github-pat-service";
import { getSecretProvider } from "@/lib/secrets";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
  teamScopedPatConnectionDb,
} from "../../_auth";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "connection-delete");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const secrets = getSecretProvider(db);
    const service = new GitHubPatConnectionService({
      db: teamScopedPatConnectionDb(db, active.team.id),
      teamId: active.team.id,
      ...(secrets ? { secrets } : {}),
    });
    await service.delete(id);
    return noStore(new NextResponse(null, { status: 204 }));
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      // Preserve the Integration error contract for provider failures.
    }
    return noStore(integrationErrorResponse(error));
  }
}
