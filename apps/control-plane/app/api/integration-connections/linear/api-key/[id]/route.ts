import { integrationConnectionResponseSchema, linearApiKeyConnectionInputSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../../../_auth";
import { getDb } from "@/lib/db";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { LinearApiKeyConnectionService } from "@/lib/integrations/linear-api-key-service";
import { getSecretProvider } from "@/lib/secrets";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const input = linearApiKeyConnectionInputSchema.parse(await request.json());
    const { id } = await context.params;
    const { service } = await authorizedService(request, "connection-update");
    const connection = await service.replace(id, input);
    return noStore(NextResponse.json(integrationConnectionResponseSchema.parse({ connection })));
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const { service } = await authorizedService(request, "connection-delete");
    await service.delete(id);
    return noStore(new NextResponse(null, { status: 204 }));
  } catch (error) {
    return routeError(error);
  }
}

async function authorizedService(request: Request, operation: string) {
  const db = await getDb();
  const subject = await requireHumanSession(db, request, operation);
  const active = await requireTeamPermission(db, subject, "team.integration.manage");
  const secrets = getSecretProvider(db);
  return {
    service: new LinearApiKeyConnectionService({ db, teamId: active.team.id, ...(secrets ? { secrets } : {}) }),
  };
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
