import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  EVENT_PROTOCOL_VERSION,
  EVENT_SUBPROTOCOL,
  clientWsMessageSchema,
  eventCatalogResponseSchema,
  serverHelloMessageSchema,
  serverSubscribedMessageSchema,
  type NormalizedEvent,
} from "@mystra/shared";
import { WebSocketServer, type WebSocket } from "ws";

const cliEntry = fileURLToPath(new URL("../bin/mystra-agent", import.meta.url));
const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const TOKEN = "cli-smoke-token-1234567890";

interface Harness {
  origin: string;
  activeSubscriptions: () => number;
  close(): Promise<void>;
}

async function startHarness(): Promise<Harness> {
  const subscriptions = new Set<string>();
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    handleProtocols: (protocols) => (protocols.has(EVENT_SUBPROTOCOL) ? EVENT_SUBPROTOCOL : false),
  });

  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const authorized = request.headers.authorization === `Bearer ${TOKEN}`;
    const teamId = url.searchParams.get("teamId");
    if (url.pathname === "/api/events/catalog") {
      if (!authorized || teamId !== TEAM_ID) {
        response.writeHead(403, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { code: "forbidden", message: "forbidden" } }));
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(eventCatalogResponseSchema.parse({
        protocolVersion: EVENT_PROTOCOL_VERSION,
        delivery: "online-only",
        events: [{
          integration: "linear",
          eventType: "linear.issue.state_changed",
          subjectType: "issue",
          filters: [{ key: "changes.state.to", operator: "eq", valueType: "string" }],
        }],
      })));
      return;
    }
    response.writeHead(404).end();
  });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const authorized = request.headers.authorization === `Bearer ${TOKEN}`;
    if (url.pathname !== "/api/events/stream" || !authorized || url.searchParams.get("teamId") !== TEAM_ID) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nconnection: close\r\ncontent-length: 0\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (websocket) => {
      const connectionId = `connection-${subscriptions.size + 1}`;
      websocket.on("close", () => {
        for (const key of [...subscriptions]) {
          if (key.startsWith(`${connectionId}:`)) subscriptions.delete(key);
        }
      });
      websocket.send(JSON.stringify(serverHelloMessageSchema.parse({
        protocolVersion: EVENT_PROTOCOL_VERSION,
        type: "hello",
        connectionId,
        delivery: "online-only",
        heartbeatIntervalMs: 30000,
        pongTimeoutMs: 10000,
        maxSubscriptions: 32,
      })));
      websocket.on("message", (data) => {
        const parsed = clientWsMessageSchema.safeParse(JSON.parse(data.toString()));
        if (!parsed.success) return;
        if (parsed.data.type === "subscribe") {
          subscriptions.add(`${connectionId}:${parsed.data.subscriptionId}`);
          websocket.send(JSON.stringify(serverSubscribedMessageSchema.parse({
            protocolVersion: EVENT_PROTOCOL_VERSION,
            type: "subscribed",
            requestId: parsed.data.requestId,
            subscriptionId: parsed.data.subscriptionId,
          })));
          const event: NormalizedEvent = {
            id: "linear:delivery-1:linear.issue.state_changed",
            integration: "linear",
            eventType: "linear.issue.state_changed",
            projectId: PROJECT_ID,
            subject: { type: "issue", externalId: "issue-1" },
            occurredAt: "2026-09-17T10:00:00.000Z",
            receivedAt: "2026-09-17T10:00:01.000Z",
            changes: { state: { from: "s1", to: "review" } },
          };
          websocket.send(JSON.stringify({
            protocolVersion: EVENT_PROTOCOL_VERSION,
            type: "event",
            subscriptionId: parsed.data.subscriptionId,
            event,
          }));
          return;
        }
        subscriptions.delete(`${connectionId}:${parsed.data.subscriptionId}`);
        websocket.send(JSON.stringify({
          protocolVersion: EVENT_PROTOCOL_VERSION,
          type: "unsubscribed",
          requestId: parsed.data.requestId,
          subscriptionId: parsed.data.subscriptionId,
        }));
      });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    activeSubscriptions: () => subscriptions.size,
    close: async () => {
      for (const client of wss.clients as Set<WebSocket>) client.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

interface CliProcess {
  child: ChildProcessWithoutNullStreams;
  stdout: () => string;
  stderr: () => string;
  done: Promise<number | null>;
}

function startCli(args: string[], env: Record<string, string>): CliProcess {
  const child = spawn(process.execPath, [cliEntry, ...args], {
    cwd: packageRoot,
    env: { ...process.env, ...env },
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  return {
    child,
    stdout: () => stdout,
    stderr: () => stderr,
    done: new Promise((resolve) => child.on("close", (code) => resolve(code))),
  };
}

async function runCli(args: string[], env: Record<string, string> = {}): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const cli = startCli(args, env);
  const code = await cli.done;
  return { code, stdout: cli.stdout(), stderr: cli.stderr() };
}

async function waitFor(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("condition not met in time");
}

describe("mystra-agent events command", () => {
  let harness: Harness;
  let tempDir: string;
  let sessionPath: string;

  beforeAll(async () => {
    harness = await startHarness();
    tempDir = mkdtempSync(path.join(tmpdir(), "mystra-cli-events-"));
    sessionPath = path.join(tempDir, "operator-session.json");
    writeFileSync(sessionPath, JSON.stringify({
      version: 1,
      controlPlaneUrl: harness.origin,
      sessionToken: TOKEN,
    }), { mode: 0o600 });
    chmodSync(sessionPath, 0o600);
  });

  afterAll(async () => {
    await harness.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("lists the event catalog without leaking the session token", async () => {
    const result = await runCli(["events", "list", "--team", TEAM_ID, "--session-file", sessionPath]);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).events[0].eventType).toBe("linear.issue.state_changed");
    expect(result.stdout).not.toContain(TOKEN);
    expect(result.stderr).not.toContain(TOKEN);
  });

  it("subscribes over a real WebSocket, writes frames to stdout and diagnostics to stderr, then clears server state on SIGTERM", async () => {
    const cli = startCli([
      "events", "subscribe",
      "--team", TEAM_ID,
      "--project", PROJECT_ID,
      "--integration", "linear",
      "--event-type", "linear.issue.state_changed",
      "--subscription-id", "review",
      "--filter", "changes.state.to=review",
      "--session-file", sessionPath,
    ], {});

    await waitFor(() => cli.stdout().includes('"type":"event"')).catch(() => {
      throw new Error(`CLI never emitted an event frame. stdout=${JSON.stringify(cli.stdout())} stderr=${JSON.stringify(cli.stderr())}`);
    });
    expect(harness.activeSubscriptions()).toBe(1);

    cli.child.kill("SIGTERM");
    const code = await cli.done;

    expect(code).toBe(143);
    const frames = cli.stdout().trim().split("\n").map((line) => JSON.parse(line) as { type: string });
    expect(frames.map((frame) => frame.type)).toEqual(["hello", "subscribed", "event"]);
    expect(cli.stdout()).not.toContain(TOKEN);
    expect(cli.stderr()).toContain("online-only");
    expect(cli.stderr()).not.toContain(TOKEN);

    await waitFor(() => harness.activeSubscriptions() === 0);
  });

  it("exits 2 for usage errors without writing to stdout", async () => {
    const usage = await runCli(["events", "subscribe", "--team", TEAM_ID], {});
    expect(usage.code).toBe(2);
    expect(usage.stdout).toBe("");

    const unknownFlag = await runCli(["events", "list", "--team", TEAM_ID, "--bogus", "x"], {});
    expect(unknownFlag.code).toBe(2);

    const badUuid = await runCli(["events", "list", "--team", "not-a-uuid"], {});
    expect(badUuid.code).toBe(2);
  });

  it("exits 2 for a missing session file and 4 for rejected authorization", async () => {
    const missing = await runCli([
      "events", "list", "--team", TEAM_ID, "--session-file", path.join(tempDir, "absent.json"),
    ]);
    expect(missing.code).toBe(2);

    const otherSession = path.join(tempDir, "other.json");
    writeFileSync(otherSession, JSON.stringify({
      version: 1,
      controlPlaneUrl: harness.origin,
      sessionToken: "an-invalid-but-well-formed-token",
    }), { mode: 0o600 });
    chmodSync(otherSession, 0o600);
    const unauthorized = await runCli([
      "events", "list", "--team", TEAM_ID, "--session-file", otherSession,
    ]);
    expect(unauthorized.code).toBe(4);
  });
});
