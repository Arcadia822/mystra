import { issueTaskCreateRequestSchema, taskCreateResponseSchema, taskIssueProviderSchema } from "@mystra/shared";
import { NextResponse } from "next/server";

import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../../../../_auth";
import { getDb } from "@/lib/db";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { defaultGitHubCredentialResolver } from "@/lib/integrations/github-credential";
import { ProjectIssuesService } from "@/lib/integrations/project-issues";
import { getSecretProvider } from "@/lib/secrets";
import { TaskService } from "@/lib/tasks/task-service";

type Context = { params: Promise<{ slug: string; provider: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { slug, provider: providerValue } = await context.params;
    const provider = taskIssueProviderSchema.parse(providerValue);
    const input = issueTaskCreateRequestSchema.parse(await request.json());
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "project-issue-task-create");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const secrets = getSecretProvider(db);
    const issues = new ProjectIssuesService({
      db,
      githubCredentials: await defaultGitHubCredentialResolver(),
      ...(secrets ? { secrets } : {}),
    });
    const result = await new TaskService({ db, issues }).createFromIssue(
      slug,
      active.team.id,
      provider,
      input,
    );
    return NextResponse.json(taskCreateResponseSchema.parse(result), { status: result.created ? 201 : 200 });
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      return integrationErrorResponse(error);
    }
  }
}
