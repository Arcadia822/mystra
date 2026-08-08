import { linearTeamListResponseSchema } from "@mystra/shared";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../../../../_auth";
import { getDb } from "@/lib/db";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { LinearApiKeyConnectionService } from "@/lib/integrations/linear-api-key-service";
import { getSecretProvider } from "@/lib/secrets";

const querySchema = z.object({
  first: z.coerce.number().int().min(1).max(100).default(50),
  after: z.string().min(1).optional(),
}).strict();

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams));
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "connection-read");
    const active = await requireTeamPermission(db, subject, "team.integration.manage");
    const secrets = getSecretProvider(db);
    const response = await new LinearApiKeyConnectionService({
      db,
      teamId: active.team.id,
      ...(secrets ? { secrets } : {}),
    }).listTeams(id, { first: query.first, ...(query.after ? { after: query.after } : {}) });
    return noStore(NextResponse.json(linearTeamListResponseSchema.parse(response)));
  } catch (error) {
    try {
      return noStore(authorizationErrorResponse(error));
    } catch {
      return noStore(integrationErrorResponse(error));
    }
  }
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}
