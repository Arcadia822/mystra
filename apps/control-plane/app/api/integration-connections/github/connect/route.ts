import { NextResponse } from "next/server";

import {
  githubAppInstallationUrl,
  requireGitHubAppConfig,
} from "@/lib/integrations/github-app";
import {
  githubOAuthCookieNames,
  safeReturnTo,
  setTransactionCookie,
} from "@/lib/integrations/github-oauth-cookies";
import { IntegrationFailure, integrationErrorResponse } from "@/lib/integrations/errors";

export async function GET(request: Request) {
  try {
    const config = requireGitHubAppConfig();
    const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
    const response = NextResponse.redirect(githubAppInstallationUrl(config));
    setTransactionCookie(response, request, githubOAuthCookieNames.returnTo, returnTo);
    return response;
  } catch (error) {
    return error instanceof IntegrationFailure ? integrationErrorResponse(error) : integrationErrorResponse(error);
  }
}
