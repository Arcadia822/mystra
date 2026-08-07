import { NextResponse } from "next/server";
import { issueGetRequestSchema } from "@mystra/shared";

import { IntegrationFailure, integrationErrorResponse } from "@/lib/integrations/errors";
import { defaultIntegrationRegistry } from "@/lib/integrations/registry";
import { resolveIssueRepositoryScope } from "@/lib/integrations/resolve-issue-scope";
import { getDb } from "@/lib/db";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../../../../_auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ integration: string; identifier: string }> },
) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "issue-read");
    await requireTeamPermission(db, subject, "team.resource.access");
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
    try {
      return authorizationErrorResponse(error);
    } catch {
      // Preserve the Integration error contract for provider failures.
    }
    return integrationErrorResponse(error);
  }
}
