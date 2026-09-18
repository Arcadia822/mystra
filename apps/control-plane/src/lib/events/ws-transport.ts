import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import {
  EVENT_PROTOCOL_VERSION,
  EVENT_SUBPROTOCOL,
  MAX_SUBSCRIPTIONS_PER_CONNECTION,
  clientWsMessageSchema,
  serverEventMessageSchema,
  serverHelloMessageSchema,
  serverSubscribedMessageSchema,
  serverUnsubscribedMessageSchema,
  serverErrorMessageSchema,
  type EventErrorCode,
  type NormalizedEvent,
} from "@mystra/shared";

import type { RdbProvider } from "@/lib/db";
import type { EventCatalog } from "./catalog";
import type { EventRouter } from "./router";

export const WS_MAX_CONNECTIONS_PER_PROCESS = 100;
export const WS_MAX_CONNECTIONS_PER_SESSION = 4;
export const WS_MAX_SUBSCRIPTIONS_PER_CONNECTION = MAX_SUBSCRIPTIONS_PER_CONNECTION;
export const WS_MAX_SEND_QUEUE_FRAMES = 256;
export const WS_MAX_SEND_QUEUE_BYTES = 1024 * 1024;
export const WS_HEARTBEAT_INTERVAL_MS = 30_000;
export const WS_PONG_TIMEOUT_MS = 10_000;
export const WS_CONTROL_FRAME_MAX_BYTES = 16 * 1024;
export const WS_EVENT_FRAME_MAX_BYTES = 64 * 1024;
export const WS_CONTROL_RATE_PER_SECOND = 20;
export const WS_CONTROL_RATE_BURST = 40;

export const WS_CLOSE_AUTH_EXPIRED = 4401;
export const WS_CLOSE_FORBIDDEN = 4403;
export const WS_CLOSE_UNSUPPORTED_PROTOCOL = 4406;
export const WS_CLOSE_RATE_LIMIT = 1008;
export const WS_CLOSE_TOO_LARGE = 1009;
export const WS_CLOSE_SLOW_CONSUMER = 4410;
export const WS_CLOSE_SHUTDOWN = 1001;

export interface WsAuthContext {
  readonly userId: string;
  readonly sessionId: string;
  readonly teamId: string;
}

/**
 * Authenticates and authorizes a subscription Upgrade before the socket is
 * accepted. Returns `undefined` after writing a rejection response.
 */
export type WsUpgradeAuthorizer = (
  request: IncomingMessage,
  response: Duplex,
  requestedTeamId: string | undefined,
) => Promise<WsAuthContext | { reject: { status: number; code: string; message: string } }>;

interface ConnectionState {
  readonly connectionId: string;
  readonly auth: WsAuthContext;
  readonly socket: WebSocket;
  readonly subscriptions: Map<string, string>;
  sendQueueFrames: number;
  sendQueueBytes: number;
  controlTokens: number;
  lastControlRefill: number;
  awaitingPong: boolean;
  closed: boolean;
}

