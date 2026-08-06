import {
  runnerRepositoryCredentialRequestSchema,
  runnerRepositoryCredentialResponseSchema,
} from "@mystra/shared";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { bearerToken } from "@/lib/http";
import { getGitHubAppService } from "@/lib/integrations/github-app";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store, private");
  response.headers.set("pragma", "no-cache");
  return response;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const runner = db.authenticateRunner(bearerToken(request));
  if (!runner) {
    return noStore(NextResponse.json({ error: { code: "RUNNER_UNAUTHORIZED", message: "Runner credential is invalid" } }, { status: 401 }));
  }
  try {
    runnerRepositoryCredentialRequestSchema.parse(await request.json());
    const { id } = await context.params;
    const claim = db.getSessionClaim(runner.id, id);
    if (!claim) {
      return noStore(NextResponse.json({ error: { code: "SESSION_ASSIGNMENT_MISMATCH", message: "Session is not assigned to this Runner" } }, { status: 404 }));
    }
    const project = db.getProjectById(claim.task.projectId);
    const connection = project ? db.getIntegrationConnection(project.repositoryConnectionId) : undefined;
    if (!project || !connection || project.repository.provider !== "github" || connection.provider !== "github") {
      return noStore(NextResponse.json({ error: { code: "REPOSITORY_CREDENTIAL_UNAVAILABLE", message: "Repository credential is unavailable" } }, { status: 409 }));
    }
    const credential = await getGitHubAppService().getInstallationCredential(connection.externalId);
    return noStore(NextResponse.json(runnerRepositoryCredentialResponseSchema.parse({ credential })));
  } catch {
    return noStore(NextResponse.json({ error: { code: "REPOSITORY_CREDENTIAL_UNAVAILABLE", message: "Repository credential is unavailable" } }, { status: 502 }));
  }
}
