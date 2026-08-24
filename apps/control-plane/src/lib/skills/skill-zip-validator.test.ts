import { describe, expect, it } from "vitest";

import { createZipFixture, mutateZipEntryHeaders, replaceZipPath, skillMarkdown } from "./skill-test-fixtures";
import { SkillZipValidationError, validateSkillZip } from "./skill-zip-validator";

async function expectInvalid(buffer: Buffer, code: string): Promise<void> {
  await expect(validateSkillZip(buffer)).rejects.toMatchObject({ code });
}

describe("Skill ZIP validator", () => {
  it("validates a root package and projects only name and description", async () => {
    const zip = await createZipFixture([
      { path: "SKILL.md", content: skillMarkdown() },
      { path: "scripts/check.ts", content: "export const ok = true;\n" },
      { path: "assets/logo.bin", content: Buffer.from([0, 1, 2, 3]) },
    ]);

    const result = await validateSkillZip(zip);

    expect(result.name).toBe("review-evidence");
    expect(result.description).toBe("Review evidence exactly.");
    expect(result.zipSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.manifest.map((entry) => entry.path)).toEqual([
      "SKILL.md",
      "assets/logo.bin",
      "scripts/check.ts",
    ]);
    expect(result.manifest.find((entry) => entry.path === "assets/logo.bin")?.previewability).toBe("binary");
    expect(result).not.toHaveProperty("unknown");
  });

  it("strips exactly one common wrapper directory and ignores packaging noise", async () => {
    const zip = await createZipFixture([
      { path: "bundle/SKILL.md", content: skillMarkdown() },
      { path: "bundle/readme.txt", content: "hello" },
      { path: "__MACOSX/._SKILL.md", content: "noise" },
      { path: "bundle/.DS_Store", content: "noise" },
    ]);

    const result = await validateSkillZip(zip);
    expect(result.manifest.map((entry) => entry.path)).toEqual(["SKILL.md", "readme.txt"]);
  });

  it("produces the same canonical digest for different ZIP entry orders", async () => {
    const first = await createZipFixture([
      { path: "SKILL.md", content: skillMarkdown(), compress: true },
      { path: "a.txt", content: "a", compress: false },
      { path: "z.txt", content: "z", compress: true },
    ]);
    const second = await createZipFixture([
      { path: "z.txt", content: "z", compress: false },
      { path: "a.txt", content: "a", compress: true },
      { path: "SKILL.md", content: skillMarkdown(), compress: false },
    ]);

    const [left, right] = await Promise.all([validateSkillZip(first), validateSkillZip(second)]);
    expect(left.zipSha256).not.toBe(right.zipSha256);
    expect(left.contentSha256).toBe(right.contentSha256);
  });

  it("rejects non-ZIP, missing SKILL.md, traversal and normalized collisions", async () => {
    await expectInvalid(Buffer.from("not a zip"), "invalid_zip");
    await expectInvalid(await createZipFixture([{ path: "readme.txt", content: "none" }]), "missing_skill_md");

    const safe = await createZipFixture([
      { path: "SKILL.md", content: skillMarkdown() },
      { path: "safe.txt", content: "unsafe" },
    ]);
    await expectInvalid(replaceZipPath(safe, "safe.txt", "../x.txt"), "unsafe_path");

    await expectInvalid(await createZipFixture([
      { path: "SKILL.md", content: skillMarkdown() },
      { path: "a.txt", content: "a" },
      { path: "A.txt", content: "A" },
    ]), "path_collision");
  });

  it("rejects invalid frontmatter and never treats HTML as previewable text", async () => {
    await expectInvalid(await createZipFixture([
      { path: "SKILL.md", content: "# no frontmatter" },
    ]), "invalid_skill_md");

    const result = await validateSkillZip(await createZipFixture([
      { path: "SKILL.md", content: skillMarkdown() },
      { path: "page.html", content: "<script>alert(1)</script>" },
    ]));
    expect(result.manifest.find((entry) => entry.path === "page.html")?.previewability).toBe("unsupported");
  });

  it("rejects absolute, backslash and Unicode-normalized path collisions", async () => {
    const safe = await createZipFixture([
      { path: "SKILL.md", content: skillMarkdown() },
      { path: "safe.txt", content: "unsafe" },
    ]);
    await expectInvalid(replaceZipPath(safe, "safe.txt", "/afe.txt"), "unsafe_path");
    await expectInvalid(replaceZipPath(safe, "safe.txt", "safe\\txt"), "unsafe_path");
    await expectInvalid(await createZipFixture([
      { path: "SKILL.md", content: skillMarkdown() },
      { path: "caf\u00e9.txt", content: "one" },
      { path: "cafe\u0301.txt", content: "two" },
    ]), "path_collision");
  });

  it("rejects encrypted entries, symlinks and unsupported compression methods before publication", async () => {
    const encryptedBase = await createZipFixture([{ path: "SKILL.md", content: skillMarkdown() }]);
    const encrypted = mutateZipEntryHeaders(encryptedBase, "SKILL.md", ({ kind, offset }, zip) => {
      const flagOffset = offset + (kind === "local" ? 6 : 8);
      zip.writeUInt16LE(zip.readUInt16LE(flagOffset) | 1, flagOffset);
    });
    await expectInvalid(encrypted, "encrypted_entry");

    const symlinkBase = await createZipFixture([
      { path: "SKILL.md", content: skillMarkdown() },
      { path: "link.txt", content: "target" },
    ]);
    const symlink = mutateZipEntryHeaders(symlinkBase, "link.txt", ({ kind, offset }, zip) => {
      if (kind === "central") zip.writeUInt32LE((0xa1ff << 16) >>> 0, offset + 38);
    });
    await expectInvalid(symlink, "unsupported_file_type");

    const methodBase = await createZipFixture([{ path: "SKILL.md", content: skillMarkdown(), compress: false }]);
    const unsupported = mutateZipEntryHeaders(methodBase, "SKILL.md", ({ kind, offset }, zip) => {
      zip.writeUInt16LE(99, offset + (kind === "local" ? 8 : 10));
    });
    await expectInvalid(unsupported, "unsupported_zip_feature");
  });

  it("rejects CRC corruption and declared expansion bombs", async () => {
    const crcBase = await createZipFixture([
      { path: "SKILL.md", content: skillMarkdown(), compress: false },
      { path: "plain.txt", content: "integrity", compress: false },
    ]);
    const crcCorrupt = mutateZipEntryHeaders(crcBase, "plain.txt", ({ kind, offset }, zip) => {
      const crcOffset = offset + (kind === "local" ? 14 : 16);
      zip.writeUInt32LE((zip.readUInt32LE(crcOffset) ^ 0xffffffff) >>> 0, crcOffset);
    });
    await expectInvalid(crcCorrupt, "crc_or_size_mismatch");

    const highlyCompressible = Buffer.alloc(18 * 1024 * 1024, 0x78);
    const bombFiles = [
      { path: "SKILL.md", content: skillMarkdown(), compress: false },
      ...Array.from({ length: 6 }, (_, index) => ({ path: `bomb-${index}.txt`, content: highlyCompressible, compress: true })),
    ];
    const bomb = await createZipFixture(bombFiles);
    await expectInvalid(bomb, "expanded_size_too_large");
  });

  it("bounds total descriptors and logical regular files independently", async () => {
    const noiseFlood = await createZipFixture([
      { path: "SKILL.md", content: skillMarkdown() },
      ...Array.from({ length: 1_200 }, (_, index) => ({ path: `__MACOSX/noise-${index}.txt`, content: "" })),
    ]);
    await expectInvalid(noiseFlood, "too_many_entries");

    const fileFlood = await createZipFixture([
      { path: "SKILL.md", content: skillMarkdown() },
      ...Array.from({ length: 1_000 }, (_, index) => ({ path: `files/${String(index).padStart(4, "0")}.txt`, content: "" })),
    ]);
    await expectInvalid(fileFlood, "too_many_files");

    const boundary = await validateSkillZip(await createZipFixture([
      { path: "SKILL.md", content: skillMarkdown() },
      ...Array.from({ length: 999 }, (_, index) => ({ path: `files/${String(index).padStart(4, "0")}.txt`, content: "" })),
    ]));
    expect(boundary.manifest).toHaveLength(1_000);
  });

  it("classifies invalid UTF-8, NUL text and oversized preview candidates without rendering them", async () => {
    const result = await validateSkillZip(await createZipFixture([
      { path: "SKILL.md", content: skillMarkdown() },
      { path: "invalid.txt", content: Buffer.from([0xc3, 0x28]) },
      { path: "nul.txt", content: Buffer.from("a\0b") },
      { path: "large.md", content: "x".repeat(256 * 1024 + 1) },
    ]));
    expect(result.manifest.find(({ path }) => path === "invalid.txt")?.previewability).toBe("invalid_utf8");
    expect(result.manifest.find(({ path }) => path === "nul.txt")?.previewability).toBe("binary");
    expect(result.manifest.find(({ path }) => path === "large.md")?.previewability).toBe("too_large");

    await expectInvalid(await createZipFixture([
      { path: "SKILL.md", content: Buffer.concat([Buffer.from(skillMarkdown()), Buffer.alloc(1024 * 1024, 0x20)]) },
    ]), "file_too_large");
  });

  it("uses stable typed validation failures", () => {
    const error = new SkillZipValidationError("invalid_zip", "Invalid ZIP");
    expect(error).toMatchObject({ name: "SkillZipValidationError", code: "invalid_zip" });
  });
});
