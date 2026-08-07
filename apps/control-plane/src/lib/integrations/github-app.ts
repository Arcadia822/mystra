import { createHash, randomBytes, sign } from "node:crypto";

import {
  ephemeralRepositoryCredentialSchema,
  integrationConnectionActivationSchema,
  type EphemeralRepositoryCredential,
  type IntegrationConnectionActivation,
} from "@mystra/shared";
import { z } from "zod";

import { IntegrationFailure } from "./errors";

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_OAUTH_URL = "https://github.com/login/oauth";
const DEFAULT_TIMEOUT_MS = 15_000;
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

export type GitHubAppConfig = {
  appId: string;
  clientId: string;
  clientSecret: string;
  slug: string;
  privateKey: string;
  callbackUrl: string;
};

export type PkceTransaction = {
  state: string;
  verifier: string;
  challenge: string;
};

type Fetch = typeof fetch;

const oauthTokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
}).passthrough();

const rawInstallationSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().min(1)]),
  app_id: z.union([z.number().int().positive(), z.string().min(1)]),
  account: z.object({
    id: z.union([z.number().int().positive(), z.string().min(1)]),
    login: z.string().min(1),
    type: z.string().min(1),
    avatar_url: z.string().url().optional(),
  }).passthrough(),
  repository_selection: z.enum(["all", "selected"]),
  permissions: z.record(z.string().min(1), z.string().min(1)),
}).passthrough();

const installationsEnvelopeSchema = z.object({
  installations: z.array(rawInstallationSchema),
}).passthrough();

const installationTokenSchema = z.object({
  token: z.string().min(1),
  expires_at: z.string().datetime(),
}).passthrough();

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function isTimeout(error: unknown): boolean {
  return (error instanceof DOMException && error.name === "AbortError")
    || (error instanceof Error && error.name === "TimeoutError");
}

export function readGitHubAppConfig(
  environment: Record<string, string | undefined> = process.env,
): GitHubAppConfig | undefined {
  const appId = environment.MYSTRA_GITHUB_APP_ID?.trim();
  const clientId = environment.MYSTRA_GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = environment.MYSTRA_GITHUB_APP_CLIENT_SECRET?.trim();
  const slug = environment.MYSTRA_GITHUB_APP_SLUG?.trim();
  const rawPrivateKey = environment.MYSTRA_GITHUB_APP_PRIVATE_KEY;
  const callbackUrl = environment.MYSTRA_GITHUB_APP_CALLBACK_URL?.trim();
  if (!appId || !clientId || !clientSecret || !slug || !rawPrivateKey || !callbackUrl) {
    return undefined;
  }
  try {
    new URL(callbackUrl);
  } catch {
    return undefined;
  }
  return {
    appId,
    clientId,
    clientSecret,
    slug,
    privateKey: rawPrivateKey.replaceAll("\\n", "\n"),
    callbackUrl,
  };
}

export function requireGitHubAppConfig(
  environment: Record<string, string | undefined> = process.env,
): GitHubAppConfig {
  const config = readGitHubAppConfig(environment);
  if (!config) {
    throw new IntegrationFailure({
      code: "GITHUB_APP_NOT_CONFIGURED",
      message: "GitHub App connection is not configured",
    });
  }
  return config;
}

