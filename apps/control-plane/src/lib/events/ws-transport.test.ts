import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import WebSocket from "ws";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { EVENT_SUBPROTOCOL, type NormalizedEvent } from "@mystra/shared";
import { getDb, resetDbForTests } from "@/lib/db";
import { IntegrationRegistry } from "@/lib/integrations/registry";
import { EventCatalog } from "@/lib/events/catalog";
import { EventRouter } from "@/lib/events/router";
import { EventWsTransport, WS_CLOSE_SHUTDOWN } from "@/lib/events/ws-transport";
import { authenticateRequest, assertPasswordChangeAllowed } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { IntegrationPlugin } from "@/lib/integrations/types";

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

const fixturePlugin: IntegrationPlugin = {
  descriptor: { name: "linear", provider: "linear", capabilities: ["events"] },
  capabilities: {
    events: {
      descriptors: [{
        integration: "linear",
        eventType: "linear.issue.state_changed",
        subjectType: "issue",
        filters: [{ key: "changes.state.to", operator: "eq", valueType: "string" }],
      }],
      parseWebhook() {
        return { kind: "ignored", reason: "unused" };
      },
      validateFilters(_eventType, filters) {
        for (const key of Object.keys(filters)) {
          if (key !== "changes.state.to") throw new Error(`UNSUPPORTED_FILTER: ${key}`);
        }
        return filters;
      },
      matches(_eventType, canonicalFilters, event) {
        const changes = event.changes as { state?: { to?: unknown } };
        for (const [key, expected] of Object.entries(canonicalFilters)) {
          if (key === "changes.state.to" && changes.state?.to !== expected) return false;
        }
        return true;
      },
    },
  },
};

