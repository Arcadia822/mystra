import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDb, resetDbForTests } from "@/lib/db";
import { hashSessionToken } from "@/lib/auth";
import { resetGitHubAppServiceForTests } from "@/lib/integrations/github-app";
import { resetSecretProviderForTests } from "@/lib/secrets";
import { DELETE as deleteConnection } from "./integration-connections/[id]/route";
import { GET as listConnections } from "./integration-connections/route";
import { POST as createPatConnection } from "./integration-connections/github/pat/route";
import { GET as connectGitHub } from "./integration-connections/github/connect/route";
import { GET as setupGitHub } from "./integration-connections/github/setup/route";
import { GET as finishGitHubOAuth } from "./integration-connections/github/oauth/callback/route";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
let tempDir: string;
const sessionToken = "integration-routes-session-token";
const migrations = [
  "20260806182000_init",
  "20260806210000_secret_envelopes",
  "20260807150000_identity_team_rbac",
].map((directory) => readFileSync(
  path.join(process.cwd(), `prisma/sqlite/migrations/${directory}/migration.sql`),
  "utf8",
));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(async () => {
  await resetDbForTests();
  tempDir = await mkdtemp(path.join(tmpdir(), "mystra-github-app-routes-"));
  process.env.MYSTRA_DB_PATH = path.join(tempDir, "mystra.db");
  const database = new Database(process.env.MYSTRA_DB_PATH);
  for (const migration of migrations) database.exec(migration);
  database.close();
  const db = await getDb();
  await db.registerLocalUser({
    username: "integration_routes_user",
    passwordHash: "scrypt$v1$hash",
    passwordSalt: "salt",
    passwordParams: "N=16384,r=8,p=1",
    initialTeamDisplayName: "Integration Routes Team",
    tokenHash: hashSessionToken(sessionToken),
    expiresAt: "2027-08-06T00:00:00.000Z",
  });
  process.env.MYSTRA_GITHUB_APP_ID = "12345";
  process.env.MYSTRA_GITHUB_APP_CLIENT_ID = "Iv1.fixture";
  process.env.MYSTRA_GITHUB_APP_CLIENT_SECRET = "client-secret";
  process.env.MYSTRA_GITHUB_APP_SLUG = "mystra-fixture";
  process.env.MYSTRA_GITHUB_APP_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.MYSTRA_GITHUB_APP_CALLBACK_URL = "http://localhost/api/integration-connections/github/oauth/callback";
  resetGitHubAppServiceForTests();
  resetSecretProviderForTests();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  resetGitHubAppServiceForTests();
  resetSecretProviderForTests();
  await resetDbForTests();
  for (const key of Object.keys(process.env).filter((key) => key.startsWith("MYSTRA_GITHUB_APP_"))) {
    delete process.env[key];
  }
  delete process.env.MYSTRA_DB_PATH;
  delete process.env.MYSTRA_SECRET_STORE_KEY;
  delete process.env.MYSTRA_SECRET_STORE_KEY_ID;
  await rm(tempDir, { recursive: true, force: true });
});

describe("self-hosted Integration connection routes", () => {
  it("lists only self-hosted credential methods even when complete GitHub App secrets are present", async () => {
    const response = await listConnections(new Request(
      "http://localhost/api/integration-connections",
      { headers: { authorization: `Bearer ${sessionToken}` } },
    ));
    const body = await response.json();
    expect(body).toEqual({
      providers: [
        {
          integration: "github",
          methods: [
            {
              type: "personal-access-token",
              configured: false,
              createUrl: "/api/integration-connections/github/pat",
              disabledReason: "Secret store is not configured",
            },
          ],
        },
        {
          integration: "linear",
          methods: [
            {
              type: "api-key",
              configured: false,
              createUrl: "/api/integration-connections/linear/api-key",
              disabledReason: "Secret store is not configured",
            },
          ],
        },
      ],
      connections: [],
    });
    expect(JSON.stringify(body)).not.toMatch(/github-app|connectUrl|client-secret|private.key|github_pat_|credentialRef/i);
  });

  it("creates and deletes a PAT connection without returning plaintext or secret references", async () => {
    process.env.MYSTRA_SECRET_STORE_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.MYSTRA_SECRET_STORE_KEY_ID = "route-test-v1";
    resetSecretProviderForTests();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 42, login: "arcadia", type: "User" }))
      .mockResolvedValueOnce(jsonResponse([{
        id: 101,
        full_name: "arcadia/mystra",
        permissions: { pull: true, push: true, admin: false },
      }])));

    const created = await createPatConnection(new Request(
      "http://localhost/api/integration-connections/github/pat",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${sessionToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ token: "github_pat_route_secret", displayName: "Delivery" }),
      },
    ));
    const body = await created.json();

    expect(created.status).toBe(201);
    expect(created.headers.get("cache-control")).toBe("no-store");
    expect(body.connection).toMatchObject({
      authMethod: "personal-access-token",
      displayName: "Delivery",
      credentialState: "ready",
    });
    expect(JSON.stringify(body)).not.toMatch(/github_pat_route_secret|credentialRef|fingerprint/);
    const db = await getDb();
    const record = await db.getIntegrationConnectionRecord(body.connection.id);
    expect(record?.credentialRef).toMatch(new RegExp(`^github-pat/${body.connection.id}/`));
    expect(JSON.stringify(record)).not.toContain("github_pat_route_secret");

    const deleted = await deleteConnection(
      new Request(`http://localhost/api/integration-connections/${body.connection.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${sessionToken}` },
      }),
      { params: Promise.resolve({ id: body.connection.id }) },
    );
    expect(deleted.status).toBe(204);
    expect(await db.getIntegrationConnection(body.connection.id)).toBeUndefined();
  });

  it("blocks every GitHub App route before redirect, OAuth exchange, or persistence", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const responses = await Promise.all([
      connectGitHub(new Request("http://localhost/api/integration-connections/github/connect?returnTo=%2Ftasks")),
      setupGitHub(new Request("http://localhost/api/integration-connections/github/setup?installation_id=18492")),
      finishGitHubOAuth(new Request("http://localhost/api/integration-connections/github/oauth/callback?code=oauth-code&state=fixture")),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(409);
      expect(response.headers.get("location")).toBeNull();
      expect(await response.json()).toEqual({
        error: {
          code: "INTEGRATION_CONNECTION_METHOD_UNAVAILABLE",
          message: "GitHub App connections are available only on Mystra Cloud",
          details: { reasonCode: "HOSTED_ONLY" },
        },
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await (await getDb()).listIntegrationConnections()).toEqual([]);
  });
});
