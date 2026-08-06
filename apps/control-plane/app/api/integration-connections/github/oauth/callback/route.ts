import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { assertGitHubAppAvailable } from "@/lib/integrations/deployment-capabilities";
import { getGitHubAppService } from "@/lib/integrations/github-app";
import {
  clearGitHubOAuthCookies,
  constantTimeEqual,
  githubOAuthCookieNames,
  readRequestCookies,
  safeReturnTo,
} from "@/lib/integrations/github-oauth-cookies";
import { IntegrationFailure, integrationErrorResponse } from "@/lib/integrations/errors";

function resultRedirect(
  request: Request,
  returnTo: string,
  result: { status: "connected" } | { status: "connection_failed"; reason: string },
): NextResponse {
  const url = new URL(safeReturnTo(returnTo), new URL(request.url).origin);
  url.searchParams.set("settings", "integrations");
  url.searchParams.set("integration", "github");
  url.searchParams.set("result", result.status);
  if ("reason" in result) url.searchParams.set("reason", result.reason);
  const response = NextResponse.redirect(url);
  clearGitHubOAuthCookies(response, request);
  return response;
}

function publicReason(error: unknown): string {
  if (!(error instanceof IntegrationFailure)) return "upstream_error";
  switch (error.code) {
    case "GITHUB_OAUTH_INVALID": return "oauth_invalid";
    case "GITHUB_INSTALLATION_UNVERIFIED": return "installation_unverified";
    case "INTEGRATION_TIMEOUT": return "timeout";
    case "INTEGRATION_RATE_LIMITED": return "rate_limited";
    default: return "upstream_error";
  }
}

export async function GET(request: Request) {
  try {
    assertGitHubAppAvailable();
  } catch (error) {
    return integrationErrorResponse(error);
  }
  const query = new URL(request.url).searchParams;
  const cookies = readRequestCookies(request);
  const returnTo = safeReturnTo(cookies[githubOAuthCookieNames.returnTo]);
  if (!constantTimeEqual(cookies[githubOAuthCookieNames.state], query.get("state"))) {
    return resultRedirect(request, returnTo, { status: "connection_failed", reason: "oauth_state_invalid" });
  }
  const code = query.get("code");
  const verifier = cookies[githubOAuthCookieNames.verifier];
  const installationId = cookies[githubOAuthCookieNames.installationId];
  if (!code || !verifier || !installationId) {
    return resultRedirect(request, returnTo, { status: "connection_failed", reason: "oauth_transaction_invalid" });
  }
  try {
    const service = getGitHubAppService();
    const userToken = await service.exchangeOAuthCode(code, verifier);
    const activation = await service.verifyAccessibleInstallation(userToken, installationId);
    getDb().activateIntegrationConnection(activation);
    return resultRedirect(request, returnTo, { status: "connected" });
  } catch (error) {
    return resultRedirect(request, returnTo, { status: "connection_failed", reason: publicReason(error) });
  }
}
