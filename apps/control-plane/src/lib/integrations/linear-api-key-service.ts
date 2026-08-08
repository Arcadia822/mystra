import { randomUUID } from "node:crypto";

import {
  linearApiKeyConnectionInputSchema,
  type IntegrationConnection,
  type LinearApiKeyConnectionInput,
  type LinearTeamListResponse,
} from "@mystra/shared";
import { z } from "zod";

import type { IntegrationConnectionRecord, IntegrationConnectionUpsert, RdbProvider } from "../db/rdb-provider";
import type { SecretProvider } from "../secrets/secret-provider";
import { IntegrationFailure } from "./errors";
import {
  listLinearTeams,
  validateLinearApiKey,
  type LinearApiKeyValidation,
} from "./linear-api-key";

type LinearConnectionDb = Pick<
  RdbProvider,
  | "deleteIntegrationConnectionWithSecret"
  | "getIntegrationConnection"
  | "getIntegrationConnectionRecord"
  | "listIntegrationConnectionRecords"
  | "listProjectIssueSourcesForConnection"
  | "replaceIntegrationConnectionWithSecret"
  | "upsertIntegrationConnectionWithSecret"
>;

export class LinearApiKeyConnectionService {
  readonly #db: LinearConnectionDb;
  readonly #teamId: string;
  readonly #secrets: SecretProvider | undefined;
  readonly #validate: (apiKey: string) => Promise<LinearApiKeyValidation>;
  readonly #newId: () => string;
  readonly #newCredentialId: () => string;

  constructor(input: {
    db: LinearConnectionDb;
    teamId: string;
    secrets?: SecretProvider;
    validate?: (apiKey: string) => Promise<LinearApiKeyValidation>;
    newId?: () => string;
    newCredentialId?: () => string;
  }) {
    this.#db = input.db;
    this.#teamId = z.string().uuid().parse(input.teamId);
    this.#secrets = input.secrets;
    this.#validate = input.validate ?? ((apiKey) => validateLinearApiKey(apiKey));
    this.#newId = input.newId ?? randomUUID;
    this.#newCredentialId = input.newCredentialId ?? randomUUID;
  }

  async create(input: LinearApiKeyConnectionInput): Promise<IntegrationConnection> {
    const request = linearApiKeyConnectionInputSchema.parse(input);
    const validation = await this.#validate(request.apiKey);
    const existing = (await this.#db.listIntegrationConnectionRecords({
      integration: "linear",
      teamId: this.#teamId,
    })).find((connection) => (
      connection.authMethod === "api-key"
      && connection.providerExternalId === validation.providerExternalId
    ));
    const id = existing?.id ?? this.#newId();
    const credentialRef = `linear-api-key/${id}/${this.#newCredentialId()}`;
    const secrets = this.#requireSecrets();
    const record = await this.#db.upsertIntegrationConnectionWithSecret(
      this.#upsertInput(id, credentialRef, request.displayName ?? existing?.displayName, validation),
      secrets.seal(credentialRef, request.apiKey),
      existing?.credentialRef,
    );
    return this.#publicConnection(record.id);
  }

  async replace(id: string, input: LinearApiKeyConnectionInput): Promise<IntegrationConnection> {
    const current = await this.#requireRecord(id);
    const request = linearApiKeyConnectionInputSchema.parse(input);
    const validation = await this.#validate(request.apiKey);
    if (!current.credentialRef) throw credentialUnavailable();
    const credentialRef = `linear-api-key/${id}/${this.#newCredentialId()}`;
    const secrets = this.#requireSecrets();
    const replaced = await this.#db.replaceIntegrationConnectionWithSecret(
      id,
      this.#upsertInput(id, credentialRef, request.displayName ?? current.displayName, validation),
      secrets.seal(credentialRef, request.apiKey),
      current.credentialRef,
    );
    if (!replaced) throw connectionNotFound();
    return this.#publicConnection(id);
  }

  async delete(id: string): Promise<void> {
    const current = await this.#requireRecord(id);
    if ((await this.#db.listProjectIssueSourcesForConnection(id, { teamId: this.#teamId })).length > 0) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_IN_USE",
        message: "Linear connection is still used by Projects",
      });
    }
    if (!current.credentialRef) throw credentialUnavailable();
    const deleted = await this.#db.deleteIntegrationConnectionWithSecret(id, current.credentialRef);
    if (!deleted) throw connectionNotFound();
  }

  async listTeams(id: string, input: { first: number; after?: string }): Promise<LinearTeamListResponse> {
    const apiKey = await this.resolveApiKey(id);
    return listLinearTeams(apiKey, input);
  }

  async resolveApiKey(id: string): Promise<string> {
    const current = await this.#requireRecord(id);
    if (!current.credentialRef) throw credentialUnavailable();
    try {
      return await this.#requireSecrets().get(current.credentialRef);
    } catch {
      throw credentialUnavailable();
    }
  }

  #upsertInput(
    id: string,
    credentialRef: string,
    displayName: string | null | undefined,
    validation: LinearApiKeyValidation,
  ): IntegrationConnectionUpsert {
    return {
      id,
      teamId: this.#teamId,
      integration: "linear",
      provider: "linear",
      authMethod: "api-key",
      providerExternalId: validation.providerExternalId,
      displayName: displayName ?? null,
      providerSubject: { viewer: validation.viewer, workspace: validation.workspace },
      connectionConfig: { workspaceId: validation.workspace.id },
      capabilities: {
        issues: {
          state: "enabled",
          config: { scope: "linear-team" },
          permissions: { read: true },
          accessSummary: { teamCount: validation.teamCount },
          verifiedAt: new Date().toISOString(),
        },
      },
      credentialState: "ready",
      credentialRef,
      status: "active",
    };
  }

  async #requireRecord(id: string): Promise<IntegrationConnectionRecord> {
    const record = await this.#db.getIntegrationConnectionRecord(id);
    if (
      !record
      || record.teamId !== this.#teamId
      || record.integration !== "linear"
      || record.provider !== "linear"
      || record.authMethod !== "api-key"
    ) {
      throw connectionNotFound();
    }
    return record;
  }

  async #publicConnection(id: string): Promise<IntegrationConnection> {
    const connection = await this.#db.getIntegrationConnection(id);
    if (!connection || connection.teamId !== this.#teamId) throw connectionNotFound();
    return connection;
  }

  #requireSecrets(): SecretProvider {
    if (!this.#secrets) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_METHOD_DISABLED",
        message: "Linear API-key connections are disabled because the secret store is not configured",
      });
    }
    return this.#secrets;
  }
}

function connectionNotFound(): IntegrationFailure {
  return new IntegrationFailure({
    code: "INTEGRATION_CONNECTION_NOT_FOUND",
    message: "Linear connection not found",
  });
}

function credentialUnavailable(): IntegrationFailure {
  return new IntegrationFailure({
    code: "INTEGRATION_CREDENTIAL_UNAVAILABLE",
    message: "Linear API key is unavailable",
  });
}
