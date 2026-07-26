import { NextResponse } from "next/server";
import { repositoryListRequestSchema } from "@mystra/shared";

import { integrationErrorResponse } from "@/lib/integrations/errors";
import { defaultIntegrationRegistry } from "@/lib/integrations/registry";

export async function GET(
  request: Request,
  context: { params: Promise<{ integration: string }> },
) {
  try {
    const { integration } = await context.params;
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor");
    const input = repositoryListRequestSchema.parse({
      ...(limit !== null ? { first: Number(limit) } : {}),
      ...(cursor ? { after: cursor } : {}),
    });
    const repositories = await defaultIntegrationRegistry()
      .requireRepoProvider(integration)
      .listRepositories(input);
    return NextResponse.json(repositories);
  } catch (error) {
    return integrationErrorResponse(error);
  }
}