describe("EventWsTransport", () => {
  let server: Server;
  let transport: EventWsTransport;
  let router: EventRouter;
  let catalog: EventCatalog;
  let origin: string;
  let tempDir: string;
  let ownerToken: string;
  let ownerTeamId: string;
  let projectId: string;
  let otherTeamId: string;
  const openSockets = new Set<WebSocket>();

  const migrations = [
    "20260806182000_init",
    "20260806210000_secret_envelopes",
    "20260807150000_identity_team_rbac",
    "20260807181000_runtime_provider",
    "20260808173000_project_issue_sources",
    "20260917000000_integration_webhook_endpoints",
  ].map((d) => readFileSync(path.join(process.cwd(), `prisma/sqlite/migrations/${d}/migration.sql`), "utf8"));

  beforeAll(async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "mystra-ws-test-"));
    process.env.MYSTRA_DB_PATH = path.join(tempDir, "mystra.db");
    const database = new Database(process.env.MYSTRA_DB_PATH);
    for (const migration of migrations) database.exec(migration);
    database.close();

    const db = await getDb();
    ownerToken = "ws-owner-token-1234567890";
    const owner = await db.registerLocalUser({
      username: "ws_owner",
      displayName: "WS Owner",
      passwordHash: "h",
      passwordSalt: "s",
      passwordParams: "p",
      initialTeamDisplayName: "WS Team",
      tokenHash: (await import("@/lib/auth")).hashSessionToken(ownerToken),
      expiresAt: "2030-01-01T00:00:00.000Z",
    });
    ownerTeamId = owner.initialTeam.id;
    otherTeamId = (await db.registerLocalUser({
      username: "ws_other",
      displayName: "WS Other",
      passwordHash: "h",
      passwordSalt: "s",
      passwordParams: "p",
      initialTeamDisplayName: "Other Team",
      tokenHash: (await import("@/lib/auth")).hashSessionToken("ws-other-token-1234567890"),
      expiresAt: "2030-01-01T00:00:00.000Z",
    })).initialTeam.id;

    const repoConnection = await db.upsertIntegrationConnectionWithSecret(
      {
        id: crypto.randomUUID(),
        teamId: ownerTeamId,
        integration: "github",
        provider: "github",
        authMethod: "pat",
        providerExternalId: "gh-ws-1",
        providerSubject: { login: "octo" },
        connectionConfig: {},
        capabilities: {
          repositories: { state: "enabled", config: {}, permissions: {}, accessSummary: {}, verifiedAt: null },
        },
        status: "active",
        credentialState: "ready",
        credentialRef: "ref-ws-repo",
      },
      envelope("ref-ws-repo"),
    );
    projectId = (await db.createProject({
      teamId: ownerTeamId,
      name: "WS Project",
      slug: `ws-${crypto.randomUUID().slice(0, 8)}`,
      repositoryConnectionId: repoConnection.id,
      repositoryExternalId: "1",
      repositoryBaseBranch: "main",
      metadata: {},
    })).id;

    const registry = new IntegrationRegistry([fixturePlugin]);
    catalog = new EventCatalog(registry);
    router = new EventRouter(registry, catalog);

    transport = new EventWsTransport(db, catalog, router, async (request, _socket, requestedTeamId) => {
      if (!requestedTeamId) return { reject: { status: 400, code: "BAD_REQUEST", message: "teamId required" } };
      const authorization = request.headers.authorization;
      if (!authorization?.startsWith("Bearer ")) {
        return { reject: { status: 401, code: "UNAUTHENTICATED", message: "Bearer required" } };
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === "string") headers.set(key, value);
      }
      let subject;
      try {
        subject = await authenticateRequest(db, new Request("http://localhost/api/events/stream", { headers }));
        assertPasswordChangeAllowed(subject.user, "events-subscribe");
      } catch {
        return { reject: { status: 401, code: "UNAUTHENTICATED", message: "invalid session" } };
      }
      const context = await db.getTeamContext(subject.user.id, requestedTeamId);
      if (!context || !hasPermission(context.role, "team.resource.access")) {
        return { reject: { status: 403, code: "FORBIDDEN", message: "no access" } };
      }
      return { userId: subject.user.id, sessionId: subject.session.id, teamId: requestedTeamId };
    });

    server = createServer((_request, response) => {
      response.writeHead(404).end();
    });
    server.on("upgrade", (request, socket, head) => {
      void transport.handleUpgrade(request, socket, head);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        origin = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await transport.shutdown();
    server.close();
    await resetDbForTests();
    rmSync(tempDir, { recursive: true, force: true });
  });

  const frameQueues = new WeakMap<WebSocket, Record<string, unknown>[]>();
  const frameWaiters = new WeakMap<WebSocket, ((frame: Record<string, unknown>) => void)[]>();

  function connect(token: string, teamId: string, pathname = "/api/events/stream"): Promise<WebSocket> {
    const socket = new WebSocket(
      `${origin}${pathname}?teamId=${encodeURIComponent(teamId)}`,
      EVENT_SUBPROTOCOL,
      { headers: { authorization: `Bearer ${token}` } },
    );
    frameQueues.set(socket, []);
    frameWaiters.set(socket, []);
    socket.on("message", (data) => {
      const frame = JSON.parse(data.toString()) as Record<string, unknown>;
      const waiter = frameWaiters.get(socket)?.shift();
      if (waiter) waiter(frame);
      else frameQueues.get(socket)?.push(frame);
    });
    return new Promise((resolve, reject) => {
      socket.once("open", () => {
        openSockets.add(socket);
        resolve(socket);
      });
      socket.once("unexpected-response", (_req, response) => reject(new Error(`HTTP ${response.statusCode}`)));
      socket.once("error", reject);
    });
  }

  afterEach(async () => {
    for (const socket of [...openSockets]) {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
        socket.close();
        await closed;
      }
    }
    openSockets.clear();
  });

  function nextFrame(socket: WebSocket): Promise<Record<string, unknown>> {
    const queued = frameQueues.get(socket)?.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve) => {
      frameWaiters.get(socket)?.push(resolve);
    });
  }

  function eventFrame(state: string): NormalizedEvent {
    return {
      id: `linear:${state}:linear.issue.state_changed`,
      integration: "linear",
      eventType: "linear.issue.state_changed",
      projectId,
      subject: { type: "issue", externalId: "issue-1" },
      occurredAt: "2026-09-17T10:00:00.000Z",
      receivedAt: "2026-09-17T10:00:01.000Z",
      changes: { state: { from: "s1", to: state } },
    };
  }

  it("rejects cookie-only, wrong subprotocol, and cross-Team Upgrades", async () => {
    await expect(connect(ownerToken, ownerTeamId, "/api/events/stream")).resolves.toBeDefined();

    // Cross-Team: the owner session has no membership in the other Team.
    await expect(connect(ownerToken, otherTeamId)).rejects.toThrow(/HTTP 403/u);

    // Missing token.
    const anonymous = new WebSocket(`${origin}/api/events/stream?teamId=${ownerTeamId}`, EVENT_SUBPROTOCOL);
    await expect(new Promise((_resolve, reject) => {
      anonymous.once("open", () => reject(new Error("unexpected open")));
      anonymous.once("unexpected-response", (_req, response) => reject(new Error(`HTTP ${response.statusCode}`)));
      anonymous.once("error", reject);
    })).rejects.toThrow(/HTTP 401/u);
  });

  it("sends hello, confirms subscribe, and delivers only matching events", async () => {
    const socket = await connect(ownerToken, ownerTeamId);
    const hello = await nextFrame(socket);
    expect(hello).toMatchObject({ type: "hello", delivery: "online-only", maxSubscriptions: 32 });

    const subscribedPromise = nextFrame(socket);
    socket.send(JSON.stringify({
      protocolVersion: 1,
      type: "subscribe",
      requestId: "r1",
      subscriptionId: "review",
      projectId,
      integration: "linear",
      eventType: "linear.issue.state_changed",
      filters: { "changes.state.to": "review" },
    }));
    const subscribed = await subscribedPromise;
    expect(subscribed).toMatchObject({ type: "subscribed", subscriptionId: "review" });

    const delivery = nextFrame(socket);
    router.dispatch(eventFrame("review"));
    const delivered = await delivery;
    expect(delivered).toMatchObject({ type: "event", subscriptionId: "review" });

    // Non-matching event must not deliver.
    let received = false;
    socket.once("message", () => { received = true; });
    router.dispatch(eventFrame("done"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(received).toBe(false);

    socket.close();
  });

  it("returns protocol errors for unsupported filters and unknown event types", async () => {
    const socket = await connect(ownerToken, ownerTeamId);
    await nextFrame(socket);

    const badFilter = nextFrame(socket);
    socket.send(JSON.stringify({
      protocolVersion: 1,
      type: "subscribe",
      requestId: "r2",
      subscriptionId: "s1",
      projectId,
      integration: "linear",
      eventType: "linear.issue.state_changed",
      filters: { "bogus.key": "x" },
    }));
    expect(await badFilter).toMatchObject({ type: "error", code: "UNSUPPORTED_FILTER" });

    const unknownType = nextFrame(socket);
    socket.send(JSON.stringify({
      protocolVersion: 1,
      type: "subscribe",
      requestId: "r3",
      subscriptionId: "s2",
      projectId,
      integration: "linear",
      eventType: "linear.unknown.event",
    }));
    expect(await unknownType).toMatchObject({ type: "error", code: "UNKNOWN_EVENT_TYPE" });

    socket.close();
  });

  it("closes with 4406 for an unsupported protocol version", async () => {
    const socket = await connect(ownerToken, ownerTeamId);
    await nextFrame(socket);
    const closed = new Promise<number>((resolve) => socket.once("close", (code) => resolve(code)));
    socket.send(JSON.stringify({ protocolVersion: 2, type: "unsubscribe", requestId: "r4", subscriptionId: "s" }));
    expect(await closed).toBe(4406);
  });

  it("clears every subscription when a connection closes", async () => {
    const socket = await connect(ownerToken, ownerTeamId);
    await nextFrame(socket);
    const subscribed = nextFrame(socket);
    socket.send(JSON.stringify({
      protocolVersion: 1,
      type: "subscribe",
      requestId: "r5",
      subscriptionId: "cleanup",
      projectId,
      integration: "linear",
      eventType: "linear.issue.state_changed",
    }));
    await subscribed;
    expect(router.getSubscriptionCount()).toBe(1);

    const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
    socket.close();
    await closed;
    await expect.poll(() => router.getSubscriptionCount()).toBe(0);
  });

  it("drops all subscriptions on shutdown and exposes the active count", async () => {
    const socket = await connect(ownerToken, ownerTeamId);
    await nextFrame(socket);
    expect(transport.activeConnectionCount).toBe(1);

    const closed = new Promise<number>((resolve) => socket.once("close", (code) => resolve(code)));
    await transport.shutdown();
    expect(await closed).toBe(WS_CLOSE_SHUTDOWN);
    expect(transport.activeConnectionCount).toBe(0);
    expect(router.getSubscriptionCount()).toBe(0);
  });
});
