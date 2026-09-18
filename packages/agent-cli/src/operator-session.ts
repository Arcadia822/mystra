import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const OPERATOR_SESSION_VERSION = 1;
const sessionTokenPattern = /^[A-Za-z0-9_-]{16,}$/u;
const MAX_SESSION_FILE_BYTES = 64 * 1024;

export class OperatorSessionError extends Error {
  constructor(readonly code: "missing" | "invalid" | "insecure", message: string) {
    super(message);
    this.name = "OperatorSessionError";
  }
}

export interface OperatorSession {
  readonly controlPlaneUrl: string;
  readonly sessionToken: string;
}

export function defaultOperatorSessionPath(env: Record<string, string | undefined>): string {
  return env.MYSTRA_OPERATOR_STATE_PATH ?? join(homedir(), ".mystra", "operator-session.json");
}

/**
 * Reads the existing operator session store without following symlinks and
 * without a lstat-then-read race: the file is opened once and type, owner, and
 * permissions are checked on that same handle before any parse.
 */
export function readOperatorSession(filePath: string, expectedUid = process.getuid?.()): OperatorSession {
  let fd: number;
  try {
    fd = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "ENOENT") {
      throw new OperatorSessionError("missing", "No operator session file was found");
    }
    if (code === "ELOOP") {
      throw new OperatorSessionError("insecure", "The operator session file must not be a symlink");
    }
    throw new OperatorSessionError("invalid", "The operator session file could not be opened");
  }

  try {
    const stats = fstatSync(fd);
    if (!stats.isFile()) {
      throw new OperatorSessionError("insecure", "The operator session path is not a regular file");
    }
    if (expectedUid !== undefined && stats.uid !== expectedUid) {
      throw new OperatorSessionError("insecure", "The operator session file is owned by another user");
    }
    if ((stats.mode & 0o077) !== 0) {
      throw new OperatorSessionError("insecure", "The operator session file must not be accessible to other users");
    }
    if (stats.size > MAX_SESSION_FILE_BYTES) {
      throw new OperatorSessionError("invalid", "The operator session file is unexpectedly large");
    }

    const buffer = Buffer.alloc(Number(stats.size));
    const read = readSync(fd, buffer, 0, buffer.length, 0);
    return parseOperatorSession(buffer.subarray(0, read).toString("utf8"));
  } finally {
    closeSync(fd);
  }
}

export function parseOperatorSession(contents: string): OperatorSession {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new OperatorSessionError("invalid", "The operator session file is not valid JSON");
  }
  if (
    !parsed
    || typeof parsed !== "object"
    || (parsed as { version?: unknown }).version !== OPERATOR_SESSION_VERSION
    || typeof (parsed as { controlPlaneUrl?: unknown }).controlPlaneUrl !== "string"
    || typeof (parsed as { sessionToken?: unknown }).sessionToken !== "string"
    || !sessionTokenPattern.test((parsed as { sessionToken: string }).sessionToken)
  ) {
    throw new OperatorSessionError("invalid", "The operator session file is invalid");
  }
  const controlPlaneUrl = (parsed as { controlPlaneUrl: string }).controlPlaneUrl;
  let origin: string;
  try {
    const url = new URL(controlPlaneUrl);
    if (url.protocol !== "https:" && !isLoopbackHttp(url)) {
      throw new Error("insecure origin");
    }
    origin = url.origin;
  } catch {
    throw new OperatorSessionError("invalid", "The operator session control plane URL is invalid or not secure");
  }
  return { controlPlaneUrl: origin, sessionToken: (parsed as { sessionToken: string }).sessionToken };
}

export function isLoopbackHttp(url: URL): boolean {
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

/**
 * Resolves the subscription target origin, requiring it to equal the session
 * file origin so the Authorization header never crosses to another Host.
 */
export function resolveSubscriptionOrigin(input: {
  sessionOrigin: string;
  serverOverride?: string | undefined;
  environmentServer?: string | undefined;
}): string {
  const requested = input.serverOverride ?? input.environmentServer;
  if (!requested) return input.sessionOrigin;

  let origin: string;
  try {
    const url = new URL(requested);
    if (url.protocol !== "https:" && !isLoopbackHttp(url)) {
      throw new Error("insecure origin");
    }
    origin = url.origin;
  } catch {
    throw new OperatorSessionError("invalid", "--server must be an https URL or a loopback http URL");
  }
  if (origin !== input.sessionOrigin) {
    throw new OperatorSessionError("invalid", "--server must match the operator session control plane origin");
  }
  return origin;
}