export class EventWsTransport {
  private readonly server = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    maxPayload: WS_EVENT_FRAME_MAX_BYTES,
    handleProtocols: (protocols) => (protocols.has(EVENT_SUBPROTOCOL) ? EVENT_SUBPROTOCOL : false),
  });
  private readonly connections = new Map<string, ConnectionState>();
  private readonly connectionsBySession = new Map<string, Set<string>>();
  private admissionOpen = true;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: RdbProvider,
    private readonly catalog: EventCatalog,
    private readonly router: EventRouter,
    private readonly authorize: WsUpgradeAuthorizer,
  ) {
    this.heartbeatTimer = setInterval(() => this.runHeartbeat(), WS_HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref?.();
  }

  get activeConnectionCount(): number {
    return this.connections.size;
  }

  async handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const url = new URL(request.url ?? "/", "http://localhost");
    const requestedTeamId = url.searchParams.get("teamId") ?? undefined;

    if (!this.admissionOpen) {
      this.reject(socket, 503, "INTERNAL_ERROR", "Server is shutting down");
      return;
    }

    if (this.connections.size >= WS_MAX_CONNECTIONS_PER_PROCESS) {
      this.reject(socket, 429, "TOO_MANY_CONNECTIONS", "WebSocket connection quota is exhausted");
      return;
    }

    const protocols = request.headers["sec-websocket-protocol"];
    const offered = typeof protocols === "string" ? protocols.split(",").map((p) => p.trim()) : [];
    if (!offered.includes(EVENT_SUBPROTOCOL)) {
      this.reject(socket, 400, "UNSUPPORTED_SUBPROTOCOL", `Subprotocol ${EVENT_SUBPROTOCOL} is required`);
      return;
    }

    const result = await this.authorize(request, socket, requestedTeamId);
    if (!result) {
      this.reject(socket, 401, "UNAUTHENTICATED", "The session is not valid for subscriptions");
      return;
    }
    if ("reject" in result) {
      this.reject(socket, result.reject.status, result.reject.code, result.reject.message);
      return;
    }
    const auth = result;

    const sessionConnections = this.connectionsBySession.get(auth.sessionId) ?? new Set<string>();
    if (sessionConnections.size >= WS_MAX_CONNECTIONS_PER_SESSION) {
      this.reject(socket, 429, "TOO_MANY_CONNECTIONS", "Session WebSocket connection quota is exhausted");
      return;
    }

    await new Promise<void>((resolve) => {
      this.server.handleUpgrade(request, socket, head, (websocket) => {
        this.registerSocket(websocket, auth);
        resolve();
      });
    });
  }

  /** Registers protocol handlers for a freshly upgraded socket. */
  registerSocket(socket: WebSocket, auth: WsAuthContext): void {
    const connectionId = `connection-${this.connections.size + 1}-${Math.random().toString(36).slice(2, 8)}`;
    const state: ConnectionState = {
      connectionId,
      auth,
      socket,
      subscriptions: new Map(),
      sendQueueFrames: 0,
      sendQueueBytes: 0,
      controlTokens: WS_CONTROL_RATE_BURST,
      lastControlRefill: Date.now(),
      awaitingPong: false,
      closed: false,
    };
    this.connections.set(connectionId, state);
    const sessionConnections = this.connectionsBySession.get(auth.sessionId) ?? new Set<string>();
    sessionConnections.add(connectionId);
    this.connectionsBySession.set(auth.sessionId, sessionConnections);

    socket.on("pong", () => {
      state.awaitingPong = false;
    });

    socket.on("message", (data, isBinary) => {
      void this.onMessage(state, data, isBinary).catch(() => {
        this.sendError(state, undefined, "INTERNAL_ERROR", "The control frame could not be processed");
      });
    });

    socket.on("close", () => {
      this.removeConnection(state);
    });

    socket.on("error", () => {
      this.removeConnection(state);
    });

    this.send(state, serverHelloMessageSchema.parse({
      protocolVersion: EVENT_PROTOCOL_VERSION,
      type: "hello",
      connectionId,
      delivery: "online-only",
      heartbeatIntervalMs: WS_HEARTBEAT_INTERVAL_MS,
      pongTimeoutMs: WS_PONG_TIMEOUT_MS,
      maxSubscriptions: WS_MAX_SUBSCRIPTIONS_PER_CONNECTION,
    }));
  }

  private async onMessage(state: ConnectionState, data: unknown, isBinary: boolean): Promise<void> {
    if (state.closed) return;
    if (isBinary) {
      this.sendError(state, undefined, "INVALID_MESSAGE", "Binary frames are not supported");
      return;
    }

    const text = typeof data === "string" ? data : Buffer.from(data as ArrayBuffer).toString("utf8");
    if (Buffer.byteLength(text, "utf8") > WS_CONTROL_FRAME_MAX_BYTES) {
      this.sendError(state, undefined, "INVALID_MESSAGE", "Control frame exceeds 16 KiB");
      state.socket.close(WS_CLOSE_TOO_LARGE, "control frame too large");
      return;
    }

    if (!this.consumeControlToken(state)) {
      state.socket.close(WS_CLOSE_RATE_LIMIT, "control rate exceeded");
      return;
    }

    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(text);
    } catch {
      this.sendError(state, undefined, "INVALID_MESSAGE", "Control frame is not valid JSON");
      return;
    }

    if (
      parsedRaw
      && typeof parsedRaw === "object"
      && "protocolVersion" in parsedRaw
      && (parsedRaw as { protocolVersion?: unknown }).protocolVersion !== EVENT_PROTOCOL_VERSION
    ) {
      this.sendError(state, undefined, "UNSUPPORTED_VERSION", "Unsupported protocol version");
      state.socket.close(WS_CLOSE_UNSUPPORTED_PROTOCOL, "unsupported protocol version");
      return;
    }

    const parsed = clientWsMessageSchema.safeParse(parsedRaw);
    if (!parsed.success) {
      this.sendError(state, undefined, "INVALID_MESSAGE", "Control frame does not match the protocol");
      return;
    }

    if (parsed.data.type === "subscribe") {
      await this.onSubscribe(state, parsed.data);
      return;
    }
    this.onUnsubscribe(state, parsed.data.requestId, parsed.data.subscriptionId);
  }

  private async onSubscribe(
    state: ConnectionState,
    message: {
      requestId: string;
      subscriptionId: string;
      projectId: string;
      integration: string;
      eventType: string;
      filters?: Record<string, string> | undefined;
    },
  ): Promise<void> {
    if (!this.catalog.hasEventType(message.eventType)) {
      this.sendError(state, message.requestId, "UNKNOWN_EVENT_TYPE", "Unknown event type");
      return;
    }

    const existing = state.subscriptions.get(message.subscriptionId);
    if (existing === undefined && state.subscriptions.size >= WS_MAX_SUBSCRIPTIONS_PER_CONNECTION) {
      this.sendError(state, message.requestId, "SUBSCRIPTION_LIMIT", "Subscription limit reached");
      return;
    }

    // Re-validate target authorization at subscribe time.
    const context = await this.db.getTeamContext(state.auth.userId, state.auth.teamId);
    const project = await this.db.getProjectById(message.projectId, { teamId: state.auth.teamId });
    if (!context || !project || project.archivedAt) {
      this.sendError(state, message.requestId, "FORBIDDEN", "Project is not available in this Team");
      return;
    }

    let result;
    try {
      result = this.router.subscribe({
        connectionId: state.connectionId,
        subscriptionId: message.subscriptionId,
        projectId: message.projectId,
        integration: message.integration,
        eventType: message.eventType,
        ...(message.filters ? { filters: message.filters } : {}),
        send: (event) => this.deliver(state, message.subscriptionId, event),
      });
    } catch (error) {
      const code: EventErrorCode = error instanceof Error && error.message.startsWith("UNSUPPORTED_FILTER")
        ? "UNSUPPORTED_FILTER"
        : error instanceof Error && error.message.startsWith("UNKNOWN_EVENT_TYPE")
          ? "UNKNOWN_EVENT_TYPE"
          : "INTERNAL_ERROR";
      this.sendError(state, message.requestId, code, "Subscription could not be created");
      return;
    }

    if (result.status === "conflict") {
      this.sendError(state, message.requestId, "SUBSCRIPTION_CONFLICT", "Subscription id already exists with different content");
      return;
    }

    state.subscriptions.set(message.subscriptionId, message.eventType);
    this.send(state, serverSubscribedMessageSchema.parse({
      protocolVersion: EVENT_PROTOCOL_VERSION,
      type: "subscribed",
      requestId: message.requestId,
      subscriptionId: message.subscriptionId,
    }));
  }

  private onUnsubscribe(state: ConnectionState, requestId: string, subscriptionId: string): void {
    this.router.unsubscribe(state.connectionId, subscriptionId);
    state.subscriptions.delete(subscriptionId);
    this.send(state, serverUnsubscribedMessageSchema.parse({
      protocolVersion: EVENT_PROTOCOL_VERSION,
      type: "unsubscribed",
      requestId,
      subscriptionId,
    }));
  }

  private deliver(state: ConnectionState, subscriptionId: string, event: NormalizedEvent): void {
    this.send(state, serverEventMessageSchema.parse({
      protocolVersion: EVENT_PROTOCOL_VERSION,
      type: "event",
      subscriptionId,
      event,
    }));
  }

  private send(state: ConnectionState, message: object): void {
    if (state.closed) return;
    const payload = JSON.stringify(message);
    const bytes = Buffer.byteLength(payload, "utf8");

    if (
      state.sendQueueFrames + 1 > WS_MAX_SEND_QUEUE_FRAMES
      || state.sendQueueBytes + bytes > WS_MAX_SEND_QUEUE_BYTES
    ) {
      state.socket.close(WS_CLOSE_SLOW_CONSUMER, "slow consumer");
      this.removeConnection(state);
      return;
    }

    state.sendQueueFrames += 1;
    state.sendQueueBytes += bytes;
    state.socket.send(payload, () => {
      state.sendQueueFrames -= 1;
      state.sendQueueBytes -= bytes;
    });
  }

  private sendError(
    state: ConnectionState,
    requestId: string | undefined,
    code: EventErrorCode,
    message: string,
  ): void {
    this.send(state, serverErrorMessageSchema.parse({
      protocolVersion: EVENT_PROTOCOL_VERSION,
      type: "error",
      ...(requestId ? { requestId } : {}),
      code,
      message,
      retryable: false,
    }));
  }

  private consumeControlToken(state: ConnectionState): boolean {
    const now = Date.now();
    const elapsedSeconds = (now - state.lastControlRefill) / 1000;
    if (elapsedSeconds > 0) {
      state.controlTokens = Math.min(
        WS_CONTROL_RATE_BURST,
        state.controlTokens + elapsedSeconds * WS_CONTROL_RATE_PER_SECOND,
      );
      state.lastControlRefill = now;
    }
    if (state.controlTokens < 1) return false;
    state.controlTokens -= 1;
    return true;
  }

  private runHeartbeat(): void {
    for (const state of this.connections.values()) {
      if (state.awaitingPong) {
        state.socket.terminate();
        this.removeConnection(state);
        continue;
      }
      state.awaitingPong = true;
      try {
        state.socket.ping();
      } catch {
        this.removeConnection(state);
      }
    }
  }

  removeConnection(state: ConnectionState): void {
    if (state.closed) return;
    state.closed = true;
    this.connections.delete(state.connectionId);
    const sessionConnections = this.connectionsBySession.get(state.auth.sessionId);
    if (sessionConnections) {
      sessionConnections.delete(state.connectionId);
      if (sessionConnections.size === 0) this.connectionsBySession.delete(state.auth.sessionId);
    }
    this.router.removeConnection(state.connectionId);
    state.subscriptions.clear();
  }

  /** Closes every connection for an AuthSession (revocation, expiry, logout). */
  closeSessionConnections(sessionId: string): void {
    const sessionConnections = this.connectionsBySession.get(sessionId);
    if (!sessionConnections) return;
    for (const connectionId of [...sessionConnections]) {
      const state = this.connections.get(connectionId);
      if (!state) continue;
      state.socket.close(WS_CLOSE_AUTH_EXPIRED, "authentication expired");
      this.removeConnection(state);
    }
  }

  getSubscriptionCount(): number {
    return this.router.getSubscriptionCount();
  }

  async shutdown(): Promise<void> {
    this.admissionOpen = false;
    clearInterval(this.heartbeatTimer as NodeJS.Timeout);
    for (const state of [...this.connections.values()]) {
      state.socket.close(WS_CLOSE_SHUTDOWN, "server shutting down");
      this.removeConnection(state);
    }
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private reject(socket: Duplex, status: number, code: string, message: string): void {
    const body = JSON.stringify({ error: { code, message } });
    socket.write(
      `HTTP/1.1 ${status} ${status === 429 ? "Too Many Requests" : status === 401 ? "Unauthorized" : "Bad Request"}\r\n`
      + "content-type: application/json\r\n"
      + `content-length: ${Buffer.byteLength(body)}\r\n`
      + "connection: close\r\n\r\n"
      + body,
    );
    socket.end();
  }
}
