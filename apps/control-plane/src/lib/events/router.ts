import type { IntegrationRegistry } from "@/lib/integrations/registry";
import type { EventCatalog } from "./catalog";
import type { NormalizedEvent } from "@mystra/shared";
import type { EventDispatcher } from "./pipeline";

export interface ActiveSubscription {
  readonly connectionId: string;
  readonly subscriptionId: string;
  readonly generation: number;
  readonly projectId: string;
  readonly integration: string;
  readonly eventType: string;
  readonly filters: Record<string, string>;
  send(event: NormalizedEvent): void;
}

export class EventRouter implements EventDispatcher {
  private nextGeneration = 1;
  // key: `${connectionId}:${subscriptionId}`
  private readonly subscriptionsByKey = new Map<string, ActiveSubscription>();
  // key: connectionId -> Set of `${connectionId}:${subscriptionId}`
  private readonly keysByConnection = new Map<string, Set<string>>();

  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly catalog: EventCatalog,
  ) {}

  subscribe(input: {
    connectionId: string;
    subscriptionId: string;
    projectId: string;
    integration: string;
    eventType: string;
    filters?: Record<string, string>;
    send: (event: NormalizedEvent) => void;
  }): { status: "subscribed"; subscription: ActiveSubscription } | { status: "conflict" } {
    const key = `${input.connectionId}:${input.subscriptionId}`;
    const catalogItem = this.catalog.getItem(input.eventType);
    if (!catalogItem) {
      throw new Error(`UNKNOWN_EVENT_TYPE: ${input.eventType}`);
    }

    if (catalogItem.integration !== input.integration) {
      throw new Error(`Integration mismatch: expected ${catalogItem.integration} for ${input.eventType}`);
    }

    const capability = this.registry.getEventCapability(input.integration);
    if (!capability) {
      throw new Error(`INTEGRATION_CAPABILITY_UNAVAILABLE: ${input.integration}`);
    }

    const canonicalFilters = capability.validateFilters(input.eventType, input.filters ?? {});

    const existing = this.subscriptionsByKey.get(key);
    if (existing) {
      const same =
        existing.projectId === input.projectId &&
        existing.integration === input.integration &&
        existing.eventType === input.eventType &&
        JSON.stringify(existing.filters) === JSON.stringify(canonicalFilters);
      if (same) {
        return { status: "subscribed", subscription: existing };
      }
      return { status: "conflict" };
    }

    const generation = this.nextGeneration++;
    const sub: ActiveSubscription = {
      connectionId: input.connectionId,
      subscriptionId: input.subscriptionId,
      generation,
      projectId: input.projectId,
      integration: input.integration,
      eventType: input.eventType,
      filters: canonicalFilters,
      send: input.send,
    };

    this.subscriptionsByKey.set(key, sub);
    let connKeys = this.keysByConnection.get(input.connectionId);
    if (!connKeys) {
      connKeys = new Set();
      this.keysByConnection.set(input.connectionId, connKeys);
    }
    connKeys.add(key);

    return { status: "subscribed", subscription: sub };
  }

  unsubscribe(connectionId: string, subscriptionId: string): boolean {
    const key = `${connectionId}:${subscriptionId}`;
    const deleted = this.subscriptionsByKey.delete(key);
    const connKeys = this.keysByConnection.get(connectionId);
    if (connKeys) {
      connKeys.delete(key);
      if (connKeys.size === 0) {
        this.keysByConnection.delete(connectionId);
      }
    }
    return deleted;
  }

  removeConnection(connectionId: string): void {
    const connKeys = this.keysByConnection.get(connectionId);
    if (!connKeys) return;
    for (const key of connKeys) {
      this.subscriptionsByKey.delete(key);
    }
    this.keysByConnection.delete(connectionId);
  }

  getSubscriptionCount(): number {
    return this.subscriptionsByKey.size;
  }

  /**
   * Highest generation already issued to any subscription. Ingress snapshots
   * this at admission so deliveries never reach subscriptions created later.
   */
  get currentSubscriptionGeneration(): number {
    return this.nextGeneration - 1;
  }

  dispatch(event: NormalizedEvent, subscriptionGenerationCap?: number): void {
    const capability = this.registry.getEventCapability(event.integration);
    if (!capability) return;

    for (const sub of this.subscriptionsByKey.values()) {
      // 1. Generation cap check: do not deliver to subscriptions created after webhook admission
      if (subscriptionGenerationCap !== undefined && sub.generation > subscriptionGenerationCap) {
        continue;
      }

      // 2. Exact match on projectId, integration, and eventType
      if (
        sub.projectId !== event.projectId ||
        sub.integration !== event.integration ||
        sub.eventType !== event.eventType
      ) {
        continue;
      }

      // 3. Filter match
      if (!capability.matches(sub.eventType, sub.filters, event)) {
        continue;
      }

      // Broadcast to subscriber
      try {
        sub.send(event);
      } catch {
        // Individual subscriber error doesn't abort dispatch to other subscribers
      }
    }
  }
}
