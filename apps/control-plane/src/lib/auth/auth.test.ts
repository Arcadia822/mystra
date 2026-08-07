import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  AuthAccountRecord,
  AuthSessionRecord,
  RdbProvider,
  UserRecord,
} from "../db/rdb-provider";
import {
  LocalAuthService,
  LoginRateLimiter,
  assertBootstrapReady,
  assertPasswordChangeAllowed,
  authenticateRequest,
} from "./service";
import { hashPassword, scryptParameters, verifyPassword } from "./password";
import {
  createSessionToken,
  extractSessionToken,
  hashSessionToken,
  serializeSessionCookie,
  sessionCookieOptions,
  assertNewSessionRequestOrigin,
  assertRequestOrigin,
} from "./session";

const now = new Date("2026-08-07T00:00:00.000Z");

async function expectRejectedCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

function expectThrownCode(action: () => void, code: string): void {
  try {
    action();
    throw new Error("Expected action to throw");
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

function user(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: randomUUID(),
    username: "operator",
    displayUsername: "Operator",
    displayName: "Operator",
    status: "active",
    requirePasswordChange: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

function session(userId: string, overrides: Partial<AuthSessionRecord> = {}): AuthSessionRecord {
  return {
    id: randomUUID(),
    userId,
    tokenHash: hashSessionToken("valid-token-accepted"),
    expiresAt: new Date(now.getTime() + 60_000).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe("local password credentials", () => {
  it("uses a versioned scrypt hash with a random 16-byte salt and fixed parameters", async () => {
    const credential = await hashPassword("correct horse battery staple");

    expect(credential.passwordHash).toMatch(/^scrypt\$v1\$[A-Za-z0-9+/=]+$/);
    expect(Buffer.from(credential.passwordSalt, "base64")).toHaveLength(16);
    expect(credential.passwordParams).toBe(scryptParameters.serialized);
    expect(scryptParameters).toMatchObject({ N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  });

  it("verifies only the matching password using the stored credential", async () => {
    const credential = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", credential)).resolves.toBe(true);
    await expect(verifyPassword("incorrect password", credential)).resolves.toBe(false);
    await expect(verifyPassword("correct horse battery staple", {
      ...credential,
      passwordHash: "scrypt$v1$invalid",
    })).resolves.toBe(false);
  });
});

describe("session presentation", () => {
  it("stores only a deterministic digest of an opaque random token", () => {
    const token = createSessionToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(token)).not.toContain(token);
  });

  it("accepts Bearer sessions before browser cookies and serializes secure browser cookies", () => {
    const request = new Request("https://control.example.test/api/auth/session", {
      headers: {
        authorization: "Bearer cli-token-with-sufficient-length",
        cookie: "mystra_session=browser-token-sufficient",
      },
    });

    expect(extractSessionToken(request)).toEqual({
      token: "cli-token-with-sufficient-length",
      source: "bearer",
    });
    expect(serializeSessionCookie("browser-token-sufficient", 3600)).toBe(
      "mystra_session=browser-token-sufficient; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Lax",
    );
  });

  it("omits Secure only for loopback HTTP preview cookies", () => {
    expect(sessionCookieOptions(new Request("http://localhost:3001/api/auth/login"))).toEqual({ secure: false });
    expect(sessionCookieOptions(new Request("https://control.example.test/api/auth/login"))).toEqual({ secure: true });
    expect(serializeSessionCookie("browser-token-sufficient", 3600, { secure: false }))
      .not.toContain("; Secure");
  });

  it("rejects malformed Bearer and cookie tokens", () => {
    expect(extractSessionToken(new Request("https://control.example.test", {
      headers: { authorization: "Bearer token extra" },
    }))).toBeUndefined();
    expect(extractSessionToken(new Request("https://control.example.test", {
      headers: { cookie: "mystra_session=%E0%A4%A" },
    }))).toBeUndefined();
  });

  it("requires an exact same Origin for cookie-authenticated unsafe requests", () => {
    expect(() => assertRequestOrigin(
      new Request("https://control.example.test/api/auth/logout", {
        method: "POST",
        headers: { origin: "https://control.example.test" },
      }),
      "cookie",
    )).not.toThrow();
    expectThrownCode(() => assertRequestOrigin(
      new Request("https://control.example.test/api/auth/logout", { method: "POST" }),
      "cookie",
    ), "csrf-failed");
    expectThrownCode(() => assertRequestOrigin(
      new Request("https://control.example.test/api/auth/logout", {
        method: "POST",
        headers: { origin: "https://attacker.example.test" },
      }),
      "cookie",
    ), "csrf-failed");
    expect(() => assertRequestOrigin(
      new Request("https://control.example.test/api/auth/logout", { method: "POST" }),
      "bearer",
    )).not.toThrow();
  });

  it("rejects cross-origin requests that establish browser sessions while allowing non-browser clients", () => {
    expect(() => assertNewSessionRequestOrigin(
      new Request("https://control.example.test/api/auth/login", { method: "POST" }),
    )).not.toThrow();
    expect(() => assertNewSessionRequestOrigin(
      new Request("https://control.example.test/api/auth/login", {
        method: "POST",
        headers: { origin: "https://control.example.test" },
      }),
    )).not.toThrow();
    expectThrownCode(() => assertNewSessionRequestOrigin(
      new Request("https://control.example.test/api/auth/login", {
        method: "POST",
        headers: { origin: "https://attacker.example.test" },
      }),
    ), "csrf-failed");
  });
});

describe("authenticated session guard", () => {
  it("fails closed for missing, invalid, expired, revoked, and disabled sessions", async () => {
    const account = user();
    const activeSession = session(account.id);
    let deletedId: string | undefined;
    const db = {
      getAuthSessionByTokenHash: async (tokenHash: string) => (
        tokenHash === activeSession.tokenHash ? activeSession : undefined
      ),
      getUserById: async () => account,
      deleteAuthSession: async (id: string) => { deletedId = id; },
    } satisfies Pick<RdbProvider, "getAuthSessionByTokenHash" | "getUserById" | "deleteAuthSession">;

    await expectRejectedCode(
      authenticateRequest(db, new Request("https://control.example.test")),
      "unauthenticated",
    );
    await expectRejectedCode(authenticateRequest(db, new Request("https://control.example.test", {
      headers: { authorization: "Bearer invalid-token-accepted" },
    })), "unauthenticated");

    activeSession.expiresAt = new Date(now.getTime() - 1).toISOString();
    await expectRejectedCode(authenticateRequest(db, new Request("https://control.example.test", {
      headers: { authorization: "Bearer valid-token-accepted" },
    }), { now: () => now }), "unauthenticated");
    expect(deletedId).toBe(activeSession.id);

    activeSession.expiresAt = new Date(now.getTime() + 60_000).toISOString();
    account.status = "disabled";
    await expectRejectedCode(authenticateRequest(db, new Request("https://control.example.test", {
      headers: { authorization: "Bearer valid-token-accepted" },
    }), { now: () => now }), "unauthenticated");
  });

  it("applies same-origin CSRF checks before accepting cookie sessions", async () => {
    const account = user();
    const activeSession = session(account.id, {
      tokenHash: hashSessionToken("browser-token-sufficient"),
    });
    const db = {
      getAuthSessionByTokenHash: async () => activeSession,
      getUserById: async () => account,
      deleteAuthSession: async () => undefined,
    } satisfies Pick<RdbProvider, "getAuthSessionByTokenHash" | "getUserById" | "deleteAuthSession">;

    await expectRejectedCode(authenticateRequest(db, new Request("https://control.example.test/api/auth/logout", {
      method: "POST",
      headers: { cookie: "mystra_session=browser-token-sufficient" },
    })), "csrf-failed");
  });

  it("allows only session inspection, password change, and logout while a password change is required", () => {
    const required = user({ requirePasswordChange: true });

    expect(() => assertPasswordChangeAllowed(required, "session")).not.toThrow();
    expect(() => assertPasswordChangeAllowed(required, "change-password")).not.toThrow();
    expect(() => assertPasswordChangeAllowed(required, "logout")).not.toThrow();
    expectThrownCode(
      () => assertPasswordChangeAllowed(required, "team-resource"),
      "password-change-required",
    );
  });
});

describe("local auth service", () => {
  it("persists only credential and session digests when registering a local User", async () => {
    const account = user();
    const createdSession = session(account.id);
    let persisted: Parameters<RdbProvider["registerLocalUser"]>[0] | undefined;
    const db = {
      registerLocalUser: async (input: Parameters<RdbProvider["registerLocalUser"]>[0]) => {
        persisted = input;
        return {
          user: account,
          initialTeam: {
            id: randomUUID(),
            displayName: "Operator's Team",
            status: "active" as const,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
          ownerMembership: {
            id: randomUUID(),
            teamId: randomUUID(),
            userId: account.id,
            role: "owner" as const,
            status: "active" as const,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
          session: createdSession,
        };
      },
      getUserByUsername: async () => undefined,
      getAuthAccountForUser: async () => undefined,
      createAuthSession: async () => createdSession,
    } satisfies Pick<
      RdbProvider,
      "registerLocalUser" | "getUserByUsername" | "getAuthAccountForUser" | "createAuthSession"
    >;
    const auth = new LocalAuthService(db, { now: () => now });

    const result = await auth.register({
      username: "operator",
      password: "correct horse battery staple",
    });

    expect(persisted).toMatchObject({
      username: "operator",
      passwordParams: scryptParameters.serialized,
      tokenHash: hashSessionToken(result.token),
    });
    expect(persisted?.passwordHash).not.toContain("correct horse battery staple");
    expect(persisted?.passwordSalt).not.toContain("correct horse battery staple");
  });

  it("returns one stable failure for missing accounts, wrong passwords, and disabled users", async () => {
    const credential = await hashPassword("correct horse battery staple");
    const account = user({ status: "disabled" });
    const db = {
      getUserByUsername: async (username: string) => username === "operator" ? account : undefined,
      getAuthAccountForUser: async (): Promise<AuthAccountRecord> => ({
        id: randomUUID(),
        userId: account.id,
        ...credential,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }),
      createAuthSession: async () => {
        throw new Error("must not create a session");
      },
      registerLocalUser: async () => {
        throw new Error("must not register a user");
      },
    } satisfies Pick<
      RdbProvider,
      "getUserByUsername" | "getAuthAccountForUser" | "createAuthSession" | "registerLocalUser"
    >;
    const auth = new LocalAuthService(db, { now: () => now });

    for (const input of [
      { username: "unknown", password: "correct horse battery staple" },
      { username: "operator", password: "wrong password" },
      { username: "operator", password: "correct horse battery staple" },
    ]) {
      await expectRejectedCode(
        auth.login(input, { rateLimitKey: "127.0.0.1" }),
        "invalid-credentials",
      );
    }
  });

  it("allows the externally bootstrapped admin username to log in", async () => {
    const account = user({ username: "admin", displayUsername: "admin" });
    const credential = await hashPassword("admin");
    const createdSession = session(account.id);
    const db = {
      getUserByUsername: async (username: string) => username === "admin" ? account : undefined,
      getAuthAccountForUser: async () => ({
        id: randomUUID(),
        userId: account.id,
        ...credential,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }),
      createAuthSession: async () => createdSession,
      registerLocalUser: async () => {
        throw new Error("must not register a user");
      },
    } satisfies Pick<
      RdbProvider,
      "getUserByUsername" | "getAuthAccountForUser" | "createAuthSession" | "registerLocalUser"
    >;

    await expect(new LocalAuthService(db, { now: () => now }).login({
      username: "admin",
      password: "admin",
    })).resolves.toMatchObject({ user: { username: "admin" }, session: createdSession });
  });

  it("fails closed after repeated login failures until the window elapses", () => {
    const limiter = new LoginRateLimiter({ maxAttempts: 2, windowMs: 1_000 });

    expect(limiter.allow("127.0.0.1", 0)).toBe(true);
    limiter.recordFailure("127.0.0.1", 0);
    expect(limiter.allow("127.0.0.1", 1)).toBe(true);
    limiter.recordFailure("127.0.0.1", 1);
    expect(limiter.allow("127.0.0.1", 2)).toBe(false);
    expect(limiter.allow("127.0.0.1", 1_001)).toBe(true);
  });

  it("fails closed when bootstrap has no active local User", async () => {
    await expectRejectedCode(
      assertBootstrapReady({ hasActiveLocalUser: async () => false }),
      "installation-incomplete",
    );
    await expect(assertBootstrapReady({ hasActiveLocalUser: async () => true })).resolves.toBeUndefined();
  });
});
