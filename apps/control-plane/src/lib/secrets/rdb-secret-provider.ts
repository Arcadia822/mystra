import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type {
  RdbProvider,
  SecretEnvelopeRecord,
  SecretEnvelopeWrite,
} from "../db/rdb-provider";
import type { SecretProvider } from "./secret-provider";

interface RdbSecretProviderOptions {
  db: Pick<RdbProvider, "createSecretEnvelope" | "deleteSecretEnvelope" | "getSecretEnvelope">;
  key: Uint8Array;
  keyId: string;
}

const SECRET_REFERENCE_PATTERN = /^github-pat\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALGORITHM = "aes-256-gcm+aes-256-gcm-wrap" as const;

export class RdbSecretProvider implements SecretProvider {
  readonly #db: RdbSecretProviderOptions["db"];
  readonly #key: Buffer;
  readonly #keyId: string;

  constructor(options: RdbSecretProviderOptions) {
    if (options.key.byteLength !== 32) {
      throw new Error("Secret store key must contain exactly 32 bytes");
    }
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(options.keyId)) {
      throw new Error("Secret store key ID is invalid");
    }
    this.#db = options.db;
    this.#key = Buffer.from(options.key);
    this.#keyId = options.keyId;
  }

  seal(reference: string, plaintext: string): SecretEnvelopeWrite {
    this.#assertReference(reference);
    const dataKey = randomBytes(32);
    try {
      const content = encrypt(
        Buffer.from(plaintext, "utf8"),
        dataKey,
        additionalData("content", reference, this.#keyId),
      );
      const wrapped = encrypt(
        dataKey,
        this.#key,
        additionalData("wrap", reference, this.#keyId),
      );
      return {
        reference,
        version: 1,
        algorithm: ALGORITHM,
        keyId: this.#keyId,
        ciphertext: content.ciphertext.toString("base64"),
        ciphertextIv: content.iv.toString("base64"),
        ciphertextAuthTag: content.authTag.toString("base64"),
        wrappedDataKey: wrapped.ciphertext.toString("base64"),
        wrappedDataKeyIv: wrapped.iv.toString("base64"),
        wrappedDataKeyAuthTag: wrapped.authTag.toString("base64"),
      };
    } finally {
      dataKey.fill(0);
    }
  }

  async put(reference: string, plaintext: string): Promise<void> {
    await this.#db.createSecretEnvelope(this.seal(reference, plaintext));
  }

  async get(reference: string): Promise<string> {
    this.#assertReference(reference);
    const envelope = await this.#db.getSecretEnvelope(reference);
    if (!envelope) throw new Error("Secret is unavailable");
    return this.#open(envelope);
  }

  async delete(reference: string): Promise<void> {
    this.#assertReference(reference);
    await this.#db.deleteSecretEnvelope(reference);
  }

  #open(envelope: SecretEnvelopeRecord): string {
    let dataKey: Buffer | undefined;
    try {
      if (
        envelope.version !== 1
        || envelope.algorithm !== ALGORITHM
        || envelope.keyId !== this.#keyId
      ) {
        throw new Error("unsupported");
      }
      dataKey = decrypt(
        Buffer.from(envelope.wrappedDataKey, "base64"),
        this.#key,
        Buffer.from(envelope.wrappedDataKeyIv, "base64"),
        Buffer.from(envelope.wrappedDataKeyAuthTag, "base64"),
        additionalData("wrap", envelope.reference, envelope.keyId),
      );
      if (dataKey.byteLength !== 32) throw new Error("invalid data key");
      return decrypt(
        Buffer.from(envelope.ciphertext, "base64"),
        dataKey,
        Buffer.from(envelope.ciphertextIv, "base64"),
        Buffer.from(envelope.ciphertextAuthTag, "base64"),
        additionalData("content", envelope.reference, envelope.keyId),
      ).toString("utf8");
    } catch {
      throw new Error("Secret could not be decrypted");
    } finally {
      dataKey?.fill(0);
    }
  }

  #assertReference(reference: string): void {
    if (!SECRET_REFERENCE_PATTERN.test(reference)) {
      throw new Error("Invalid secret reference");
    }
  }
}

function additionalData(kind: "content" | "wrap", reference: string, keyId: string): Buffer {
  return Buffer.from(`mystra-secret:${kind}:v1:${reference}:${keyId}`, "utf8");
}

function encrypt(plaintext: Buffer, key: Buffer, aad: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

function decrypt(ciphertext: Buffer, key: Buffer, iv: Buffer, authTag: Buffer, aad: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
