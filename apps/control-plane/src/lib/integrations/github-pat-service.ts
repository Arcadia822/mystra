import { randomUUID } from "node:crypto";

import {
  personalAccessTokenConnectionInputSchema,
  type IntegrationConnection,
  type PersonalAccessTokenConnectionInput,
} from "@mystra/shared";

import type {
  IntegrationConnectionRecord,
  IntegrationConnectionUpsert,
  RdbProvider,
} from "../db/rdb-provider";
import type { SecretProvider } from "../secrets/secret-provider";
import { IntegrationFailure } from "./errors";
import { validateGitHubPat, type GitHubPatValidation } from "./github-pat";

type PatConnectionDb = Pick<
  RdbProvider,
  | "deleteIntegrationConnection"
  | "getIntegrationConnection"
  | "getIntegrationConnectionRecord"
  | "listIntegrationConnectionRecords"
  | "listProjectsForIntegrationConnection"
  | "replaceIntegrationConnection"
  | "setIntegrationConnectionStatus"
  | "upsertIntegrationConnection"
>;

export class GitHubPatConnectionService {
  readonly #db: PatConnectionDb;
  readonly #secrets: SecretProvider | undefined;
  readonly #validate: (token: string) => Promise<GitHubPatValidation>;
  readonly #newId: () => string;

  constructor(input: {
    db: PatConnectionDb;
    secrets?: SecretProvider;
    validate?: (token: string) => Promise<GitHubPatValidation>;
    newId?: () => string;
  }) {
    this.#db = input.db;
    this.#secrets = input.secrets;
    this.#validate = input.validate ?? ((token) => validateGitHubPat(token));
    this.#newId = input.newId ?? randomUUID;
  }

  async create(input: PersonalAccessTokenConnectionInput): Promise<IntegrationConnection> {
    const request = personalAccessTokenConnectionInputSchema.parse(input);
    const validation = await this.#validate(request.token);
    const existing = this.#db.listIntegrationConnectionRecords({ integration: "github" })
      .find((connection) => (
        connection.connectionType === "personal-access-token"
        && connection.providerExternalId === validation.providerExternalId
      ));
    const id = existing?.id ?? this.#newId();
    const credentialRef = existing?.credentialRef ?? `github-pat/${id}`;
    const secrets = this.#requireSecrets();
    await secrets.put(credentialRef, request.token);
    try {
      const record = this.#db.upsertIntegrationConnection(this.#upsertInput(
        id,
        credentialRef,
        request.displayName ?? existing?.displayName,
        validation,
      ));
      return this.#publicConnection(record.id);
    } catch (error) {
      if (!existing) {
        await secrets.delete(credentialRef).catch(() => undefined);
      }
      throw error;
    }
  }

  async replace(
    id: string,
    input: PersonalAccessTokenConnectionInput,
  ): Promise<IntegrationConnection> {
    const current = this.#requirePatRecord(id);
    const request = personalAccessTokenConnectionInputSchema.parse(input);
    const validation = await this.#validate(request.token);
    const credentialRef = current.credentialRef;
    if (!credentialRef) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CREDENTIAL_UNAVAILABLE",
        message: "The PAT connection has no credential reference",
      });
    }
    await this.#requireSecrets().put(credentialRef, request.token);
    const replaced = this.#db.replaceIntegrationConnection(id, this.#upsertInput(
      id,
      credentialRef,
      request.displayName ?? current.displayName,
      validation,
    ));
    if (!replaced) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_NOT_FOUND",
        message: "The PAT connection no longer exists",
      });
    }
    return this.#publicConnection(id);
  }

  async delete(id: string): Promise<void> {
    const current = this.#db.getIntegrationConnectionRecord(id);
    if (!current) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_NOT_FOUND",
        message: "Integration connection not found",
      });
    }
    const projects = this.#db.listProjectsForIntegrationConnection(id);
    if (projects.length > 0) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_IN_USE",
        message: "Integration connection is still used by Projects",
        details: { projects: projects.map((project) => ({ id: project.id, slug: project.slug })) },
      });
    }
    this.#db.setIntegrationConnectionStatus(id, "inactive");
    if (current.connectionType === "personal-access-token" && current.credentialRef) {
      try {
        await this.#requireSecrets().delete(current.credentialRef);
      } catch {
        throw new IntegrationFailure({
          code: "INTEGRATION_CONNECTION_DELETE_INCOMPLETE",
          message: "The connection was disabled but its credential could not be removed",
        });
      }
    }
    this.#db.deleteIntegrationConnection(id);
  }

  #upsertInput(
    id: string,
    credentialRef: string,
    displayName: string | undefined,
    validation: GitHubPatValidation,
  ): IntegrationConnectionUpsert {
    return {
      id,
      integration: "github",
      provider: "github",
      connectionType: "personal-access-token",
      providerExternalId: validation.providerExternalId,
      ...(displayName ? { displayName } : {}),
      account: validation.account,
      repositorySelection: validation.repositorySelection,
      permissions: validation.permissions,
      credentialState: "ready",
      credentialRef,
      accessSummary: validation.accessSummary,
      status: "active",
    };
  }

  #requirePatRecord(id: string): IntegrationConnectionRecord {
    const record = this.#db.getIntegrationConnectionRecord(id);
    if (!record) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_NOT_FOUND",
        message: "Integration connection not found",
      });
    }
    if (record.connectionType !== "personal-access-token") {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_MISMATCH",
        message: "Only a PAT connection can replace a personal access token",
      });
    }
    return record;
  }

  #publicConnection(id: string): IntegrationConnection {
    const connection = this.#db.getIntegrationConnection(id);
    if (!connection) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_NOT_FOUND",
        message: "Integration connection was not persisted",
      });
    }
    return connection;
  }

  #requireSecrets(): SecretProvider {
    if (!this.#secrets) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_METHOD_DISABLED",
        message: "PAT connections are disabled because the secret store is not configured",
      });
    }
    return this.#secrets;
  }
}
