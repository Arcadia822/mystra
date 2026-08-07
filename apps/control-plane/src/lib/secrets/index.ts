import type { RdbProvider } from "../db/rdb-provider";
import { RdbSecretProvider } from "./rdb-secret-provider";
import type { SecretProvider } from "./secret-provider";

export interface SecretStoreConfig {
  key: Buffer;
  keyId: string;
}

type SecretStoreEnvironment = Readonly<Record<string, string | undefined>>;

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
  const keyId = environment.MYSTRA_SECRET_STORE_KEY_ID ?? "env-v1";
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(keyId)) {
    throw new Error("MYSTRA_SECRET_STORE_KEY_ID is invalid");
  }
  return {
    key,
    keyId,
  };
}

export function getSecretProvider(db: RdbProvider): SecretProvider | undefined {
  const config = readSecretStoreConfig();
  return config ? new RdbSecretProvider({ db, ...config }) : undefined;
}

export function resetSecretProviderForTests(): void {
  // Provider construction is stateless; retained as an explicit test lifecycle hook.
}
