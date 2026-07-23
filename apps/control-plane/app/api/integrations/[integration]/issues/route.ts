import { NextResponse } from "next/server";
import { issueListRequestSchema } from "@mystra/shared";

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
    const input = issueListRequestSchema.parse({
      ...(limit !== null ? { first: Number(limit) } : {}),
      ...(cursor ? { after: cursor } : {}),
    });
    const issues = await defaultIntegrationRegistry()
      .requireIssueProvider(integration)
      .listIssues(input);
    return NextResponse.json(issues);
  } catch (error) {
    return integrationErrorResponse(error);
  }
}
