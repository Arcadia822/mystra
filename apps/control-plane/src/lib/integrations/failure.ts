import type { IntegrationErrorCode } from "@mystra/shared";

export const integrationErrorStatusByCode: Record<IntegrationErrorCode, number> = {
  INTEGRATION_NOT_FOUND: 404,
  INTEGRATION_CONNECTION_NOT_FOUND: 404,
  INTEGRATION_CONNECTION_MISMATCH: 400,
  INTEGRATION_CONNECTION_INACTIVE: 409,
  INTEGRATION_CONNECTION_SELECTION_REQUIRED: 409,
  INTEGRATION_CONNECTION_IN_USE: 409,
  INTEGRATION_CONNECTION_METHOD_DISABLED: 503,
  INTEGRATION_CONNECTION_METHOD_UNAVAILABLE: 409,
  INTEGRATION_CONNECTION_DELETE_INCOMPLETE: 409,
  INTEGRATION_CREDENTIAL_INVALID: 401,
  INTEGRATION_CREDENTIAL_UNAVAILABLE: 409,
  GITHUB_APP_NOT_CONFIGURED: 503,
  GITHUB_OAUTH_INVALID: 400,
  GITHUB_INSTALLATION_UNVERIFIED: 403,
  REPOSITORY_CAPABILITY_UNAVAILABLE: 404,
  ISSUE_CAPABILITY_UNAVAILABLE: 404,
  REPOSITORY_NOT_FOUND: 404,
  REPOSITORY_SCOPE_REQUIRED: 400,
  ISSUE_NOT_FOUND: 404,
  ISSUE_SOURCE_NOT_CONFIGURED: 409,
  ISSUE_SCOPE_UNAVAILABLE: 409,
  ISSUE_CURSOR_INVALID: 400,
  INTEGRATION_NOT_CONFIGURED: 503,
  INTEGRATION_UNAUTHORIZED: 502,
  INTEGRATION_RATE_LIMITED: 429,
  INTEGRATION_TIMEOUT: 504,
  INTEGRATION_UPSTREAM_ERROR: 502,
  INTEGRATION_INVALID_RESPONSE: 502,
  DISPATCH_CONFLICT: 409,
  WEBHOOK_PREREQUISITE_UNAVAILABLE: 409,
  ISSUE_SOURCE_SCOPE_CONFLICT: 409,
};

/**
 * Provider-neutral Integration failure. Deliberately free of any framework
 * import so the event data plane (ingress, workers, CLI-facing services) can
 * raise domain errors without pulling in Next.js.
 */
export class IntegrationFailure extends Error {
  readonly code: IntegrationErrorCode;
  readonly status: number;
  readonly retryAfterSeconds: number | undefined;
  readonly details: Record<string, unknown> | undefined;

  constructor(input: {
    code: IntegrationErrorCode;
    message: string;
    status?: number;
    retryAfterSeconds?: number;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = "IntegrationFailure";
    this.code = input.code;
    this.status = input.status ?? integrationErrorStatusByCode[input.code];
    this.retryAfterSeconds = input.retryAfterSeconds;
    this.details = input.details;
  }
}
