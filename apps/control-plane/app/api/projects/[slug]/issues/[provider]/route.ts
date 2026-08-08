import {
  githubIssueListRequestSchema,
  linearIssueListRequestSchema,
  projectIssueListResponseSchema,
} from "@mystra/shared";
import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../../../_auth";
import { getDb } from "@/lib/db";
import { integrationErrorResponse, IntegrationFailure } from "@/lib/integrations/errors";
import { defaultGitHubCredentialResolver } from "@/lib/integrations/github-credential";
import { ProjectIssuesService } from "@/lib/integrations/project-issues";
import { getSecretProvider } from "@/lib/secrets";

type Context = { params: Promise<{ slug: string; provider: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { slug, provider } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "project-issues-list");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const secrets = getSecretProvider(db);
    const service = new ProjectIssuesService({
      db,
      githubCredentials: await defaultGitHubCredentialResolver(),
      ...(secrets ? { secrets } : {}),
    });
    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    const result = provider === "github"
      ? await service.listGitHub(slug, active.team.id, githubIssueListRequestSchema.parse(query))
      : provider === "linear"
        ? await service.listLinear(slug, active.team.id, linearIssueListRequestSchema.parse(query))
        : (() => { throw new IntegrationFailure({ code: "ISSUE_CAPABILITY_UNAVAILABLE", message: "Issue provider is unavailable" }); })();
    return noStore(NextResponse.json(projectIssueListResponseSchema.parse(result)));
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
