import {
  integrationConnectionResponseSchema,
  personalAccessTokenConnectionInputSchema,
} from "@mystra/shared";
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
} from "../../../_auth";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function POST(request: Request) {
  try {
    const input = personalAccessTokenConnectionInputSchema.parse(await request.json());
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "connection-create");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const secrets = getSecretProvider(db);
    const service = new GitHubPatConnectionService({
      db: teamScopedPatConnectionDb(db, active.team.id),
      teamId: active.team.id,
      ...(secrets ? { secrets } : {}),
    });
    const connection = await service.create(input);
    return noStore(NextResponse.json(
      integrationConnectionResponseSchema.parse({ connection }),
      { status: 201 },
    ));
  } catch (error) {
    try {
      return noStore(authorizationErrorResponse(error));
    } catch {
      // Preserve the Integration error contract for provider failures.
    }
    return noStore(integrationErrorResponse(error));
  }
}
