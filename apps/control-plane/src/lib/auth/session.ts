import { createHash, randomBytes } from "node:crypto";

import { AuthError } from "./errors";

export const sessionCookieName = "mystra_session";
export type SessionPresentationSource = "bearer" | "cookie";

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function extractSessionToken(
  request: Request,
): { token: string; source: SessionPresentationSource } | undefined {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const match = /^Bearer ([A-Za-z0-9_-]{16,})$/.exec(authorization);
    return match ? { token: match[1]!, source: "bearer" } : undefined;
  }

  const token = readCookie(request.headers.get("cookie"), sessionCookieName);
  return token && /^[A-Za-z0-9_-]{16,}$/.test(token)
    ? { token, source: "cookie" }
    : undefined;
}

export function serializeSessionCookie(
  token: string,
  maxAgeSeconds: number,
  options: { secure?: boolean } = {},
): string {
  if (!/^[A-Za-z0-9_-]{16,}$/.test(token) || !Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds <= 0) {
    throw new TypeError("Invalid session cookie");
  }
  return `${sessionCookieName}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly${options.secure === false ? "" : "; Secure"}; SameSite=Lax`;
}

export function clearSessionCookie(options: { secure?: boolean } = {}): string {
  return `${sessionCookieName}=; Path=/; Max-Age=0; HttpOnly${options.secure === false ? "" : "; Secure"}; SameSite=Lax`;
}

export function sessionCookieOptions(request: Request): { secure: boolean } {
  const url = new URL(request.url);
  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return { secure: url.protocol === "https:" || !isLoopback };
}

export function assertRequestOrigin(request: Request, source: SessionPresentationSource): void {
  if (source !== "cookie" || ["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new AuthError("csrf-failed");
  }
}

export function assertNewSessionRequestOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new AuthError("csrf-failed");
  }
}

function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}
