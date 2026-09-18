import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import next from "next";
import { EVENT_SUBPROTOCOL } from "@mystra/shared";

import { getDb, shutdownDb } from "@/lib/db";
import { defaultIntegrationRegistry } from "@/lib/integrations/registry";
import { authenticateRequest, assertPasswordChangeAllowed } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { EventRuntime } from "@/lib/events/event-runtime";
import { EventDedupTable } from "@/lib/events/dedup";
import { WebhookIngressHandler } from "@/lib/events/ingress";
import { WebhookWorkerPipeline } from "@/lib/events/pipeline";
import { EventCatalog } from "@/lib/events/catalog";
import { EventRouter } from "@/lib/events/router";
import { EventWsTransport, type WsAuthContext } from "@/lib/events/ws-transport";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);

function rejectUpgrade(socket: Duplex, status: number, code: string, message: string): void {
  const body = JSON.stringify({ error: { code, message } });
  socket.write(
    `HTTP/1.1 ${status} ${status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : status === 429 ? "Too Many Requests" : "Bad Request"}\r\n`
    + "content-type: application/json\r\n"
    + `content-length: ${Buffer.byteLength(body)}\r\n`
    + "connection: close\r\n\r\n"
    + body,
  );
  socket.end();
}

/**
 * Authorizes `GET /api/events/stream` before the socket is upgraded. Only an
 * explicit human AuthSession Bearer token is accepted: cookie-only, webhook
 * endpoint ids, and workload execution codes are not subscription credentials.
 */
async function authorizeSubscriptionUpgrade(
  request: IncomingMessage,
  _socket: Duplex,
  requestedTeamId: string | undefined,
): Promise<WsAuthContext | { reject: { status: number; code: string; message: string } }> {
  if (!requestedTeamId) {
    return { reject: { status: 400, code: "BAD_REQUEST", message: "teamId query parameter is required" } };
  }

  const authorization = request.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return { reject: { status: 401, code: "UNAUTHENTICATED", message: "A human session Bearer token is required" } };
  }

  const db = await getDb();
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === "string") headers.set(key, value);
  }

  let subject;
  try {
    subject = await authenticateRequest(db, new Request("http://localhost/api/events/stream", { headers }));
    assertPasswordChangeAllowed(subject.user, "events-subscribe");
  } catch {
    return { reject: { status: 401, code: "UNAUTHENTICATED", message: "The session is not valid for subscriptions" } };
  }

  const context = await db.getTeamContext(subject.user.id, requestedTeamId);
  if (!context || !hasPermission(context.role, "team.resource.access")) {
    return { reject: { status: 403, code: "FORBIDDEN", message: "The session has no resource access in this Team" } };
  }

  return { userId: subject.user.id, sessionId: subject.session.id, teamId: requestedTeamId };
}

async function main(): Promise<void> {
  const nextApp = next({ dev, hostname, port });
  const handleNext = nextApp.getRequestHandler();
  await nextApp.prepare();

  const db = await getDb();
  const registry = defaultIntegrationRegistry();
  const dedup = new EventDedupTable();
  const catalog = new EventCatalog(registry);
  const router = new EventRouter(registry, catalog);

  const transport = new EventWsTransport(db, catalog, router, authorizeSubscriptionUpgrade);

  const pipeline = new WebhookWorkerPipeline(db, registry, dedup, router);
  const runtime = new EventRuntime(
    async (item, signal) => {
      await pipeline.process(item, signal);
    },
    { currentSubscriptionGeneration: () => router.currentSubscriptionGeneration },
  );

  const ingress = new WebhookIngressHandler(db, registry, runtime);

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname === "/api/webhooks") {
      void ingress.handle(req, res);
      return;
    }
    void handleNext(req, res);
  });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    // Dev HMR keeps its own Next-owned upgrade path.
    if (dev && (url.pathname.startsWith("/_next/webpack-hmr") || url.pathname.startsWith("/_next/turbopack-hmr"))) {
      return;
    }

    if (url.pathname === "/api/events/stream") {
      const protocols = req.headers["sec-websocket-protocol"];
      const offered = typeof protocols === "string" ? protocols.split(",").map((value) => value.trim()) : [];
      if (!offered.includes(EVENT_SUBPROTOCOL)) {
        rejectUpgrade(socket, 400, "UNSUPPORTED_SUBPROTOCOL", `Subprotocol ${EVENT_SUBPROTOCOL} is required`);
        return;
      }
      void transport.handleUpgrade(req, socket, head);
      return;
    }

    socket.destroy();
  });

  server.listen(port, hostname, () => {
    console.log(`> Mystra control plane ready on http://${hostname}:${port}`);
  });

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("> Shutting down Mystra control plane...");
    runtime.stopAdmission();
    await transport.shutdown();
    await runtime.shutdown();
    dedup.close();
    server.close();
    await shutdownDb();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

main().catch((error) => {
  console.error("Failed to start the Mystra control plane:", error);
  process.exit(1);
});
