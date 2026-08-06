import { timingSafeEqual } from "node:crypto";

import type { NextResponse } from "next/server";

export const githubOAuthCookieNames = {
  returnTo: "mystra_github_return_to",
  state: "mystra_github_oauth_state",
  verifier: "mystra_github_oauth_verifier",
  installationId: "mystra_github_installation_id",
} as const;

export function readRequestCookies(request: Request): Record<string, string> {
  const raw = request.headers.get("cookie") ?? "";
  return Object.fromEntries(raw.split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return [];
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    return name ? [[name, decodeURIComponent(value)]] : [];
  }));
}

export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  return value;
}

export function secureCookie(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

export function setTransactionCookie(
  response: NextResponse,
  request: Request,
  name: string,
  value: string,
): void {
  response.cookies.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(request),
    path: "/",
    maxAge: 600,
  });
}

export function clearGitHubOAuthCookies(response: NextResponse, request: Request): void {
  for (const name of Object.values(githubOAuthCookieNames)) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie(request),
      path: "/",
      maxAge: 0,
    });
  }
}

export function constantTimeEqual(left: string | undefined, right: string | null): boolean {
  if (!left || !right) return false;
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
