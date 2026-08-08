import { integrationConnectionResponseSchema, linearApiKeyConnectionInputSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../../_auth";
import { getDb } from "@/lib/db";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { LinearApiKeyConnectionService } from "@/lib/integrations/linear-api-key-service";
import { getSecretProvider } from "@/lib/secrets";

export async function POST(request: Request) {
  try {
    const input = linearApiKeyConnectionInputSchema.parse(await request.json());
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "connection-create");
    const active = await requireTeamPermission(db, subject, "team.integration.manage");
    const secrets = getSecretProvider(db);
    const connection = await new LinearApiKeyConnectionService({
      db,
      teamId: active.team.id,
      ...(secrets ? { secrets } : {}),
    }).create(input);
    return noStore(NextResponse.json(
      integrationConnectionResponseSchema.parse({ connection }),
      { status: 201 },
    ));
  } catch (error) {
    return routeError(error);
  }
}

function routeError(error: unknown): NextResponse {
  try {
    return noStore(authorizationErrorResponse(error));
  } catch {
    return noStore(integrationErrorResponse(error));
  }
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}
