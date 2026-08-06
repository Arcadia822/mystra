import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { SecretProvider } from "./secret-provider";

interface EncryptedFileSecretProviderOptions {
  root: string;
  key: Uint8Array;
}

interface SecretEnvelope {
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
}

const SECRET_REFERENCE_PATTERN = /^github-pat\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class EncryptedFileSecretProvider implements SecretProvider {
  readonly #root: string;
  readonly #key: Buffer;

  constructor(options: EncryptedFileSecretProviderOptions) {
    if (options.key.byteLength !== 32) {
      throw new Error("Secret store key must contain exactly 32 bytes");
    }
    this.#root = options.root;
    this.#key = Buffer.from(options.key);
  }

  async put(reference: string, plaintext: string): Promise<void> {
    const target = this.#pathFor(reference);
    const targetDirectory = dirname(target);
    await mkdir(this.#root, { recursive: true, mode: 0o700 });
    await chmod(this.#root, 0o700);
    await mkdir(targetDirectory, { recursive: true, mode: 0o700 });
    await chmod(targetDirectory, 0o700);

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.#key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const envelope: SecretEnvelope = {
      version: 1,
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
    const temporary = join(targetDirectory, `.${randomUUID()}.tmp`);

    try {
      await writeFile(temporary, `${JSON.stringify(envelope)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await chmod(temporary, 0o600);
      await rename(temporary, target);
      await chmod(target, 0o600);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  async get(reference: string): Promise<string> {
    const target = this.#pathFor(reference);
    let raw: string;
    try {
      raw = await readFile(target, "utf8");
    } catch {
      throw new Error("Secret is unavailable");
    }

    try {
      const envelope = this.#parseEnvelope(raw);
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.#key,
        Buffer.from(envelope.iv, "base64"),
      );
      decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new Error("Secret could not be decrypted");
    }
  }

  async delete(reference: string): Promise<void> {
    const target = this.#pathFor(reference);
    await unlink(target).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
    });
  }

  #pathFor(reference: string): string {
    if (!SECRET_REFERENCE_PATTERN.test(reference)) {
      throw new Error("Invalid secret reference");
    }
    return join(this.#root, `${reference}.json`);
  }

  #parseEnvelope(raw: string): SecretEnvelope {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== "object"
      || value === null
      || (value as Partial<SecretEnvelope>).version !== 1
      || (value as Partial<SecretEnvelope>).algorithm !== "aes-256-gcm"
      || typeof (value as Partial<SecretEnvelope>).iv !== "string"
      || typeof (value as Partial<SecretEnvelope>).authTag !== "string"
      || typeof (value as Partial<SecretEnvelope>).ciphertext !== "string"
    ) {
      throw new Error("Invalid secret envelope");
    }
    return value as SecretEnvelope;
  }
}
