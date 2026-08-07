import {
  integrationConnectionResponseSchema,
  personalAccessTokenConnectionInputSchema,
} from "@mystra/shared";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { GitHubPatConnectionService } from "@/lib/integrations/github-pat-service";
import { getSecretProvider } from "@/lib/secrets";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const input = personalAccessTokenConnectionInputSchema.parse(await request.json());
    const { id } = await context.params;
    const db = await getDb();
    const secrets = getSecretProvider(db);
    const service = new GitHubPatConnectionService({
      db,
      ...(secrets ? { secrets } : {}),
    });
    const connection = await service.replace(id, input);
    return noStore(NextResponse.json(
      integrationConnectionResponseSchema.parse({ connection }),
    ));
  } catch (error) {
    return noStore(integrationErrorResponse(error));
  }
}
