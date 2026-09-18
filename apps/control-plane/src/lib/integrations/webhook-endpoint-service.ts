import type { RdbProvider } from "@/lib/db";
import { IntegrationFailure } from "./failure"
import type { IntegrationWebhookResponse } from "@mystra/shared";

export class WebhookEndpointService {
  constructor(
    private readonly db: RdbProvider,
    private readonly options: {
      publicOrigin?: string;
    } = {},
  ) {}

  private getPublicOrigin(): string {
    const configured = this.options.publicOrigin ?? process.env.MYSTRA_PUBLIC_URL;
    if (configured) {
      return configured.replace(/\/+$/, "");
    }
    return "http://localhost:3000";
  }

  async getOrCreateWebhookEndpoint(
    connectionId: string,
    teamId: string,
  ): Promise<IntegrationWebhookResponse> {
    const connection = await this.db.getIntegrationConnectionRecord(connectionId);
    if (!connection || connection.teamId !== teamId) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_NOT_FOUND",
        message: "Integration connection not found for team",
      });
    }

    if (connection.status !== "active" || connection.credentialState !== "ready") {
      throw new IntegrationFailure({
        code: "WEBHOOK_PREREQUISITE_UNAVAILABLE",
        message: "Integration connection is not active or ready",
      });
    }

    const endpoint = await this.db.createIntegrationWebhookEndpoint({
      teamId,
      connectionId,
    });

    const publicOrigin = this.getPublicOrigin();
    const webhookUrl = `${publicOrigin}/api/webhooks?token=${endpoint.id}`;

    return {
      endpoint: {
        id: endpoint.id,
        connectionId: endpoint.connectionId,
        integration: connection.integration,
        createdAt: endpoint.createdAt,
        updatedAt: endpoint.updatedAt,
      },
      webhookUrl,
    };
  }
}
