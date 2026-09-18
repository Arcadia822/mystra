import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import type { Server } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDb, resetDbForTests } from "@/lib/db";
import { IntegrationRegistry } from "@/lib/integrations/registry";
import { EventRuntime } from "@/lib/events/event-runtime";
import { EventDedupTable } from "@/lib/events/dedup";
import { WebhookIngressHandler } from "@/lib/events/ingress";
import { WebhookWorkerPipeline } from "@/lib/events/pipeline";
import type { IntegrationPlugin } from "@/lib/integrations/types";
import type { NormalizedEvent } from "@mystra/shared";

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
describe("Webhook ingress and worker pipeline", () => {
  let server: Server;
  let baseUrl: string;
  let dispatchedEvents: NormalizedEvent[] = [];
  let runtime: EventRuntime;
  let dedup: EventDedupTable;
  let tempDir: string;
  const fixturePlugin: IntegrationPlugin = {
    descriptor: {
      name: "linear",
      provider: "linear",
      capabilities: ["events"],
    },
    capabilities: {
      events: {
        descriptors: [
          {
            integration: "linear",
            eventType: "linear.issue.state_changed",
            subjectType: "issue",
            filters: [{ key: "status", operator: "eq", valueType: "string" }],
          },
        ],
        parseWebhook({ rawBody }) {
          const body = JSON.parse(rawBody) as { id?: string; status?: string; teamId?: string };
          if (!body.id) {
            return { kind: "ignored", reason: "missing id" };
          }
          return {
            kind: "events",
            events: [
              {
                providerEventId: body.id,
                eventType: "linear.issue.state_changed",
                subject: { type: "issue", externalId: body.id },
                occurredAt: new Date().toISOString(),
                scope: { scopeType: "linear-team", scopeExternalId: body.teamId ?? "team-ext-1" },
                changes: { status: body.status },
              },
            ],
          };
        },
        validateFilters(_type, filters) {
          return filters;
        },
        matches(_type, _filters, _event) {
          return true;
        },
      },
    },
  };

  const migrations = [
    "20260806182000_init",
    "20260806210000_secret_envelopes",
    "20260807150000_identity_team_rbac",
    "20260807181000_runtime_provider",
    "20260808173000_project_issue_sources",
    "20260917000000_integration_webhook_endpoints",
  ].map((d) => readFileSync(path.join(process.cwd(), `prisma/sqlite/migrations/${d}/migration.sql`), "utf8"));

  beforeAll(async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "mystra-ingress-test-"));
    process.env.MYSTRA_DB_PATH = path.join(tempDir, "mystra.db");
    const database = new Database(process.env.MYSTRA_DB_PATH);
    for (const m of migrations) database.exec(m);
    database.close();

    const db = await getDb();
    const registry = new IntegrationRegistry([fixturePlugin]);
    dedup = new EventDedupTable({ sweeperIntervalMs: 0 });

    const pipeline = new WebhookWorkerPipeline(db, registry, dedup, {
      dispatch(event) {
        dispatchedEvents.push(event);
      },
    });

    runtime = new EventRuntime(async (item, signal) => {
      await pipeline.process(item, signal);
    }, { sweeperIntervalMs: 0 });

    const ingress = new WebhookIngressHandler(db, registry, runtime);

    server = createServer((req, res) => {
      void ingress.handle(req, res);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    server.close();
    await runtime.shutdown();
    dedup.close();
    await resetDbForTests();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("handles valid webhook -> returns 200 immediately -> delivers asynchronously", async () => {
    const db = await getDb();
    const user = await db.registerLocalUser({
      username: "u_ing_1",
      displayName: "User 1",
      passwordHash: "h",
      passwordSalt: "s",
      passwordParams: "p",
      initialTeamDisplayName: "Team 1",
      tokenHash: "th1",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });

    const conn = await db.upsertIntegrationConnectionWithSecret(
      {
        id: crypto.randomUUID(),
        teamId: user.initialTeam.id,
        integration: "linear",
        provider: "linear",
        authMethod: "api-key",
        providerExternalId: "ext-conn-1",
        providerSubject: { name: "Fixture" },
        connectionConfig: {},
        capabilities: {
          events: { state: "enabled", config: {}, permissions: {}, accessSummary: {}, verifiedAt: null },
        },
        status: "active",
        credentialState: "ready",
        credentialRef: "ref-1",
      },
      envelope("ref-1"),
    );

    const endpoint = await db.createIntegrationWebhookEndpoint({
      teamId: user.initialTeam.id,
      connectionId: conn.id,
    });

    const repoConn = await db.upsertIntegrationConnectionWithSecret(
      {
        id: crypto.randomUUID(),
        teamId: user.initialTeam.id,
        integration: "github",
        provider: "github",
        authMethod: "pat",
        providerExternalId: "gh-ext-1",
        providerSubject: { login: "octo" },
        connectionConfig: {},
        capabilities: {
          repositories: { state: "enabled", config: {}, permissions: {}, accessSummary: {}, verifiedAt: null },
        },
        status: "active",
        credentialState: "ready",
        credentialRef: "ref-repo-1",
      },
      envelope("ref-repo-1"),
    );

    const project = await db.createProject({
      teamId: user.initialTeam.id,
      name: "Proj 1",
      slug: `p-${crypto.randomUUID().slice(0, 8)}`,
      repositoryConnectionId: repoConn.id,
      repositoryExternalId: "repo-1",
      repositoryBaseBranch: "main",
      metadata: {},
    });

    await db.upsertProjectIssueSource({
      teamId: user.initialTeam.id,
      projectId: project.id,
      connectionId: conn.id,
      integration: "linear",
      scopeType: "linear-team",
      scopeExternalId: "team-ext-1",
    });

    // Valid webhook POST
    const res = await fetch(`${baseUrl}/api/webhooks?token=${endpoint.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "evt-1", status: "open", teamId: "team-ext-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true });

    // Wait for async worker
    await new Promise((r) => setTimeout(r, 100));
    expect(dispatchedEvents.some((e) => e.id.includes("evt-1"))).toBe(true);
  });

  it("rejects non-POST requests with 405", async () => {
    const res = await fetch(`${baseUrl}/api/webhooks?token=some-token`, {
      method: "GET",
    });
    expect(res.status).toBe(405);
  });

  it("rejects missing or invalid token with 401", async () => {
    const resMissing = await fetch(`${baseUrl}/api/webhooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(resMissing.status).toBe(401);

    const resInvalid = await fetch(`${baseUrl}/api/webhooks?token=invalid-uuid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(resInvalid.status).toBe(401);
  });

  it("rejects non-json content-type with 415", async () => {
    const res = await fetch(`${baseUrl}/api/webhooks?token=some-token`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hello",
    });
    expect(res.status).toBe(415);
  });

  it("rejects compressed encoding with 415", async () => {
    const res = await fetch(`${baseUrl}/api/webhooks?token=some-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" },
      body: "{}",
    });
    expect(res.status).toBe(415);
  });
});
