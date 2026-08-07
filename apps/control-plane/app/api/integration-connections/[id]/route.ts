import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { GitHubPatConnectionService } from "@/lib/integrations/github-pat-service";
import { getSecretProvider } from "@/lib/secrets";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const db = await getDb();
    const secrets = getSecretProvider(db);
    const service = new GitHubPatConnectionService({
      db,
      ...(secrets ? { secrets } : {}),
    });
    await service.delete(id);
    return noStore(new NextResponse(null, { status: 204 }));
  } catch (error) {
    return noStore(integrationErrorResponse(error));
  }
}
