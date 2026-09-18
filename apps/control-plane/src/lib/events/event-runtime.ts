export const EVENT_RUNTIME_MAX_INBOX_ITEMS = 256;
export const EVENT_RUNTIME_MAX_INBOX_BYTES = 16 * 1024 * 1024; // 16 MiB
export const EVENT_RUNTIME_MAX_WORKERS = 4;
export const EVENT_RUNTIME_ITEM_TTL_MS = 10_000; // 10s
export const EVENT_RUNTIME_SWEEPER_INTERVAL_MS = 1_000; // 1s

export interface ReceivedWebhookItem {
  readonly id: string;
  readonly endpointId: string;
  readonly connectionId: string;
  readonly teamId: string;
  readonly integration: string;
  readonly headers: Record<string, string>;
  readonly rawBody: string;
  readonly byteLength: number;
  readonly receivedAt: number; // timestamp in ms
  readonly subscriptionGenerationCap?: number;
}

export type WebhookProcessor = (
  item: ReceivedWebhookItem,
  signal: AbortSignal,
) => Promise<void>;

export class EventRuntimeOverloadedError extends Error {
  constructor(message = "Event runtime inbox overloaded") {
    super(message);
    this.name = "EventRuntimeOverloadedError";
  }
}

export class EventRuntimeStoppedError extends Error {
  constructor(message = "Event runtime is stopped") {
    super(message);
    this.name = "EventRuntimeStoppedError";
  }
}

interface InternalItem {
  readonly item: ReceivedWebhookItem;
  readonly abortController: AbortController;
  isProcessing: boolean;
  isCancelled: boolean;
}

export class EventRuntime {
  private readonly queue: InternalItem[] = [];
  private readonly inFlight = new Set<InternalItem>();
  private totalQueuedAndInFlightBytes = 0;
  private isAdmitting = true;
  private isRunning = true;
  private readonly sweeperTimer: NodeJS.Timeout | null = null;
  private activeWorkers = 0;

  constructor(
    private readonly processor?: WebhookProcessor,
    private readonly options: {
      maxItems?: number;
      maxBytes?: number;
      maxWorkers?: number;
      ttlMs?: number;
      sweeperIntervalMs?: number;
      /**
       * Highest subscription generation that exists at admission time. The
       * runtime snapshots it into every admitted item so a subscription created
       * after admission can never receive an earlier backlog. Without a
       * provider the cap is unbounded (no barrier).
       */
      currentSubscriptionGeneration?: () => number;
    } = {},
  ) {
    const sweeperInterval = options.sweeperIntervalMs ?? EVENT_RUNTIME_SWEEPER_INTERVAL_MS;
    if (sweeperInterval > 0) {
      this.sweeperTimer = setInterval(() => this.sweepExpired(), sweeperInterval);
      if (this.sweeperTimer.unref) {
        this.sweeperTimer.unref();
      }
    }
  }

  get maxItems(): number {
    return this.options.maxItems ?? EVENT_RUNTIME_MAX_INBOX_ITEMS;
  }

  get maxBytes(): number {
    return this.options.maxBytes ?? EVENT_RUNTIME_MAX_INBOX_BYTES;
  }

  get maxWorkers(): number {
    return this.options.maxWorkers ?? EVENT_RUNTIME_MAX_WORKERS;
  }

  get ttlMs(): number {
    return this.options.ttlMs ?? EVENT_RUNTIME_ITEM_TTL_MS;
  }

  get stats(): {
    queuedCount: number;
    inFlightCount: number;
    totalBytes: number;
    isAdmitting: boolean;
  } {
    return {
      queuedCount: this.queue.length,
      inFlightCount: this.inFlight.size,
      totalBytes: this.totalQueuedAndInFlightBytes,
      isAdmitting: this.isAdmitting,
    };
  }

  admit(input: Omit<ReceivedWebhookItem, "id" | "receivedAt" | "byteLength" | "subscriptionGenerationCap"> & {
    id?: string;
    receivedAt?: number;
    subscriptionGenerationCap?: number;
  }): ReceivedWebhookItem {
    if (!this.isAdmitting || !this.isRunning) {
      throw new EventRuntimeStoppedError();
    }

    const rawBody = input.rawBody;
    const byteLength = Buffer.byteLength(rawBody, "utf8");

    const currentTotalItems = this.queue.length + this.inFlight.size;
    if (currentTotalItems + 1 > this.maxItems) {
      throw new EventRuntimeOverloadedError("Max inbox items exceeded");
    }

    if (this.totalQueuedAndInFlightBytes + byteLength > this.maxBytes) {
      throw new EventRuntimeOverloadedError("Max inbox bytes exceeded");
    }

    const item: ReceivedWebhookItem = {
      ...input,
      id: input.id ?? crypto.randomUUID(),
      byteLength,
      receivedAt: input.receivedAt ?? Date.now(),
      subscriptionGenerationCap: input.subscriptionGenerationCap
        ?? this.options.currentSubscriptionGeneration?.()
        ?? Number.MAX_SAFE_INTEGER,
    };

    const internal: InternalItem = {
      item,
      abortController: new AbortController(),
      isProcessing: false,
      isCancelled: false,
    };

    this.queue.push(internal);
    this.totalQueuedAndInFlightBytes += byteLength;

    // Schedule worker progression asynchronously on next tick
    queueMicrotask(() => this.drain());

    return item;
  }

  private drain(): void {
    if (!this.isRunning) return;

    while (this.activeWorkers < this.maxWorkers && this.queue.length > 0) {
      const internal = this.queue.shift();
      if (!internal) break;

      // Check deadline before starting
      if (Date.now() - internal.item.receivedAt > this.ttlMs || internal.isCancelled) {
        this.totalQueuedAndInFlightBytes -= internal.item.byteLength;
        internal.abortController.abort();
        continue;
      }

      this.inFlight.add(internal);
      internal.isProcessing = true;
      this.activeWorkers++;

      void this.runWorker(internal);
    }
  }

  private async runWorker(internal: InternalItem): Promise<void> {
    try {
      if (this.processor && !internal.isCancelled) {
        await this.processor(internal.item, internal.abortController.signal);
      }
    } catch (err) {
      // Background worker errors are logged/dropped per spec without throwing to caller
    } finally {
      this.inFlight.delete(internal);
      this.totalQueuedAndInFlightBytes -= internal.item.byteLength;
      this.activeWorkers--;
      this.drain();
    }
  }

  sweepExpired(): void {
    const now = Date.now();

    // 1. Remove expired items from queue
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const internal = this.queue[i];
      if (internal && now - internal.item.receivedAt > this.ttlMs) {
        this.queue.splice(i, 1);
        this.totalQueuedAndInFlightBytes -= internal.item.byteLength;
        internal.abortController.abort();
      }
    }

    // 2. Abort expired in-flight workers
    for (const internal of this.inFlight) {
      if (now - internal.item.receivedAt > this.ttlMs && !internal.isCancelled) {
        internal.isCancelled = true;
        internal.abortController.abort();
      }
    }
  }

  stopAdmission(): void {
    this.isAdmitting = false;
  }

  async shutdown(): Promise<void> {
    this.isAdmitting = false;
    this.isRunning = false;

    clearInterval(this.sweeperTimer as NodeJS.Timeout);

    // Drain and abort queue
    while (this.queue.length > 0) {
      const internal = this.queue.pop()!;
      this.totalQueuedAndInFlightBytes -= internal.item.byteLength;
      internal.abortController.abort();
    }

    // Abort all in-flight workers
    for (const internal of this.inFlight) {
      internal.isCancelled = true;
      internal.abortController.abort();
    }
  }
}
