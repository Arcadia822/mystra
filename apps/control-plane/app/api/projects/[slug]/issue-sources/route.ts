import { projectIssueSourcesResponseSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../../_auth";
import { getDb } from "@/lib/db";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { ProjectIssueSourceService } from "@/lib/integrations/project-issue-sources";
import { getSecretProvider } from "@/lib/secrets";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "project-read");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const secrets = getSecretProvider(db);
    const sources = await new ProjectIssueSourceService({ db, ...(secrets ? { secrets } : {}) })
      .get(slug, active.team.id);
    return noStore(NextResponse.json(projectIssueSourcesResponseSchema.parse(sources)));
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