export function createPkceTransaction(): PkceTransaction {
  const verifier = randomBytes(32).toString("base64url");
  return {
    state: randomBytes(32).toString("base64url"),
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}

export function createGitHubAppJwt(config: GitHubAppConfig, now = new Date()): string {
  const nowSeconds = Math.floor(now.getTime() / 1_000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson({ iat: nowSeconds - 60, exp: nowSeconds + 540, iss: config.appId });
  const signingInput = `${header}.${payload}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), config.privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

export function githubAppInstallationUrl(config: GitHubAppConfig): string {
  return `https://github.com/apps/${encodeURIComponent(config.slug)}/installations/new`;
}

export function githubOAuthAuthorizationUrl(
  config: GitHubAppConfig,
  transaction: Pick<PkceTransaction, "state" | "challenge">,
): string {
  const url = new URL(`${GITHUB_OAUTH_URL}/authorize`);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.callbackUrl);
  url.searchParams.set("state", transaction.state);
  url.searchParams.set("code_challenge", transaction.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export class GitHubAppService {
  private readonly config: GitHubAppConfig;
  private readonly fetchImpl: Fetch;
  private readonly timeoutMs: number;
  private readonly now: () => Date;
  private readonly tokenCache = new Map<string, EphemeralRepositoryCredential>();
  private readonly tokenFlights = new Map<string, Promise<EphemeralRepositoryCredential>>();

  constructor(input: {
    config: GitHubAppConfig;
    fetchImpl?: Fetch;
    timeoutMs?: number;
    now?: () => Date;
  }) {
    this.config = input.config;
    this.fetchImpl = input.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.now = input.now ?? (() => new Date());
  }

  async exchangeOAuthCode(code: string, verifier: string): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: this.config.callbackUrl,
      code_verifier: verifier,
    });
    const response = await this.request(`${GITHUB_OAUTH_URL}/access_token`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }, "oauth");
    const parsed = await this.parseJson(oauthTokenSchema, response, "oauth");
    return parsed.access_token;
  }

  async verifyAccessibleInstallation(
    userToken: string,
    installationId: string,
  ): Promise<IntegrationConnectionActivation> {
    const response = await this.request(`${GITHUB_API_URL}/user/installations?per_page=100`, {
      headers: this.apiHeaders(userToken),
    }, "oauth");
    const parsed = await this.parseJson(installationsEnvelopeSchema, response, "oauth");
    const installation = parsed.installations.find((candidate) => (
      String(candidate.id) === installationId && String(candidate.app_id) === this.config.appId
    ));
    if (!installation) {
      throw new IntegrationFailure({
        code: "GITHUB_INSTALLATION_UNVERIFIED",
        message: "The GitHub App installation could not be verified",
      });
    }
    return integrationConnectionActivationSchema.parse({
      integration: "github",
      provider: "github",
      authMethod: "github-app",
      providerExternalId: String(installation.id),
      providerSubject: {
        externalId: String(installation.account.id),
        login: installation.account.login,
        type: installation.account.type,
        ...(installation.account.avatar_url ? { avatarUrl: installation.account.avatar_url } : {}),
      },
      capabilities: {
        repositories: {
          state: "enabled",
          config: { selection: installation.repository_selection },
          permissions: installation.permissions,
          accessSummary: {},
          verifiedAt: this.now().toISOString(),
        },
      },
      credentialState: "ready",
    });
  }

  async getInstallationCredential(installationId: string): Promise<EphemeralRepositoryCredential> {
    const cached = this.tokenCache.get(installationId);
    if (cached && new Date(cached.expiresAt).getTime() - TOKEN_EXPIRY_MARGIN_MS > this.now().getTime()) {
      return cached;
    }
    const inFlight = this.tokenFlights.get(installationId);
    if (inFlight) {
      return inFlight;
    }
    const flight = this.createInstallationCredential(installationId)
      .finally(() => this.tokenFlights.delete(installationId));
    this.tokenFlights.set(installationId, flight);
    return flight;
  }

  private async createInstallationCredential(installationId: string): Promise<EphemeralRepositoryCredential> {
    const jwt = createGitHubAppJwt(this.config, this.now());
    const response = await this.request(
      `${GITHUB_API_URL}/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
      { method: "POST", headers: this.apiHeaders(jwt) },
      "installation",
    );
    const parsed = await this.parseJson(installationTokenSchema, response, "installation");
    const credential = ephemeralRepositoryCredentialSchema.parse({
      provider: "github",
      username: "x-access-token",
      secret: parsed.token,
      expiresAt: parsed.expires_at,
    });
    this.tokenCache.set(installationId, credential);
    return credential;
  }

  private apiHeaders(token: string): Record<string, string> {
    return {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    };
  }

  private async parseJson<T extends z.ZodType>(
    schema: T,
    response: Response,
    context: "oauth" | "installation",
  ): Promise<z.infer<T>> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new IntegrationFailure({
        code: context === "oauth" ? "GITHUB_OAUTH_INVALID" : "INTEGRATION_INVALID_RESPONSE",
        message: "GitHub returned an invalid response",
      });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new IntegrationFailure({
        code: context === "oauth" ? "GITHUB_OAUTH_INVALID" : "INTEGRATION_INVALID_RESPONSE",
        message: "GitHub returned an invalid response",
      });
    }
    return parsed.data;
  }

  private async request(
    url: string,
    init: RequestInit,
    context: "oauth" | "installation",
  ): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (error) {
      if (isTimeout(error)) {
        throw new IntegrationFailure({ code: "INTEGRATION_TIMEOUT", message: "GitHub request timed out" });
      }
      throw new IntegrationFailure({ code: "INTEGRATION_UPSTREAM_ERROR", message: "GitHub request failed" });
    }
    if (response.status === 429 || (
      response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0"
    )) {
      throw new IntegrationFailure({ code: "INTEGRATION_RATE_LIMITED", message: "GitHub rate limit exceeded" });
    }
    if (response.status === 401 || response.status === 403) {
      throw new IntegrationFailure({
        code: context === "oauth" ? "GITHUB_OAUTH_INVALID" : "INTEGRATION_UNAUTHORIZED",
        message: "GitHub rejected the request",
      });
    }
    if (!response.ok) {
      throw new IntegrationFailure({ code: "INTEGRATION_UPSTREAM_ERROR", message: `GitHub request failed with HTTP ${response.status}` });
    }
    return response;
  }
}

let service: GitHubAppService | undefined;

export function getGitHubAppService(): GitHubAppService {
  service ??= new GitHubAppService({ config: requireGitHubAppConfig() });
  return service;
}

export function resetGitHubAppServiceForTests(): void {
  service = undefined;
}
