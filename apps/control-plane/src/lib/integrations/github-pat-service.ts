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
  | "deleteIntegrationConnectionWithSecret"
  | "getIntegrationConnection"
  | "getIntegrationConnectionRecord"
  | "listIntegrationConnectionRecords"
  | "listProjectsForIntegrationConnection"
  | "replaceIntegrationConnectionWithSecret"
  | "upsertIntegrationConnectionWithSecret"
>;

export class GitHubPatConnectionService {
  readonly #db: PatConnectionDb;
  readonly #secrets: SecretProvider | undefined;
  readonly #validate: (token: string) => Promise<GitHubPatValidation>;
  readonly #newId: () => string;
  readonly #newCredentialId: () => string;

  constructor(input: {
    db: PatConnectionDb;
    secrets?: SecretProvider;
    validate?: (token: string) => Promise<GitHubPatValidation>;
    newId?: () => string;
    newCredentialId?: () => string;
  }) {
    this.#db = input.db;
    this.#secrets = input.secrets;
    this.#validate = input.validate ?? ((token) => validateGitHubPat(token));
    this.#newId = input.newId ?? randomUUID;
    this.#newCredentialId = input.newCredentialId ?? randomUUID;
  }

  async create(input: PersonalAccessTokenConnectionInput): Promise<IntegrationConnection> {
    const request = personalAccessTokenConnectionInputSchema.parse(input);
    const validation = await this.#validate(request.token);
    const existing = (await this.#db.listIntegrationConnectionRecords({ integration: "github" }))
      .find((connection) => (
        connection.authMethod === "personal-access-token"
        && connection.providerExternalId === validation.providerExternalId
      ));
    const id = existing?.id ?? this.#newId();
    const credentialRef = `github-pat/${id}/${this.#newCredentialId()}`;
    const secrets = this.#requireSecrets();
    const record = await this.#db.upsertIntegrationConnectionWithSecret(
      this.#upsertInput(
        id,
        credentialRef,
        request.displayName ?? existing?.displayName,
        validation,
      ),
      secrets.seal(credentialRef, request.token),
      existing?.credentialRef,
    );
    return await this.#publicConnection(record.id);
  }

  async replace(
    id: string,
    input: PersonalAccessTokenConnectionInput,
  ): Promise<IntegrationConnection> {
    const current = await this.#requirePatRecord(id);
    const request = personalAccessTokenConnectionInputSchema.parse(input);
    const validation = await this.#validate(request.token);
    const previousCredentialRef = current.credentialRef;
    if (!previousCredentialRef) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CREDENTIAL_UNAVAILABLE",
        message: "The PAT connection has no credential reference",
      });
    }
    const credentialRef = `github-pat/${id}/${this.#newCredentialId()}`;
    const secrets = this.#requireSecrets();
    const replaced = await this.#db.replaceIntegrationConnectionWithSecret(
      id,
      this.#upsertInput(
        id,
        credentialRef,
        request.displayName ?? current.displayName,
        validation,
      ),
      secrets.seal(credentialRef, request.token),
      previousCredentialRef,
    );
    if (!replaced) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_NOT_FOUND",
        message: "The PAT connection no longer exists",
      });
    }
    return this.#publicConnection(id);
  }

  async delete(id: string): Promise<void> {
    const current = await this.#db.getIntegrationConnectionRecord(id);
    if (!current) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_NOT_FOUND",
        message: "Integration connection not found",
      });
    }
    const projects = await this.#db.listProjectsForIntegrationConnection(id);
    if (projects.length > 0) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_IN_USE",
        message: "Integration connection is still used by Projects",
        details: { projects: projects.map((project) => ({ id: project.id, slug: project.slug })) },
      });
    }
    if (current.authMethod === "personal-access-token" && current.credentialRef) {
      this.#requireSecrets();
      let deleted: boolean;
      try {
        deleted = await this.#db.deleteIntegrationConnectionWithSecret(id, current.credentialRef);
      } catch {
        throw new IntegrationFailure({
          code: "INTEGRATION_CONNECTION_DELETE_INCOMPLETE",
          message: "The connection and its credential could not be removed",
        });
      }
      if (!deleted) {
        throw new IntegrationFailure({
          code: "INTEGRATION_CONNECTION_NOT_FOUND",
          message: "Integration connection no longer exists",
        });
      }
      return;
    }
    await this.#db.deleteIntegrationConnection(id);
  }

  #upsertInput(
    id: string,
    credentialRef: string,
    displayName: string | null | undefined,
    validation: GitHubPatValidation,
  ): IntegrationConnectionUpsert {
    return {
      id,
      integration: "github",
      provider: "github",
      authMethod: "personal-access-token",
      providerExternalId: validation.providerExternalId,
      displayName: displayName ?? null,
      providerSubject: validation.account,
      connectionConfig: {},
      capabilities: {
        repositories: {
          state: "enabled",
          config: { selection: validation.repositorySelection },
          permissions: validation.permissions,
          accessSummary: validation.accessSummary,
          verifiedAt: new Date().toISOString(),
        },
      },
      credentialState: "ready",
      credentialRef,
      status: "active",
    };
  }

  async #requirePatRecord(id: string): Promise<IntegrationConnectionRecord> {
    const record = await this.#db.getIntegrationConnectionRecord(id);
    if (!record) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_NOT_FOUND",
        message: "Integration connection not found",
      });
    }
    if (record.authMethod !== "personal-access-token") {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_MISMATCH",
        message: "Only a PAT connection can replace a personal access token",
      });
    }
    return record;
  }

  async #publicConnection(id: string): Promise<IntegrationConnection> {
    const connection = await this.#db.getIntegrationConnection(id);
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
