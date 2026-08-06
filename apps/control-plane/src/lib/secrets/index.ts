import path from "node:path";

import { EncryptedFileSecretProvider } from "./encrypted-file-secret-provider";
import type { SecretProvider } from "./secret-provider";

export interface SecretStoreConfig {
  root: string;
  key: Buffer;
}

type SecretStoreEnvironment = Readonly<Record<string, string | undefined>>;

function defaultDbPath(): string {
  return path.join(process.cwd(), "data", "mystra.db");
}

export function readSecretStoreConfig(
  environment: SecretStoreEnvironment = process.env,
): SecretStoreConfig | undefined {
  const encodedKey = environment.MYSTRA_SECRET_STORE_KEY;
  if (encodedKey === undefined) {
    return undefined;
  }
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encodedKey)) {
    throw new Error("MYSTRA_SECRET_STORE_KEY must be a base64-encoded 32-byte key");
  }
  const key = Buffer.from(encodedKey, "base64");
  if (key.byteLength !== 32) {
    throw new Error("MYSTRA_SECRET_STORE_KEY must be a base64-encoded 32-byte key");
  }
  const dbPath = environment.MYSTRA_DB_PATH ?? defaultDbPath();
  return {
    root: environment.MYSTRA_SECRET_STORE_PATH ?? path.join(path.dirname(dbPath), "secrets"),
    key,
  };
}

let secretProvider: SecretProvider | undefined;
let initialized = false;

export function getSecretProvider(): SecretProvider | undefined {
  if (!initialized) {
    const config = readSecretStoreConfig();
    secretProvider = config ? new EncryptedFileSecretProvider(config) : undefined;
    initialized = true;
  }
  return secretProvider;
}

export function resetSecretProviderForTests(): void {
  secretProvider = undefined;
  initialized = false;
}
