import type { RdbProvider } from "@/lib/db";
import type { IntegrationRegistry } from "@/lib/integrations/registry";
import type { NormalizedEvent } from "@mystra/shared";
import type { EventDedupTable } from "./dedup";
import type { ReceivedWebhookItem } from "./event-runtime";

export interface EventDispatcher {
  dispatch(event: NormalizedEvent, subscriptionGenerationCap?: number): void;
}

export class WebhookWorkerPipeline {
  constructor(
    private readonly db: RdbProvider,
    private readonly registry: IntegrationRegistry,
    private readonly dedup: EventDedupTable,
    private readonly dispatcher?: EventDispatcher,
  ) {}

  async process(item: ReceivedWebhookItem, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return;

    // 1. Re-check endpoint and connection validity
    const lookup = await this.db.getIntegrationWebhookEndpointById(item.endpointId);
    if (!lookup) return; // endpoint_unavailable
    const { connection } = lookup;
    if (
      connection.id !== item.connectionId ||
      connection.teamId !== item.teamId ||
      connection.status !== "active" ||
      connection.credentialState !== "ready"
    ) {
      return; // scope_mismatch or connection unavailable
    }

    // 2. Integration capability parse
    const eventCapability = this.registry.getEventCapability(item.integration);
    if (!eventCapability) return;

    let parseResult;
    try {
      parseResult = await eventCapability.parseWebhook({
        rawBody: item.rawBody,
        headers: item.headers,
        connectionConfig: connection.connectionConfig,
      });
    } catch {
      return; // invalid_payload
    }

    if (signal.aborted) return;
    if (parseResult.kind === "ignored") return;

    const candidates = parseResult.events.slice(0, 16);

    for (const candidate of candidates) {
      if (signal.aborted) return;

      // 3. Organization check
      if (
        candidate.organizationId &&
        connection.connectionConfig.workspaceId &&
        candidate.organizationId !== connection.connectionConfig.workspaceId
      ) {
        continue;
      }

      // 4. Resolve project issue source scope
      const resolved = await this.db.resolveProjectIssueSourceScope({
        teamId: item.teamId,
        integration: item.integration,
        scopeType: candidate.scope.scopeType,
        scopeExternalId: candidate.scope.scopeExternalId,
      });

      if (!resolved) continue; // ignored / scope_mismatch

      const { project, connection: sourceConnection } = resolved;
      if (project.archivedAt) continue;
      if (
        sourceConnection.status !== "active" ||
        sourceConnection.credentialState !== "ready"
      ) {
        continue;
      }

      // 5. Dedup reservation
      const reserveResult = this.dedup.reserve({
        teamId: item.teamId,
        integration: item.integration,
        providerEventId: candidate.providerEventId,
        eventType: candidate.eventType,
      });

      if (reserveResult.status !== "reserved") {
        continue; // duplicate or capacity_exceeded
      }

      // 6. Build normalized event
      const normalizedEvent: NormalizedEvent = {
        id: `${item.integration}:${candidate.providerEventId}:${candidate.eventType}`,
        integration: item.integration,
        eventType: candidate.eventType,
        projectId: project.id,
        subject: candidate.subject,
        occurredAt: candidate.occurredAt,
        receivedAt: new Date(item.receivedAt).toISOString(),
        changes: candidate.changes,
      };

      // 7. Dispatch to router/subscriptions
      if (this.dispatcher && !signal.aborted) {
        this.dispatcher.dispatch(normalizedEvent, item.subscriptionGenerationCap);
      }

      this.dedup.markDone({
        teamId: item.teamId,
        integration: item.integration,
        providerEventId: candidate.providerEventId,
        eventType: candidate.eventType,
      });
    }
  }
}
