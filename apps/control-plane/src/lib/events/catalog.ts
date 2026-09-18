import type { IntegrationRegistry } from "@/lib/integrations/registry";
import {
  EVENT_PROTOCOL_VERSION,
  MAX_EVENT_TYPES_PER_CATALOG,
  MAX_FILTERS_PER_EVENT_TYPE,
  type EventCatalogItem,
  type EventCatalogResponse,
} from "@mystra/shared";

export class EventCatalog {
  private readonly items: EventCatalogItem[] = [];
  private readonly itemsByEventType = new Map<string, EventCatalogItem>();

  constructor(registry: IntegrationRegistry) {
    const seenEventTypes = new Set<string>();

    for (const descriptor of registry.list()) {
      const capability = registry.getEventCapability(descriptor.name);
      if (!capability) continue;

      for (const item of capability.descriptors) {
        if (!item.eventType.startsWith(`${item.integration}.`)) {
          throw new Error(
            `Event type "${item.eventType}" must start with integration prefix "${item.integration}."`,
          );
        }

        if (seenEventTypes.has(item.eventType)) {
          throw new Error(`Duplicate event type registered in catalog: ${item.eventType}`);
        }
        seenEventTypes.add(item.eventType);

        if (item.filters.length > MAX_FILTERS_PER_EVENT_TYPE) {
          throw new Error(
            `Event type "${item.eventType}" exceeds maximum filters (${MAX_FILTERS_PER_EVENT_TYPE})`,
          );
        }

        this.items.push(item);
        this.itemsByEventType.set(item.eventType, item);
      }
    }

    if (this.items.length > MAX_EVENT_TYPES_PER_CATALOG) {
      throw new Error(
        `Event catalog exceeds maximum event types limit (${MAX_EVENT_TYPES_PER_CATALOG})`,
      );
    }
  }

  getItem(eventType: string): EventCatalogItem | undefined {
    return this.itemsByEventType.get(eventType);
  }

  hasEventType(eventType: string): boolean {
    return this.itemsByEventType.has(eventType);
  }

  toResponse(): EventCatalogResponse {
    return {
      protocolVersion: EVENT_PROTOCOL_VERSION,
      delivery: "online-only",
      events: this.items,
    };
  }
}
