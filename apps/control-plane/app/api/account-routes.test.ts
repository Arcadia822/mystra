import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { RdbError } from "@/lib/db/prisma-errors";
import { GET as getCurrentSession } from "./auth/session/route";
import { GET as listSessions } from "./auth/sessions/route";
import { POST as revokeSession } from "./auth/sessions/revoke/route";
import { POST as deactivateAccount } from "./account/deactivate/route";
import { POST as changeDisplayName } from "./account/display-name/route";
import { POST as changePassword } from "./account/password/route";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

const userId = randomUUID();
const currentSessionId = randomUUID();
const otherSessionId = randomUUID();
const now = "2026-08-07T00:00:00.000Z";
const session = {
  id: currentSessionId,
  userId,
  tokenHash: "digest",
  expiresAt: "2027-08-07T00:00:00.000Z",
  createdAt: now,
  updatedAt: now,
};
const user = {
  id: userId,
  username: "operator",
  displayUsername: "Operator",
  displayName: "Operator",
  status: "active" as const,
  requirePasswordChange: false,
  createdAt: now,
  updatedAt: now,
};

function request(url: string, body?: unknown): Request {
  return new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: "Bearer route-test-session-token",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.mocked(getDb).mockResolvedValue({
    getAuthSessionByTokenHash: vi.fn(async () => session),
    getUserById: vi.fn(async () => user),
    deleteAuthSession: vi.fn(async () => undefined),
    listAuthSessionsForUser: vi.fn(async () => [
      session,
      {
        ...session,
        id: otherSessionId,
        tokenHash: "other-digest",
        createdAt: "2026-08-06T00:00:00.000Z",
      },
      {
        ...session,
        id: randomUUID(),
        tokenHash: "expired-digest",
        expiresAt: "2026-08-06T00:00:00.000Z",
      },
    ]),
    deleteAuthSessionForUser: vi.fn(async () => true),
    updateUserDisplayName: vi.fn(async (_userId: string, displayName: string) => ({
      ...user,
      displayName,
    })),
    getAuthAccountForUser: vi.fn(async () => ({
      id: randomUUID(),
      userId,
      passwordHash: "scrypt$v1$FUE4tA0k9HqS0SMpcGZ6K0sHcz2YQKQ1mX9Y4w4H0r3O09El3qOdy6Y5qVONeqQ9MRGdwxK1P3P/SmfhZI7bsw==",
      passwordSalt: "MDEyMzQ1Njc4OWFiY2RlZg==",
      passwordParams: "N=32768,r=8,p=1,maxmem=67108864",
      createdAt: now,
      updatedAt: now,
    })),
    replacePasswordCredentialAndRevokeOtherSessions: vi.fn(async () => ({
      ...user,
      requirePasswordChange: false,
    })),
    deactivateLocalUser: vi.fn(async () => true),
  } as never);
});

describe("account and session routes", () => {
  it("projects the current account without credential or persistence fields", async () => {
    const response = await getCurrentSession(
      request("https://control.example.test/api/auth/session"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: {
        id: userId,
        username: "operator",
        displayName: "Operator",
        status: "active",
        requirePasswordChange: false,
      },
      session: {
        id: currentSessionId,
        createdAt: now,
        expiresAt: "2027-08-07T00:00:00.000Z",
        current: true,
      },
    });
  });

  it("lists only the caller's unexpired sessions and identifies the current session", async () => {
    const response = await listSessions(request("https://control.example.test/api/auth/sessions"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sessions: [
        expect.objectContaining({ id: currentSessionId, current: true }),
        expect.objectContaining({ id: otherSessionId, current: false }),
      ],
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("revoke only an owned session without exposing a session token", async () => {
    const response = await revokeSession(
      request("https://control.example.test/api/auth/sessions/revoke", { sessionId: otherSessionId }),
    );

    expect(response.status).toBe(204);
    const db = await getDb();
    expect(db.deleteAuthSessionForUser).toHaveBeenCalledWith(userId, otherSessionId);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("updates only the authenticated account display name", async () => {
    const response = await changeDisplayName(
      request("https://control.example.test/api/account/display-name", { displayName: "Updated Operator" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: expect.objectContaining({ id: userId, displayName: "Updated Operator" }),
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects a password replacement when the current password does not verify", async () => {
    const response = await changePassword(
      request("https://control.example.test/api/account/password", {
        currentPassword: "incorrect current password",
        newPassword: "a secure replacement password",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "invalid-current-password", message: "invalid-current-password" },
    });
    const db = await getDb();
    expect(db.replacePasswordCredentialAndRevokeOtherSessions).not.toHaveBeenCalled();
  });

  it("replaces a verified password, clears the password-change gate, and never returns credentials", async () => {
    const credential = await hashPassword("correct current password");
    vi.mocked(getDb).mockResolvedValueOnce({
      ...(await getDb()),
      getAuthAccountForUser: vi.fn(async () => ({
        id: randomUUID(),
        userId,
        ...credential,
        createdAt: now,
        updatedAt: now,
      })),
    } as never);

    const response = await changePassword(
      request("https://control.example.test/api/account/password", {
        currentPassword: "correct current password",
        newPassword: "a secure replacement password",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: expect.objectContaining({ id: userId, requirePasswordChange: false }),
    });
    const db = await getDb();
    expect(db.replacePasswordCredentialAndRevokeOtherSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        currentSessionId,
        passwordHash: expect.not.stringContaining("a secure replacement password"),
        passwordSalt: expect.not.stringContaining("a secure replacement password"),
      }),
    );
  });

  it("deactivates only the authenticated account and clears its browser session", async () => {
    const response = await deactivateAccount(
      request("https://control.example.test/api/account/deactivate", {}),
    );

    expect(response.status).toBe(204);
    const db = await getDb();
    expect(db.deactivateLocalUser).toHaveBeenCalledWith(userId);
  });

  it("fails closed when account deactivation conflicts with Team lifecycle invariants", async () => {
    vi.mocked(getDb).mockResolvedValueOnce({
      ...(await getDb()),
      deactivateLocalUser: vi.fn(async () => {
        throw new RdbError("RDB_CONFLICT", "Cannot deactivate the last active Team Owner");
      }),
    } as never);

    const response = await deactivateAccount(
      request("https://control.example.test/api/account/deactivate", {}),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: { code: "deactivate-forbidden", message: "deactivate-forbidden" },
    });
  });
});
