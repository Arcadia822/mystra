import { NextResponse } from "next/server";

import {
  createPkceTransaction,
  githubOAuthAuthorizationUrl,
  requireGitHubAppConfig,
} from "@/lib/integrations/github-app";
import { assertGitHubAppAvailable } from "@/lib/integrations/deployment-capabilities";
import {
  githubOAuthCookieNames,
  readRequestCookies,
  setTransactionCookie,
} from "@/lib/integrations/github-oauth-cookies";
import { IntegrationFailure, integrationErrorResponse } from "@/lib/integrations/errors";

export async function GET(request: Request) {
  try {
    assertGitHubAppAvailable();
    const config = requireGitHubAppConfig();
    const installationId = new URL(request.url).searchParams.get("installation_id");
    if (!installationId || !/^\d+$/.test(installationId)) {
      throw new IntegrationFailure({
        code: "GITHUB_INSTALLATION_UNVERIFIED",
        message: "GitHub App installation ID is missing or invalid",
      });
    }
    const transaction = createPkceTransaction();
    const response = NextResponse.redirect(githubOAuthAuthorizationUrl(config, transaction));
    setTransactionCookie(response, request, githubOAuthCookieNames.state, transaction.state);
    setTransactionCookie(response, request, githubOAuthCookieNames.verifier, transaction.verifier);
    setTransactionCookie(response, request, githubOAuthCookieNames.installationId, installationId);

    const existing = readRequestCookies(request)[githubOAuthCookieNames.returnTo];
    if (existing) setTransactionCookie(response, request, githubOAuthCookieNames.returnTo, existing);
    return response;
  } catch (error) {
    return integrationErrorResponse(error);
  }
}
