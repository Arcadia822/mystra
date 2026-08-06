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

export async function GET(request: Request) {
  try {
    assertGitHubAppAvailable();
    const config = requireGitHubAppConfig();
    const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
    const response = NextResponse.redirect(githubAppInstallationUrl(config));
    setTransactionCookie(response, request, githubOAuthCookieNames.returnTo, returnTo);
    return response;
  } catch (error) {
    return integrationErrorResponse(error);
  }
}
