export const EVENT_DEDUP_MAX_KEYS = 100_000;
export const EVENT_DEDUP_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
export const EVENT_DEDUP_SWEEPER_INTERVAL_MS = 60 * 1000; // 1 minute

export type DedupStatus = "pending" | "done";

export interface DedupEntry {
  readonly status: DedupStatus;
  readonly expiresAt: number;
}

export type DedupReserveResult =
  | { status: "reserved" }
  | { status: "duplicate"; entry: DedupEntry }
  | { status: "capacity_exceeded" };

export class EventDedupTable {
  private readonly entries = new Map<string, DedupEntry>();
  private readonly sweeperTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly options: {
      maxKeys?: number;
      ttlMs?: number;
      sweeperIntervalMs?: number;
    } = {},
  ) {
    const sweeperInterval = options.sweeperIntervalMs ?? EVENT_DEDUP_SWEEPER_INTERVAL_MS;
    if (sweeperInterval > 0) {
      this.sweeperTimer = setInterval(() => this.sweepExpired(), sweeperInterval);
      if (this.sweeperTimer.unref) {
        this.sweeperTimer.unref();
      }
    }
  }

  get maxKeys(): number {
    return this.options.maxKeys ?? EVENT_DEDUP_MAX_KEYS;
  }

  get ttlMs(): number {
    return this.options.ttlMs ?? EVENT_DEDUP_TTL_MS;
  }

  get size(): number {
    return this.entries.size;
  }

  static buildKey(input: {
    teamId: string;
    integration: string;
    providerEventId: string;
    eventType: string;
  }): string {
    return `${input.teamId}:${input.integration}:${input.providerEventId}:${input.eventType}`;
  }

  reserve(input: {
    teamId: string;
    integration: string;
    providerEventId: string;
    eventType: string;
  }): DedupReserveResult {
    const key = EventDedupTable.buildKey(input);
    const now = Date.now();
    const existing = this.entries.get(key);

    if (existing) {
      if (existing.expiresAt > now) {
        return { status: "duplicate", entry: existing };
      }
      // Expired key can be replaced
      this.entries.delete(key);
    }

    if (this.entries.size >= this.maxKeys) {
      return { status: "capacity_exceeded" };
    }

    const newEntry: DedupEntry = {
      status: "pending",
      expiresAt: now + this.ttlMs,
    };
    this.entries.set(key, newEntry);
    return { status: "reserved" };
  }

  markDone(input: {
    teamId: string;
    integration: string;
    providerEventId: string;
    eventType: string;
  }): boolean {
    const key = EventDedupTable.buildKey(input);
    const existing = this.entries.get(key);
    if (!existing) {
      return false;
    }
    this.entries.set(key, {
      ...existing,
      status: "done",
    });
    return true;
  }

  sweepExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  clear(): void {
    this.entries.clear();
  }

  close(): void {
    clearInterval(this.sweeperTimer as NodeJS.Timeout);
    this.clear();
  }
}
