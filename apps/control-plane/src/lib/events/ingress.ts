import type { IncomingMessage, ServerResponse } from "node:http";
import type { RdbProvider } from "@/lib/db";
import type { IntegrationRegistry } from "@/lib/integrations/registry";
import { EventRuntime, EventRuntimeOverloadedError } from "./event-runtime";

export const INGRESS_MAX_BODY_BYTES = 1024 * 1024; // 1 MiB
export const INGRESS_MAX_CONCURRENT_RECEIVES = 32;
export const INGRESS_RECEIVE_TIMEOUT_MS = 4000; // 4 seconds

export class WebhookIngressHandler {
  private activeReceives = 0;

  constructor(
    private readonly db: RdbProvider,
    private readonly registry: IntegrationRegistry,
    private readonly runtime: EventRuntime,
  ) {}

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED", message: "Only POST is allowed" } }));
      return;
    }

    if (this.activeReceives >= INGRESS_MAX_CONCURRENT_RECEIVES) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { code: "WEBHOOK_OVERLOADED", message: "Too many concurrent requests" } }));
      return;
    }

    // Media type check
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      res.writeHead(415, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { code: "WEBHOOK_UNSUPPORTED_MEDIA_TYPE", message: "Only application/json is supported" } }));
      return;
    }

    // Reject compressed encoding per spec
    const contentEncoding = req.headers["content-encoding"];
    if (contentEncoding && contentEncoding !== "identity") {
      res.writeHead(415, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { code: "WEBHOOK_UNSUPPORTED_MEDIA_TYPE", message: "Compressed encoding is not supported" } }));
      return;
    }

    // Extract token query parameter
    const url = new URL(req.url ?? "/", "http://localhost");
    const token = url.searchParams.get("token");
    if (!token) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { code: "WEBHOOK_UNAUTHORIZED", message: "Missing webhook token" } }));
      return;
    }

    this.activeReceives++;

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (!res.headersSent) {
        res.writeHead(408, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { code: "REQUEST_TIMEOUT", message: "Request reception timed out" } }));
      }
      req.destroy();
    }, INGRESS_RECEIVE_TIMEOUT_MS);

    try {
      // Lookup endpoint by token
      const lookup = await this.db.getIntegrationWebhookEndpointById(token);
      if (!lookup) {
        if (!timedOut) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { code: "WEBHOOK_UNAUTHORIZED", message: "Invalid or inactive webhook token" } }));
        }
        return;
      }

      const { endpoint, connection } = lookup;
      if (connection.status !== "active" || connection.credentialState !== "ready") {
        if (!timedOut) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { code: "WEBHOOK_UNAUTHORIZED", message: "Connection is not active or ready" } }));
        }
        return;
      }

      const eventCapability = this.registry.getEventCapability(connection.integration);
      if (!eventCapability) {
        if (!timedOut) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { code: "WEBHOOK_INTEGRATION_UNAVAILABLE", message: `Integration ${connection.integration} does not support events` } }));
        }
        return;
      }

      // Check Content-Length if present
      const contentLengthHeader = req.headers["content-length"];
      if (contentLengthHeader) {
        const parsedLength = parseInt(contentLengthHeader, 10);
        if (parsedLength > INGRESS_MAX_BODY_BYTES) {
          if (!timedOut) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: { code: "PAYLOAD_TOO_LARGE", message: "Payload exceeds 1 MiB limit" } }));
          }
          return;
        }
      }

      // Read raw body with byte length tracking
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      for await (const chunk of req) {
        if (timedOut) return;
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buf.byteLength;
        if (totalBytes > INGRESS_MAX_BODY_BYTES) {
          if (!timedOut) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: { code: "PAYLOAD_TOO_LARGE", message: "Payload exceeds 1 MiB limit" } }));
          }
          return;
        }
        chunks.push(buf);
      }

      if (timedOut) return;

      const rawBody = Buffer.concat(chunks).toString("utf8");

      // Extract allowlisted headers
      const headers: Record<string, string> = {};
      for (const [key, val] of Object.entries(req.headers)) {
        if (typeof val === "string") {
          headers[key.toLowerCase()] = val;
        }
      }

      // Admit into EventRuntime
      try {
        this.runtime.admit({
          endpointId: endpoint.id,
          connectionId: connection.id,
          teamId: connection.teamId,
          integration: connection.integration,
          headers,
          rawBody,
        });
      } catch (admitError) {
        if (admitError instanceof EventRuntimeOverloadedError) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { code: "WEBHOOK_OVERLOADED", message: "Inbox overloaded" } }));
          return;
        }
        throw admitError;
      }

      // Immediately return HTTP 200 {"received":true}
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ received: true }));
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { code: "RDB_UNAVAILABLE", message: "Service unavailable" } }));
      }
    } finally {
      clearTimeout(timer);
      this.activeReceives--;
    }
  }
}
