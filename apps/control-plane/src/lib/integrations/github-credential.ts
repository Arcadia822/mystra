import {
  ephemeralRepositoryCredentialSchema,
  type EphemeralRepositoryCredential,
} from "@mystra/shared";

import type { IntegrationConnectionRecord, RdbProvider } from "../db/rdb-provider";
import { getDb } from "../db";
import { getSecretProvider } from "../secrets";
import type { SecretProvider } from "../secrets/secret-provider";
import { assertGitHubAppAvailable } from "./deployment-capabilities";
import { IntegrationFailure } from "./errors";
import type { GitHubAppService } from "./github-app";

type CredentialDb = Pick<
  RdbProvider,
  "getIntegrationConnectionRecord" | "listIntegrationConnectionRecords"
>;

export interface ResolvedGitHubCredential {
  connection: IntegrationConnectionRecord;
  credential: EphemeralRepositoryCredential;
}

export class GitHubCredentialResolver {
  readonly #db: CredentialDb;
  readonly #appService: Pick<GitHubAppService, "getInstallationCredential"> | undefined;
  readonly #githubAppAvailable: boolean;
  readonly #secrets: SecretProvider | undefined;
  readonly #now: () => Date;

  constructor(input: {
    db: CredentialDb;
    appService?: Pick<GitHubAppService, "getInstallationCredential">;
    githubAppAvailable?: boolean;
    secrets?: SecretProvider;
    now?: () => Date;
  }) {
    this.#db = input.db;
    this.#appService = input.appService;
    this.#githubAppAvailable = input.githubAppAvailable ?? false;
    this.#secrets = input.secrets;
    this.#now = input.now ?? (() => new Date());
  }

  async resolve(connectionId?: string): Promise<ResolvedGitHubCredential> {
    const connection = await this.#resolveConnection(connectionId);
    if (connection.status !== "active" || connection.credentialState !== "ready") {
      throw new IntegrationFailure({
        code: "INTEGRATION_CREDENTIAL_UNAVAILABLE",
        message: "The selected GitHub connection is not ready",
      });
    }

    if (connection.authMethod === "github-app") {
      assertGitHubAppAvailable({ githubApp: this.#githubAppAvailable });
      if (!this.#appService) {
        throw new IntegrationFailure({
          code: "INTEGRATION_CREDENTIAL_UNAVAILABLE",
          message: "GitHub App credential service is unavailable",
        });
      }
      return {
        connection,
        credential: await this.#appService.getInstallationCredential(connection.providerExternalId),
      };
    }

    if (!connection.credentialRef || !this.#secrets) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CREDENTIAL_UNAVAILABLE",
        message: "The selected PAT credential is unavailable",
      });
    }
    let token: string;
    try {
      token = await this.#secrets.get(connection.credentialRef);
    } catch {
      throw new IntegrationFailure({
        code: "INTEGRATION_CREDENTIAL_UNAVAILABLE",
        message: "The selected PAT credential is unavailable",
      });
    }
    return {
      connection,
      credential: ephemeralRepositoryCredentialSchema.parse({
        provider: "github",
        username: "x-access-token",
        secret: token,
        expiresAt: new Date(this.#now().getTime() + 5 * 60_000).toISOString(),
      }),
    };
  }

  async #resolveConnection(connectionId?: string): Promise<IntegrationConnectionRecord> {
    if (connectionId) {
      const connection = await this.#db.getIntegrationConnectionRecord(connectionId);
      if (!connection || connection.integration !== "github" || connection.provider !== "github") {
        throw new IntegrationFailure({
          code: "INTEGRATION_CONNECTION_NOT_FOUND",
          message: "GitHub connection not found",
        });
      }
      return connection;
    }
    const active = (await this.#db.listIntegrationConnectionRecords({ integration: "github" }))
      .filter((connection) => connection.status === "active");
    if (active.length === 0) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_NOT_FOUND",
        message: "GitHub connection not found",
      });
    }
    if (active.length !== 1) {
      throw new IntegrationFailure({
        code: "INTEGRATION_CONNECTION_SELECTION_REQUIRED",
        message: "Select a GitHub connection explicitly",
      });
    }
    return active[0]!;
  }
}

export async function defaultGitHubCredentialResolver(): Promise<GitHubCredentialResolver> {
  return new GitHubCredentialResolver({
    db: await getDb(),
    ...(getSecretProvider() ? { secrets: getSecretProvider()! } : {}),
  });
}
