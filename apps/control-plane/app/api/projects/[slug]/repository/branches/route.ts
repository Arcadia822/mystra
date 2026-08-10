import {
  projectRepositoryBranchPageSchema,
  projectRepositoryBranchQuerySchema,
} from "@mystra/shared";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../../../_auth";
import { getDb } from "@/lib/db";
import { ProjectRepositoryBranchesService } from "@/lib/git/project-repository-branches";
import { ProjectRemoteAccessFactory } from "@/lib/git/remote-access-factory";
import { GitRemoteRepositoryError, RemoteRepositoryReader } from "@/lib/git/remote-repository-reader";
import { GitHubIntegrationProvider } from "@/lib/integrations/github";
import { defaultGitHubCredentialResolver } from "@/lib/integrations/github-credential";

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { slug } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "project-repository-branches-list");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const query = projectRepositoryBranchQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const credentials = await defaultGitHubCredentialResolver();
    const service = new ProjectRepositoryBranchesService({
      db,
      accessFactory: new ProjectRemoteAccessFactory({
        githubCredentials: credentials,
        githubProvider: (token) => new GitHubIntegrationProvider({ token }),
      }),
      reader: new RemoteRepositoryReader(),
    });
    return noStore(NextResponse.json(projectRepositoryBranchPageSchema.parse(
      await service.list(slug, active.team.id, query),
    )));
  } catch (error) {
    try {
      return noStore(authorizationErrorResponse(error));
    } catch {
      if (error instanceof ZodError) {
        return noStore(NextResponse.json({
          error: { code: "INVALID_REQUEST", message: "Request validation failed" },
        }, { status: 400 }));
      }
      if (error instanceof GitRemoteRepositoryError) {
        return noStore(NextResponse.json({
          error: { code: "repository_branches_unavailable", message: error.message },
        }, { status: 502 }));
      }
      return noStore(NextResponse.json({
        error: { code: "repository_branches_unavailable", message: "Remote repository branches are unavailable" },
      }, { status: 502 }));
    }
  }
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}
