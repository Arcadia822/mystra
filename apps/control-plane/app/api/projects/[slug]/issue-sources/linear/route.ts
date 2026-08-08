import { projectIssueSourceUpsertSchema, projectIssueSourcesResponseSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../../../_auth";
import { getDb } from "@/lib/db";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { ProjectIssueSourceService } from "@/lib/integrations/project-issue-sources";
import { getSecretProvider } from "@/lib/secrets";

type Context = { params: Promise<{ slug: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const input = projectIssueSourceUpsertSchema.parse(await request.json());
    const { slug } = await context.params;
    const { service, teamId } = await authorizedService(request, "project-update");
    const sources = await service.upsert(slug, teamId, input);
    return noStore(NextResponse.json(projectIssueSourcesResponseSchema.parse(sources)));
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { slug } = await context.params;
    const { service, teamId } = await authorizedService(request, "project-update");
    await service.delete(slug, teamId);
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
    service: new ProjectIssueSourceService({ db, ...(secrets ? { secrets } : {}) }),
    teamId: active.team.id,
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
