import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDb, resetDbForTests } from "@/lib/db";
import { hashSessionToken } from "@/lib/auth";
import { GET as getWebhookRoute } from "./route";

function envelope(reference: string) {
  return {
    reference,
    version: 1 as const,
    algorithm: "aes-256-gcm+aes-256-gcm-wrap" as const,
    keyId: "contract-v1",
    ciphertext: "Y2lwaGVydGV4dA==",
    ciphertextIv: "MDEyMzQ1Njc4OWFi",
    ciphertextAuthTag: "MDEyMzQ1Njc4OWFiY2RlZg==",
    wrappedDataKey: "d3JhcHBlZA==",
    wrappedDataKeyIv: "YWJjZGVmMDEyMzQ1",
    wrappedDataKeyAuthTag: "ZmVkY2JhOTg3NjU0MzIxMA==",
  };
}

describe("GET /api/integration-connections/[id]/webhook", () => {
  let tempDir: string;
  const migrations = [
    "20260806182000_init",
    "20260806210000_secret_envelopes",
    "20260807150000_identity_team_rbac",
    "20260807181000_runtime_provider",
    "20260808173000_project_issue_sources",
    "20260917000000_integration_webhook_endpoints",
  ].map((d) => readFileSync(path.join(process.cwd(), `prisma/sqlite/migrations/${d}/migration.sql`), "utf8"));

  beforeAll(async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "mystra-webhook-route-test-"));
    process.env.MYSTRA_DB_PATH = path.join(tempDir, "mystra.db");
    const database = new Database(process.env.MYSTRA_DB_PATH);
    for (const m of migrations) database.exec(m);
    database.close();
  });

  afterAll(async () => {
    await resetDbForTests();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns stable endpoint and webhookUrl on repeated GETs", async () => {
    const db = await getDb();
    const rawToken = "test-token-1234567890";
    const tokenHash = hashSessionToken(rawToken);
    const user = await db.registerLocalUser({
      username: "user_wh_1",
      displayName: "User WH 1",
      passwordHash: "h",
      passwordSalt: "s",
      passwordParams: "p",
      initialTeamDisplayName: "Team WH",
      tokenHash,
      expiresAt: "2030-01-01T00:00:00.000Z",
    });

    const conn = await db.upsertIntegrationConnectionWithSecret(
      {
        id: crypto.randomUUID(),
        teamId: user.initialTeam.id,
        integration: "linear",
        provider: "linear",
        authMethod: "api-key",
        providerExternalId: "linear-team-ext-1",
        providerSubject: { name: "Linear Org" },
        connectionConfig: { workspaceId: "ws-1" },
        capabilities: {
          events: { state: "enabled", config: {}, permissions: {}, accessSummary: {}, verifiedAt: null },
        },
        status: "active",
        credentialState: "ready",
        credentialRef: "ref-wh-1",
      },
      envelope("ref-wh-1"),
    );

    // Call GET route
    const req1 = new Request(`http://localhost:3000/api/integration-connections/${conn.id}/webhook`, {
      headers: { authorization: `Bearer ${rawToken}` },
    });
    const res1 = await getWebhookRoute(req1, { params: Promise.resolve({ id: conn.id }) });
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.endpoint.id).toBeDefined();
    expect(body1.webhookUrl).toContain(`/api/webhooks?token=${body1.endpoint.id}`);

    // Repeated GET returns exact same endpoint id and url
    const req2 = new Request(`http://localhost:3000/api/integration-connections/${conn.id}/webhook`, {
      headers: { authorization: `Bearer ${rawToken}` },
    });
    const res2 = await getWebhookRoute(req2, { params: Promise.resolve({ id: conn.id }) });
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.endpoint.id).toBe(body1.endpoint.id);
    expect(body2.webhookUrl).toBe(body1.webhookUrl);
  });

  it("returns 409 WEBHOOK_PREREQUISITE_UNAVAILABLE if connection is not ready", async () => {
    const db = await getDb();
    const rawToken = "test-token-2234567890";
    const tokenHash = hashSessionToken(rawToken);
    const user = await db.registerLocalUser({
      username: "user_wh_2",
      displayName: "User WH 2",
      passwordHash: "h",
      passwordSalt: "s",
      passwordParams: "p",
      initialTeamDisplayName: "Team WH 2",
      tokenHash,
      expiresAt: "2030-01-01T00:00:00.000Z",
    });

    const conn = await db.upsertIntegrationConnectionWithSecret(
      {
        id: crypto.randomUUID(),
        teamId: user.initialTeam.id,
        integration: "linear",
        provider: "linear",
        authMethod: "api-key",
        providerExternalId: "linear-team-ext-2",
        providerSubject: { name: "Linear Org" },
        connectionConfig: {},
        capabilities: {},
        status: "active",
        credentialState: "missing", // not ready
        credentialRef: "ref-wh-2",
      },
      envelope("ref-wh-2"),
    );

    const req = new Request(`http://localhost:3000/api/integration-connections/${conn.id}/webhook`, {
      headers: { authorization: `Bearer ${rawToken}` },
    });
    const res = await getWebhookRoute(req, { params: Promise.resolve({ id: conn.id }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("WEBHOOK_PREREQUISITE_UNAVAILABLE");
  });

  it("returns 403 for a Member actor and for a cross-tenant actor", async () => {
    const db = await getDb();
    const owner = await db.registerLocalUser({
      username: "user_wh_owner",
      displayName: "Owner",
      passwordHash: "h",
      passwordSalt: "s",
      passwordParams: "p",
      initialTeamDisplayName: "Team Owner",
      tokenHash: hashSessionToken("test-token-3234567890"),
      expiresAt: "2030-01-01T00:00:00.000Z",
    });

    const memberToken = "test-token-4234567890";
    await db.registerLocalUser({
      username: "user_wh_member",
      displayName: "Member",
      passwordHash: "h",
      passwordSalt: "s",
      passwordParams: "p",
      initialTeamDisplayName: "Team Member",
      tokenHash: hashSessionToken(memberToken),
      expiresAt: "2030-01-01T00:00:00.000Z",
    });

    await db.addMemberByUsername(owner.initialTeam.id, "user_wh_member");

    const conn = await db.upsertIntegrationConnectionWithSecret(
      {
        id: crypto.randomUUID(),
        teamId: owner.initialTeam.id,
        integration: "linear",
        provider: "linear",
        authMethod: "api-key",
        providerExternalId: "linear-team-ext-3",
        providerSubject: { name: "Linear Org" },
        connectionConfig: {},
        capabilities: {},
        status: "active",
        credentialState: "ready",
        credentialRef: "ref-wh-3",
      },
      envelope("ref-wh-3"),
    );

    // Member of the Owner's Team: authenticated but lacks team.integration.manage.
    const memberRequest = new Request(`http://localhost:3000/api/integration-connections/${conn.id}/webhook`, {
      headers: {
        authorization: `Bearer ${memberToken}`,
        cookie: `mystra_session=${memberToken}`,
      },
    });
    const memberResponse = await getWebhookRoute(memberRequest, { params: Promise.resolve({ id: conn.id }) });
    expect(memberResponse.status).toBe(403);
    expect((await memberResponse.json()).error.code).toBe("forbidden");
  });

  it("returns 403 for an actor whose Team does not own the connection", async () => {
    const db = await getDb();
    const owner = await db.registerLocalUser({
      username: "user_wh_owner2",
      displayName: "Owner 2",
      passwordHash: "h",
      passwordSalt: "s",
      passwordParams: "p",
      initialTeamDisplayName: "Team Owner 2",
      tokenHash: hashSessionToken("test-token-5234567890"),
      expiresAt: "2030-01-01T00:00:00.000Z",
    });

    const outsiderToken = "test-token-6234567890";
    await db.registerLocalUser({
      username: "user_wh_outsider",
      displayName: "Outsider",
      passwordHash: "h",
      passwordSalt: "s",
      passwordParams: "p",
      initialTeamDisplayName: "Team Outsider",
      tokenHash: hashSessionToken(outsiderToken),
      expiresAt: "2030-01-01T00:00:00.000Z",
    });

    const conn = await db.upsertIntegrationConnectionWithSecret(
      {
        id: crypto.randomUUID(),
        teamId: owner.initialTeam.id,
        integration: "linear",
        provider: "linear",
        authMethod: "api-key",
        providerExternalId: "linear-team-ext-4",
        providerSubject: { name: "Linear Org" },
        connectionConfig: {},
        capabilities: {},
        status: "active",
        credentialState: "ready",
        credentialRef: "ref-wh-4",
      },
      envelope("ref-wh-4"),
    );

    const crossRequest = new Request(`http://localhost:3000/api/integration-connections/${conn.id}/webhook`, {
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    const crossResponse = await getWebhookRoute(crossRequest, { params: Promise.resolve({ id: conn.id }) });
    expect(crossResponse.status).toBe(403);
  });
});
