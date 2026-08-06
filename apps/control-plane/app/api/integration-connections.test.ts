import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDb, resetDbForTests } from "@/lib/db";
import { resetGitHubAppServiceForTests } from "@/lib/integrations/github-app";
import { GET as listConnections } from "./integration-connections/route";
import { GET as connectGitHub } from "./integration-connections/github/connect/route";
import { GET as setupGitHub } from "./integration-connections/github/setup/route";
import { GET as finishGitHubOAuth } from "./integration-connections/github/oauth/callback/route";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
let tempDir: string;

function cookieHeader(responses: Response[]): string {
  return responses.flatMap((response) => response.headers.getSetCookie())
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}

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
});

afterEach(async () => {
  vi.unstubAllGlobals();
  resetGitHubAppServiceForTests();
  resetDbForTests();
  for (const key of Object.keys(process.env).filter((key) => key.startsWith("MYSTRA_GITHUB_APP_"))) {
    delete process.env[key];
  }
  delete process.env.MYSTRA_DB_PATH;
  await rm(tempDir, { recursive: true, force: true });
});

describe("GitHub App connection routes", () => {
  it("lists configured provider state without secret fields", async () => {
    const response = await listConnections();
    const body = await response.json();
    expect(body).toEqual({
      providers: [{
        integration: "github",
        connectionType: "github-app-installation",
        configured: true,
        connectUrl: "/api/integration-connections/github/connect",
      }],
      connections: [],
    });
    expect(JSON.stringify(body)).not.toMatch(/client-secret|private.key|token/i);
  });

  it("installs, starts PKCE, verifies exact installation and activates it", async () => {
    const connect = await connectGitHub(new Request("http://localhost/api/integration-connections/github/connect?returnTo=%2Ftasks"));
    expect(connect.status).toBe(307);
    expect(connect.headers.get("location")).toBe("https://github.com/apps/mystra-fixture/installations/new");

    const setup = await setupGitHub(new Request(
      "http://localhost/api/integration-connections/github/setup?installation_id=18492&setup_action=install",
      { headers: { cookie: cookieHeader([connect]) } },
    ));
    expect(setup.status).toBe(307);
    const oauthUrl = new URL(setup.headers.get("location")!);
    expect(oauthUrl.origin + oauthUrl.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(oauthUrl.searchParams.get("code_challenge_method")).toBe("S256");

    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "ghu_ephemeral", token_type: "bearer" }))
      .mockResolvedValueOnce(jsonResponse({ installations: [{
        id: 18492,
        app_id: 12345,
        account: { id: 42, login: "arcadia", type: "User" },
        repository_selection: "selected",
        permissions: { contents: "write", pull_requests: "write" },
      }] })));
    const callback = await finishGitHubOAuth(new Request(
      `http://localhost/api/integration-connections/github/oauth/callback?code=oauth-code&state=${oauthUrl.searchParams.get("state")}`,
      { headers: { cookie: cookieHeader([connect, setup]) } },
    ));

    expect(callback.status).toBe(307);
    expect(callback.headers.get("location")).toBe("http://localhost/tasks?settings=integrations&github=connected");
    expect(getDb().getActiveIntegrationConnection("github")).toMatchObject({ externalId: "18492" });
  });

  it("rejects forged state and never persists the hinted installation", async () => {
    const connect = await connectGitHub(new Request("http://localhost/api/integration-connections/github/connect"));
    const setup = await setupGitHub(new Request(
      "http://localhost/api/integration-connections/github/setup?installation_id=18492",
      { headers: { cookie: cookieHeader([connect]) } },
    ));
    const callback = await finishGitHubOAuth(new Request(
      "http://localhost/api/integration-connections/github/oauth/callback?code=oauth-code&state=forged",
      { headers: { cookie: cookieHeader([connect, setup]) } },
    ));
    expect(callback.headers.get("location")).toContain("github=connection_failed");
    expect(callback.headers.get("location")).toContain("reason=oauth_state_invalid");
    expect(getDb().listIntegrationConnections()).toEqual([]);
  });
});
