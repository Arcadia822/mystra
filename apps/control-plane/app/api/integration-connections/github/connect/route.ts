import { NextResponse } from "next/server";

import {
  githubAppInstallationUrl,
  requireGitHubAppConfig,
} from "@/lib/integrations/github-app";
import { assertGitHubAppAvailable } from "@/lib/integrations/deployment-capabilities";
import {
  githubOAuthCookieNames,
  safeReturnTo,
  setTransactionCookie,
} from "@/lib/integrations/github-oauth-cookies";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { getDb } from "@/lib/db";
import {
  authorizationErrorResponse,
  requireHumanSession,
  requireTeamPermission,
} from "../../../_auth";

export async function GET(request: Request) {
  try {
    assertGitHubAppAvailable();
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "github-app-connect");
    await requireTeamPermission(db, subject, "team.resource.access");
    const config = requireGitHubAppConfig();
    const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
    const response = NextResponse.redirect(githubAppInstallationUrl(config));
    setTransactionCookie(response, request, githubOAuthCookieNames.returnTo, returnTo);
    return response;
  } catch (error) {
    try {
      return authorizationErrorResponse(error);
    } catch {
      // Preserve hosted-only capability and Integration failures.
    }
    return integrationErrorResponse(error);
  }
}
