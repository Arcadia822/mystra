import {
  changeDisplayNameRequestSchema,
  changePasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  type AccountView,
  type ChangeDisplayNameRequest,
  type ChangePasswordRequest,
  type LoginRequest,
  type RegisterRequest,
} from "@mystra/shared";

import type {
  AuthSessionRecord,
  RdbProvider,
  UserRecord,
} from "../db/rdb-provider";
import { AuthError } from "./errors";
import { hashPassword, verifyPassword } from "./password";
import {
  assertRequestOrigin,
  createSessionToken,
  extractSessionToken,
  hashSessionToken,
  type SessionPresentationSource,
} from "./session";

const defaultSessionTtlMs = 30 * 24 * 60 * 60 * 1000;
const loginPaddingCredential = hashPassword("mystra-login-padding-credential");

export type AuthenticatedSession = {
  user: UserRecord;
  session: AuthSessionRecord;
  source: SessionPresentationSource;
};

export type AuthenticatedLogin = {
  user: AccountView;
  session: AuthSessionRecord;
  token: string;
};

export function toAccountView(user: UserRecord): AccountView {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    status: user.status,
    requirePasswordChange: user.requirePasswordChange,
  };
}

export async function authenticateRequest(
  db: Pick<RdbProvider, "deleteAuthSession" | "getAuthSessionByTokenHash" | "getUserById">,
  request: Request,
  options: { now?: () => Date } = {},
): Promise<AuthenticatedSession> {
  const presentation = extractSessionToken(request);
  if (!presentation) throw new AuthError("unauthenticated");
  assertRequestOrigin(request, presentation.source);

  const session = await db.getAuthSessionByTokenHash(hashSessionToken(presentation.token));
  if (!session) throw new AuthError("unauthenticated");

  const now = (options.now ?? (() => new Date()))();
  const expiresAt = new Date(session.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    await db.deleteAuthSession(session.id);
    throw new AuthError("unauthenticated");
  }

  const user = await db.getUserById(session.userId);
  if (!user || user.status !== "active") {
    await db.deleteAuthSession(session.id);
    throw new AuthError("unauthenticated");
  }
  return { user, session, source: presentation.source };
}

export function assertPasswordChangeAllowed(
  user: Pick<UserRecord, "requirePasswordChange">,
  operation: "session" | "change-password" | "logout" | string,
): void {
  if (
    user.requirePasswordChange
    && !["session", "change-password", "logout"].includes(operation)
  ) {
    throw new AuthError("password-change-required");
  }
}

export async function changePassword(
  db: Pick<
    RdbProvider,
    "getAuthAccountForUser" | "replacePasswordCredentialAndRevokeOtherSessions"
  >,
  input: ChangePasswordRequest,
  subject: Pick<AuthenticatedSession, "user" | "session">,
): Promise<AccountView> {
  const request = changePasswordRequestSchema.parse(input);
  const account = await db.getAuthAccountForUser(subject.user.id);
  if (!account || !await verifyPassword(request.currentPassword, account)) {
    throw new AuthError("invalid-credentials");
  }
  const credential = await hashPassword(request.newPassword);
  const user = await db.replacePasswordCredentialAndRevokeOtherSessions({
    userId: subject.user.id,
    currentSessionId: subject.session.id,
    ...credential,
  });
  if (!user) throw new AuthError("unauthenticated");
  return toAccountView(user);
}

export async function changeDisplayName(
  db: Pick<RdbProvider, "updateUserDisplayName">,
  input: ChangeDisplayNameRequest,
  userId: string,
): Promise<AccountView> {
  const request = changeDisplayNameRequestSchema.parse(input);
  const user = await db.updateUserDisplayName(userId, request.displayName);
  if (!user) throw new AuthError("unauthenticated");
  return toAccountView(user);
}

export async function assertBootstrapReady(
  db: Pick<RdbProvider, "hasActiveLocalUser">,
): Promise<void> {
  if (!await db.hasActiveLocalUser()) throw new AuthError("installation-incomplete");
}

