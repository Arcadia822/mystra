import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDb, resetDbForTests } from "@/lib/db";
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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "mystra-github-app-routes-"));
  process.env.MYSTRA_DB_PATH = path.join(tempDir, "mystra.db");
  process.env.MYSTRA_GITHUB_APP_ID = "12345";
  process.env.MYSTRA_GITHUB_APP_CLIENT_ID = "Iv1.fixture";
  process.env.MYSTRA_GITHUB_APP_CLIENT_SECRET = "client-secret";
  process.env.MYSTRA_GITHUB_APP_SLUG = "mystra-fixture";
  process.env.MYSTRA_GITHUB_APP_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.MYSTRA_GITHUB_APP_CALLBACK_URL = "http://localhost/api/integration-connections/github/oauth/callback";
  resetDbForTests();
  resetGitHubAppServiceForTests();
  resetSecretProviderForTests();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  resetGitHubAppServiceForTests();
  resetSecretProviderForTests();
  resetDbForTests();
  for (const key of Object.keys(process.env).filter((key) => key.startsWith("MYSTRA_GITHUB_APP_"))) {
    delete process.env[key];
  }
  delete process.env.MYSTRA_DB_PATH;
  delete process.env.MYSTRA_SECRET_STORE_KEY;
  delete process.env.MYSTRA_SECRET_STORE_PATH;
  await rm(tempDir, { recursive: true, force: true });
});

describe("self-hosted GitHub connection routes", () => {
  it("lists only PAT even when complete GitHub App secrets are present", async () => {
    getDb().activateIntegrationConnection({
      integration: "github",
      provider: "github",
      externalId: "18492",
      account: { externalId: "42", login: "arcadia", type: "User" },
      repositorySelection: "selected",
      permissions: { contents: "write", pull_requests: "write" },
    });
    const response = await listConnections();
    const body = await response.json();
    expect(body).toEqual({
      providers: [{
        integration: "github",
        methods: [
          {
            type: "personal-access-token",
            configured: false,
            createUrl: "/api/integration-connections/github/pat",
            disabledReason: "Secret store is not configured",
          },
        ],
      }],
      connections: [],
    });
    expect(JSON.stringify(body)).not.toMatch(/github-app|connectUrl|client-secret|private.key|github_pat_|credentialRef/i);
  });

  it("creates and deletes a PAT connection without returning plaintext or secret references", async () => {
    process.env.MYSTRA_SECRET_STORE_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.MYSTRA_SECRET_STORE_PATH = path.join(tempDir, "secrets");
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
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "github_pat_route_secret", displayName: "Delivery" }),
      },
    ));
    const body = await created.json();

    expect(created.status).toBe(201);
    expect(created.headers.get("cache-control")).toBe("no-store");
    expect(body.connection).toMatchObject({
      connectionType: "personal-access-token",
      displayName: "Delivery",
      credentialState: "ready",
    });
    expect(JSON.stringify(body)).not.toMatch(/github_pat_route_secret|credentialRef|fingerprint/);
    const record = getDb().getIntegrationConnectionRecord(body.connection.id);
    expect(record?.credentialRef).toBe(`github-pat/${body.connection.id}`);
    expect(JSON.stringify(record)).not.toContain("github_pat_route_secret");

    const deleted = await deleteConnection(
      new Request(`http://localhost/api/integration-connections/${body.connection.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: body.connection.id }) },
    );
    expect(deleted.status).toBe(204);
    expect(getDb().getIntegrationConnection(body.connection.id)).toBeUndefined();
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
    expect(getDb().listIntegrationConnections()).toEqual([]);
  });
});
