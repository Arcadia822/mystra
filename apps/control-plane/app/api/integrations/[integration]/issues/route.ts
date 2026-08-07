import { NextResponse } from "next/server";
import { issueListRequestSchema } from "@mystra/shared";

import { integrationErrorResponse } from "@/lib/integrations/errors";
import { defaultIntegrationRegistry } from "@/lib/integrations/registry";
import { resolveIssueRepositoryScope } from "@/lib/integrations/resolve-issue-scope";
import { getDb } from "@/lib/db";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../../../_auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ integration: string }> },
) {
  try {
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "issue-list");
    await requireTeamPermission(db, subject, "team.resource.access");
    const { integration } = await context.params;
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor");
    const registry = defaultIntegrationRegistry();
    const provider = registry.requireIssueProvider(integration);
    const repository = await resolveIssueRepositoryScope({
      integrationName: integration,
      repositoryIdentifier: url.searchParams.get("repository")?.trim() || undefined,
      provider,
      registry,
    });
    const input = issueListRequestSchema.parse({
      ...(limit !== null ? { first: Number(limit) } : {}),
      ...(cursor ? { after: cursor } : {}),
      ...(repository ? { repository } : {}),
    });
    const issues = await provider.listIssues(input);
    return NextResponse.json(issues);
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      // Preserve the Integration error contract for provider failures.
    }
    return integrationErrorResponse(error);
  }
}
