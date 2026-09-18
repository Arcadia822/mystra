import {
  EVENT_PROTOCOL_VERSION,
  EVENT_SUBPROTOCOL,
  eventCatalogResponseSchema,
  serverWsMessageSchema,
  type EventCatalogResponse,
  type NormalizedEvent,
  type ServerErrorMessage,
  type ServerHelloMessage,
} from "@mystra/shared";
import WebSocket from "ws";

export interface SubscriptionRequest {
  readonly subscriptionId: string;
  readonly projectId: string;
  readonly integration: string;
  readonly eventType: string;
  readonly filters?: Record<string, string>;
}

export type EventsClientDiagnostic =
  | { kind: "status"; message: string }
  | { kind: "retry"; message: string; delayMs: number }
  | { kind: "protocol-error"; error: ServerErrorMessage }
  | { kind: "connection-lost"; message: string }
  | { kind: "permanent"; message: string };

export interface EventsClientOptions {
  readonly origin: string;
  readonly sessionToken: string;
  readonly teamId: string;
  readonly fetchImpl?: typeof fetch;
  readonly createSocket?: (url: string, token: string) => WebSocket;
  readonly onDiagnostic?: (diagnostic: EventsClientDiagnostic) => void;
  readonly onFrame?: (frame: unknown) => void;
  readonly onEvent?: (subscriptionId: string, event: NormalizedEvent) => void;
  readonly onHello?: (hello: ServerHelloMessage) => void;
  readonly jitter?: () => number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
}

interface PendingControlRequest {
  readonly requestId: string;
  resolve(frame: unknown): void;
  reject(error: Error): void;
}

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30_000;
const STABLE_CONNECTION_RESET_MS = 60_000;
const HANDSHAKE_TIMEOUT_MS = 10_000;
const STDIN_LINE_MAX_BYTES = 16 * 1024;

export class EventsClient {
  readonly #options: EventsClientOptions;
  readonly #fetchImpl: typeof fetch;
  readonly #desired = new Map<string, SubscriptionRequest>();
  #socket: WebSocket | undefined;
  #pending: PendingControlRequest | undefined;
  #reconnectTimer: NodeJS.Timeout | undefined;
  #handshakeTimer: NodeJS.Timeout | undefined;
  #stableTimer: NodeJS.Timeout | undefined;
  #attempt = 0;
  #stopping = false;
  #requestCounter = 0;
  #stdinBuffer = "";
  #stdinListener: ((chunk: Buffer) => void) | undefined;
  #stdinEndListener: (() => void) | undefined;

  constructor(options: EventsClientOptions) {
    this.#options = options;
    this.#fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  get teamId(): string {
    return this.#options.teamId;
  }

  get hello(): ServerHelloMessage | undefined {
    return this.#hello;
  }

  #hello: ServerHelloMessage | undefined;

