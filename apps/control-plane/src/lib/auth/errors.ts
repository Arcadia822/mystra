export type AuthErrorCode =
  | "csrf-failed"
  | "installation-incomplete"
  | "invalid-credentials"
  | "login-rate-limited"
  | "password-change-required"
  | "unauthenticated";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
    this.code = code;
  }
}
