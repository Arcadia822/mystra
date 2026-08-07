import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

import type { AuthAccountRecord } from "../db/rdb-provider";

const keyLength = 64;

export const scryptParameters = {
  version: "v1",
  N: 32768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
  serialized: "N=32768,r=8,p=1,maxmem=67108864",
} as const;

export type PasswordCredential = Pick<
  AuthAccountRecord,
  "passwordHash" | "passwordSalt" | "passwordParams"
>;

export async function hashPassword(password: string): Promise<PasswordCredential> {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(password, salt);
  return {
    passwordHash: `scrypt$${scryptParameters.version}$${derivedKey.toString("base64")}`,
    passwordSalt: salt.toString("base64"),
    passwordParams: scryptParameters.serialized,
  };
}

export async function verifyPassword(
  password: string,
  credential: PasswordCredential,
): Promise<boolean> {
  if (credential.passwordParams !== scryptParameters.serialized) return false;
  const expected = parseHash(credential.passwordHash);
  const salt = decodeSalt(credential.passwordSalt);
  if (!expected || !salt) return false;

  const derivedKey = await deriveKey(password, salt);
  return derivedKey.length === expected.length && timingSafeEqual(derivedKey, expected);
}

async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, {
      N: scryptParameters.N,
      r: scryptParameters.r,
      p: scryptParameters.p,
      maxmem: scryptParameters.maxmem,
    }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function parseHash(value: string): Buffer | undefined {
  const match = /^scrypt\$v1\$([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return undefined;
  const hash = Buffer.from(match[1]!, "base64");
  return hash.length === keyLength ? hash : undefined;
}

function decodeSalt(value: string): Buffer | undefined {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return undefined;
  const salt = Buffer.from(value, "base64");
  return salt.length === 16 ? salt : undefined;
}
