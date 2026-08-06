import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { EncryptedFileSecretProvider } from "./encrypted-file-secret-provider";

const ref = "github-pat/00000000-0000-4000-8000-000000000041";

async function fixtureRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "mystra-secret-provider-"));
}

describe("EncryptedFileSecretProvider", () => {
  it("round-trips a secret without writing plaintext", async () => {
    const root = await fixtureRoot();
    const provider = new EncryptedFileSecretProvider({ root, key: Buffer.alloc(32, 1) });

    await provider.put(ref, "github_pat_super_secret");

    expect(await provider.get(ref)).toBe("github_pat_super_secret");
    const stored = await readFile(join(root, `${ref}.json`), "utf8");
    expect(stored).not.toContain("github_pat_super_secret");
    expect(JSON.parse(stored)).toMatchObject({ version: 1, algorithm: "aes-256-gcm" });
  });

  it("uses owner-only directory and file modes", async () => {
    const root = await fixtureRoot();
    const provider = new EncryptedFileSecretProvider({ root, key: Buffer.alloc(32, 2) });

    await provider.put(ref, "github_pat_permissions");

    expect((await stat(root)).mode & 0o777).toBe(0o700);
    expect((await stat(join(root, `${ref}.json`))).mode & 0o777).toBe(0o600);
    expect((await stat(join(root, "github-pat"))).mode & 0o777).toBe(0o700);
  });

  it("fails closed with the wrong key or a tampered auth tag", async () => {
    const root = await fixtureRoot();
    const provider = new EncryptedFileSecretProvider({ root, key: Buffer.alloc(32, 3) });
    await provider.put(ref, "github_pat_integrity");

    const wrongKey = new EncryptedFileSecretProvider({ root, key: Buffer.alloc(32, 4) });
    await expect(wrongKey.get(ref)).rejects.toThrow(/decrypt/i);
  });

  it("rejects path traversal and deletes only the addressed secret", async () => {
    const root = await fixtureRoot();
    const provider = new EncryptedFileSecretProvider({ root, key: Buffer.alloc(32, 5) });

    await expect(provider.put("../escape", "secret")).rejects.toThrow(/reference/i);
    await provider.put(ref, "github_pat_delete");
    await provider.delete(ref);
    await expect(provider.get(ref)).rejects.toThrow(/unavailable/i);
    await expect(provider.delete(ref)).resolves.toBeUndefined();
  });
});