export class LoginRateLimiter {
  readonly #failures = new Map<string, number[]>();
  readonly #maxAttempts: number;
  readonly #windowMs: number;

  constructor(options: { maxAttempts?: number; windowMs?: number } = {}) {
    this.#maxAttempts = options.maxAttempts ?? 5;
    this.#windowMs = options.windowMs ?? 15 * 60 * 1000;
  }

  allow(key: string, now = Date.now()): boolean {
    const failures = this.#prune(key, now);
    return failures.length < this.#maxAttempts;
  }

  recordFailure(key: string, now = Date.now()): void {
    const failures = this.#prune(key, now);
    failures.push(now);
    this.#failures.set(key, failures);
  }

  clear(key: string): void {
    this.#failures.delete(key);
  }

  #prune(key: string, now: number): number[] {
    const failures = (this.#failures.get(key) ?? []).filter(
      (timestamp) => timestamp > now - this.#windowMs,
    );
    if (failures.length > 0) this.#failures.set(key, failures);
    else this.#failures.delete(key);
    return failures;
  }
}

export class LocalAuthService {
  readonly #db: Pick<
    RdbProvider,
    "createAuthSession" | "getAuthAccountForUser" | "getUserByUsername" | "registerLocalUser"
  >;
  readonly #now: () => Date;
  readonly #sessionTtlMs: number;
  readonly #rateLimiter: LoginRateLimiter;

  constructor(
    db: Pick<
      RdbProvider,
      "createAuthSession" | "getAuthAccountForUser" | "getUserByUsername" | "registerLocalUser"
    >,
    options: {
      now?: () => Date;
      rateLimiter?: LoginRateLimiter;
      sessionTtlMs?: number;
    } = {},
  ) {
    this.#db = db;
    this.#now = options.now ?? (() => new Date());
    this.#rateLimiter = options.rateLimiter ?? new LoginRateLimiter();
    this.#sessionTtlMs = options.sessionTtlMs ?? defaultSessionTtlMs;
  }

  async register(
    input: RegisterRequest,
    context: { ipAddress?: string; userAgent?: string; initialTeamDisplayName?: string } = {},
  ): Promise<AuthenticatedLogin> {
    const request = registerRequestSchema.parse(input);
    const credential = await hashPassword(request.password);
    const token = createSessionToken();
    const expiresAt = this.#expiresAt();
    const registered = await this.#db.registerLocalUser({
      username: request.username,
      displayUsername: input.username.trim(),
      displayName: input.username.trim(),
      ...credential,
      initialTeamDisplayName: context.initialTeamDisplayName ?? `${input.username.trim()}'s Team`,
      tokenHash: hashSessionToken(token),
      expiresAt,
      ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent } : {}),
    });
    return { user: toAccountView(registered.user), session: registered.session, token };
  }

  async login(
    input: LoginRequest,
    context: { ipAddress?: string; userAgent?: string; rateLimitKey?: string } = {},
  ): Promise<AuthenticatedLogin> {
    const request = loginRequestSchema.parse(input);
    const key = context.rateLimitKey ?? context.ipAddress ?? "unknown";
    if (!this.#rateLimiter.allow(key, this.#now().getTime())) {
      throw new AuthError("login-rate-limited");
    }

    const user = await this.#db.getUserByUsername(request.username);
    const account = user ? await this.#db.getAuthAccountForUser(user.id) : undefined;
    const credential = user?.status === "active" && account
      ? account
      : await loginPaddingCredential;
    const valid = Boolean(user && account && await verifyPassword(request.password, credential));
    if (!valid || !user) {
      this.#rateLimiter.recordFailure(key, this.#now().getTime());
      throw new AuthError("invalid-credentials");
    }

    this.#rateLimiter.clear(key);
    const token = createSessionToken();
    const session = await this.#db.createAuthSession({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: this.#expiresAt(),
      ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent } : {}),
    });
    return { user: toAccountView(user), session, token };
  }

  #expiresAt(): string {
    return new Date(this.#now().getTime() + this.#sessionTtlMs).toISOString();
  }
}

export { AuthError };
