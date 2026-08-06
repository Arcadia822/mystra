import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  GitHubAppService,
  createGitHubAppJwt,
  createPkceTransaction,
  readGitHubAppConfig,
} from "./github-app";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const config = {
  appId: "12345",
  clientId: "Iv1.fixture",
  clientSecret: "client-secret",
  slug: "mystra-fixture",
  privateKey: privateKeyPem,
  callbackUrl: "http://localhost:3000/api/integration-connections/github/oauth/callback",
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("GitHub App configuration and transactions", () => {
  it("requires the complete deployment configuration and normalizes escaped PEM lines", () => {
    expect(readGitHubAppConfig({
      MYSTRA_GITHUB_APP_ID: config.appId,
      MYSTRA_GITHUB_APP_CLIENT_ID: config.clientId,
      MYSTRA_GITHUB_APP_CLIENT_SECRET: config.clientSecret,
      MYSTRA_GITHUB_APP_SLUG: config.slug,
      MYSTRA_GITHUB_APP_PRIVATE_KEY: privateKeyPem.replaceAll("\n", "\\n"),
      MYSTRA_GITHUB_APP_CALLBACK_URL: config.callbackUrl,
    })).toEqual(config);
    expect(readGitHubAppConfig({ MYSTRA_GITHUB_APP_ID: config.appId })).toBeUndefined();
  });

  it("creates a PKCE S256 transaction and a short-lived RS256 App JWT", () => {
    const transaction = createPkceTransaction();
    expect(transaction.state.length).toBeGreaterThanOrEqual(32);
    expect(transaction.verifier.length).toBeGreaterThanOrEqual(43);
    expect(transaction.challenge).toMatch(/^[A-Za-z0-9_-]+$/);

    const jwt = createGitHubAppJwt(config, new Date("2026-08-05T08:00:00.000Z"));
    const [header, payload, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header!, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(payload!, "base64url").toString())).toMatchObject({ iss: "12345" });
    expect(signature).toBeTruthy();
  });
});

describe("GitHubAppService", () => {
  it("exchanges OAuth with PKCE and verifies the exact accessible installation", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "ghu_ephemeral", token_type: "bearer" }))
      .mockResolvedValueOnce(jsonResponse({ installations: [{
        id: 18492,
        app_id: 12345,
        account: { id: 42, login: "arcadia", type: "User", avatar_url: "https://avatars.example/42" },
        repository_selection: "selected",
        permissions: { contents: "write", pull_requests: "write" },
      }] }));
    const service = new GitHubAppService({ config, fetchImpl });

    const token = await service.exchangeOAuthCode("oauth-code", "pkce-verifier");
    const activation = await service.verifyAccessibleInstallation(token, "18492");

    expect(activation).toMatchObject({
      integration: "github",
      provider: "github",
      externalId: "18492",
      account: { externalId: "42", login: "arcadia" },
    });
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(String(fetchImpl.mock.calls[0]?.[1]?.body)).toContain("code_verifier=pkce-verifier");
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toMatchObject({ authorization: "Bearer ghu_ephemeral" });
  });

  it("rejects a spoofed installation or wrong App without reflecting upstream secrets", async () => {
    const service = new GitHubAppService({
      config,
      fetchImpl: vi.fn(async () => jsonResponse({ installations: [{
        id: 18492,
        app_id: 99999,
        account: { id: 42, login: "arcadia", type: "User" },
        repository_selection: "all",
        permissions: {},
      }] })),
    });
    await expect(service.verifyAccessibleInstallation("ghu_must-not-leak", "18492"))
      .rejects.toMatchObject({ code: "GITHUB_INSTALLATION_UNVERIFIED" });
    await expect(service.verifyAccessibleInstallation("ghu_must-not-leak", "999"))
      .rejects.not.toThrow(/ghu_must-not-leak/);
  });

  it("caches installation tokens with expiry margin and single-flight", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      token: "ghs_ephemeral",
      expires_at: "2026-08-05T09:00:00.000Z",
    }));
    const service = new GitHubAppService({
      config,
      fetchImpl,
      now: () => new Date("2026-08-05T08:00:00.000Z"),
    });
    const [left, right] = await Promise.all([
      service.getInstallationCredential("18492"),
      service.getInstallationCredential("18492"),
    ]);
    expect(left).toEqual(right);
    expect(left).toEqual({
      provider: "github",
      username: "x-access-token",
      secret: "ghs_ephemeral",
      expiresAt: "2026-08-05T09:00:00.000Z",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    [429, "INTEGRATION_RATE_LIMITED"],
    [500, "INTEGRATION_UPSTREAM_ERROR"],
  ])("maps installation token HTTP %s to %s", async (status, code) => {
    const service = new GitHubAppService({
      config,
      fetchImpl: vi.fn(async () => new Response("upstream-secret", { status })),
    });
    await expect(service.getInstallationCredential("18492")).rejects.toMatchObject({ code });
    await expect(service.getInstallationCredential("18492")).rejects.not.toThrow(/upstream-secret/);
  });
});