  async fetchCatalog(): Promise<EventCatalogResponse> {
    const response = await this.#fetchImpl(
      `${this.#options.origin}/api/events/catalog?teamId=${encodeURIComponent(this.#options.teamId)}`,
      { headers: { authorization: `Bearer ${this.#options.sessionToken}` }, cache: "no-store" },
    );
    const payload = await response.json();
    if (!response.ok) {
      const code = payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: { code?: unknown } }).error.code)
        : "catalog_failed";
      throw new EventsClientFailure(code, response.status, "Event catalog request failed");
    }
    return eventCatalogResponseSchema.parse(payload);
  }

  subscribeAll(requests: readonly SubscriptionRequest[]): void {
    for (const request of requests) this.#desired.set(request.subscriptionId, request);
  }

  forgetSubscription(subscriptionId: string): void {
    this.#desired.delete(subscriptionId);
  }

  /** Opens the subscription socket and keeps it alive until `stop()`. */
  async connect(): Promise<void> {
    await this.#openSocket();
  }

  /** Sends one client control frame (subscribe/unsubscribe) on the live socket. */
  async sendControl(frame: Record<string, unknown>): Promise<unknown> {
    const socket = this.#socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new EventsClientFailure("not_connected", 0, "The subscription socket is not connected");
    }
    return await new Promise<unknown>((resolve, reject) => {
      const requestId = typeof frame.requestId === "string" ? frame.requestId : `cli-${++this.#requestCounter}`;
      this.#pending = { requestId, resolve, reject };
      socket.send(JSON.stringify({ ...frame, requestId }));
    });
  }

  /** Pipes NDJSON control frames from stdin. EOF stops the client normally. */
  attachStdin(stream: NodeJS.ReadableStream, onEnd: () => void): void {
    this.#stdinListener = (chunk: Buffer) => {
      this.#stdinBuffer += chunk.toString("utf8");
      let newlineIndex = this.#stdinBuffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = this.#stdinBuffer.slice(0, newlineIndex).trim();
        this.#stdinBuffer = this.#stdinBuffer.slice(newlineIndex + 1);
        if (line) void this.#handleControlLine(line);
        newlineIndex = this.#stdinBuffer.indexOf("\n");
      }
      if (Buffer.byteLength(this.#stdinBuffer, "utf8") > STDIN_LINE_MAX_BYTES) {
        this.#options.onDiagnostic?.({ kind: "permanent", message: "Control line exceeded 16 KiB" });
        this.#stdinBuffer = "";
      }
    };
    this.#stdinEndListener = onEnd;
    stream.on("data", this.#stdinListener);
    stream.on("end", () => {
      this.#stdinEndListener?.();
    });
  }

  async #handleControlLine(line: string): Promise<void> {
    if (Buffer.byteLength(line, "utf8") > STDIN_LINE_MAX_BYTES) {
      this.#options.onDiagnostic?.({ kind: "permanent", message: "Control line exceeded 16 KiB" });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      this.#options.onDiagnostic?.({ kind: "permanent", message: "Control line is not valid JSON" });
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      this.#options.onDiagnostic?.({ kind: "permanent", message: "Control line must be a JSON object" });
      return;
    }
    const message = parsed as { type?: string; subscriptionId?: string };
    if (message.type === "unsubscribe" && typeof message.subscriptionId === "string") {
      this.forgetSubscription(message.subscriptionId);
    }
    try {
      const frame = await this.sendControl(message as Record<string, unknown>);
      this.#options.onFrame?.(frame);
    } catch (error) {
      this.#options.onDiagnostic?.({
        kind: "permanent",
        message: error instanceof Error ? error.message : "Control frame failed",
      });
    }
  }

  async #openSocket(): Promise<void> {
    if (this.#stopping) return;
    const url = `${this.#options.origin.replace(/^http/, "ws")}/api/events/stream?teamId=${encodeURIComponent(this.#options.teamId)}`;
    const socket = this.#options.createSocket
      ? this.#options.createSocket(url, this.#options.sessionToken)
      : new WebSocket(url, EVENT_SUBPROTOCOL, {
        headers: { authorization: `Bearer ${this.#options.sessionToken}` },
        perMessageDeflate: false,
      });
    this.#socket = socket;

    socket.on("unexpected-response", (_request, response) => {
      const status = response.statusCode ?? 0;
      if (status === 401 || status === 403) {
        this.#options.onDiagnostic?.({
          kind: "permanent",
          message: `Subscription authorization failed with HTTP ${status}`,
        });
        this.stop();
        return;
      }
      this.#scheduleReconnect(status === 429
        ? "WebSocket connection quota is exhausted; retrying"
        : `Upgrade rejected with HTTP ${status}; retrying`);
    });

    socket.on("message", (data) => this.#onFrame(data.toString()));

    socket.on("close", (code) => {
      this.#clearHandshakeTimer();
      if (this.#stopping) return;
      if (code === 4401 || code === 4403) {
        this.#options.onDiagnostic?.({ kind: "permanent", message: `Subscription closed with code ${code}` });
        this.stop();
        return;
      }
      this.#scheduleReconnect(`Subscription socket closed with code ${code}`);
    });

    socket.on("error", () => {
      // Classification is owned by the Upgrade response and close code, not this text.
    });

    this.#handshakeTimer = setTimeout(() => {
      socket.terminate();
      this.#scheduleReconnect("Handshake timed out before the protocol was confirmed");
    }, HANDSHAKE_TIMEOUT_MS);
  }

  #onFrame(text: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.#options.onDiagnostic?.({ kind: "permanent", message: "Server frame was not valid JSON" });
      return;
    }
    const result = serverWsMessageSchema.safeParse(parsed);
    if (!result.success) {
      this.#options.onDiagnostic?.({ kind: "permanent", message: "Server frame did not match the protocol" });
      return;
    }

    const frame = result.data;
    if (frame.type === "hello") {
      this.#clearHandshakeTimer();
      this.#hello = frame;
      this.#attempt = 0;
      this.#stableTimer = setTimeout(() => {
        this.#attempt = 0;
      }, STABLE_CONNECTION_RESET_MS);
      this.#stableTimer.unref?.();
      this.#options.onHello?.(frame);
      this.#options.onFrame?.(frame);
      void this.#resendDesired();
      return;
    }

    if (frame.type === "event") {
      this.#options.onFrame?.(frame);
      this.#options.onEvent?.(frame.subscriptionId, frame.event);
      return;
    }

    if (frame.type === "error") {
      this.#options.onFrame?.(frame);
      this.#options.onDiagnostic?.({ kind: "protocol-error", error: frame });
      const pending = this.#pending;
      if (pending && frame.requestId === pending.requestId) {
        this.#pending = undefined;
        pending.reject(new EventsClientFailure(frame.code, 0, frame.message));
      }
      return;
    }

    this.#options.onFrame?.(frame);
    const pending = this.#pending;
    if (pending && "requestId" in frame && frame.requestId === pending.requestId) {
      this.#pending = undefined;
      pending.resolve(frame);
    }
  }

  async #resendDesired(): Promise<void> {
    for (const request of this.#desired.values()) {
      try {
        await this.sendControl({
          protocolVersion: EVENT_PROTOCOL_VERSION,
          type: "subscribe",
          subscriptionId: request.subscriptionId,
          projectId: request.projectId,
          integration: request.integration,
          eventType: request.eventType,
          ...(request.filters ? { filters: request.filters } : {}),
        });
      } catch (error) {
        if (error instanceof EventsClientFailure && (error.code === "FORBIDDEN" || error.code === "UNAUTHENTICATED")) {
          this.#options.onDiagnostic?.({ kind: "permanent", message: "Subscription is no longer authorized" });
          this.stop();
          return;
        }
        this.#options.onDiagnostic?.({
          kind: "status",
          message: error instanceof Error ? error.message : "Subscription was not confirmed",
        });
      }
    }
  }

  #scheduleReconnect(message: string): void {
    if (this.#stopping || this.#reconnectTimer) return;
    this.#clearHandshakeTimer();
    this.#socket?.terminate();
    this.#socket = undefined;
    this.#hello = undefined;
    const jitter = this.#options.jitter ?? Math.random;
    const base = this.#options.baseDelayMs ?? RECONNECT_BASE_DELAY_MS;
    const cap = this.#options.maxDelayMs ?? RECONNECT_MAX_DELAY_MS;
    const window = Math.min(cap, base * 2 ** this.#attempt);
    this.#attempt += 1;
    const delayMs = Math.max(base, Math.round(window * jitter()));
    this.#options.onDiagnostic?.({ kind: "connection-lost", message });
    this.#options.onDiagnostic?.({ kind: "retry", message: "Reconnecting", delayMs });
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = undefined;
      void this.#openSocket();
    }, delayMs);
  }

  #clearHandshakeTimer(): void {
    clearTimeout(this.#handshakeTimer as NodeJS.Timeout);
    this.#handshakeTimer = undefined;
  }

  stop(): void {
    if (this.#stopping) return;
    this.#stopping = true;
    clearTimeout(this.#reconnectTimer as NodeJS.Timeout);
    clearTimeout(this.#stableTimer as NodeJS.Timeout);
    this.#clearHandshakeTimer();
    if (this.#stdinListener) {
      (this.#stdinListener as unknown as { stream?: NodeJS.ReadableStream }).stream?.off?.("data", this.#stdinListener);
    }
    const socket = this.#socket;
    this.#socket = undefined;
    if (!socket) return;
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close(1000, "client stopping");
      const timer = setTimeout(() => socket.terminate(), 2000);
      timer.unref?.();
    } else {
      socket.terminate();
    }
  }

  get isStopped(): boolean {
    return this.#stopping;
  }
}

export class EventsClientFailure extends Error {
  constructor(readonly code: string, readonly status: number, message: string) {
    super(message);
    this.name = "EventsClientFailure";
  }
}
