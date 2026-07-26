import { NextResponse } from "next/server";
import { issueGetRequestSchema } from "@mystra/shared";

import { IntegrationFailure, integrationErrorResponse } from "@/lib/integrations/errors";
import { defaultIntegrationRegistry } from "@/lib/integrations/registry";
import { resolveIssueRepositoryScope } from "@/lib/integrations/resolve-issue-scope";

export async function GET(
  request: Request,
  context: { params: Promise<{ integration: string; identifier: string }> },
) {
  try {
    const { integration, identifier } = await context.params;
    const registry = defaultIntegrationRegistry();
    const provider = registry.requireIssueProvider(integration);
    const repository = await resolveIssueRepositoryScope({
      integrationName: integration,
      repositoryIdentifier: new URL(request.url).searchParams.get("repository")?.trim()
        || undefined,
      provider,
      registry,
    });
    const issue = await provider.getIssue(issueGetRequestSchema.parse({
      identifier,
      ...(repository ? { repository } : {}),
    }));
    if (!issue) {
      throw new IntegrationFailure({
        code: "ISSUE_NOT_FOUND",
        message: `Issue not found: ${identifier}`,
      });
    }
    return NextResponse.json({ issue });
  } catch (error) {
    return integrationErrorResponse(error);
  }
}
