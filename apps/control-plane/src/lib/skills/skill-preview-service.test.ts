import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import type { SkillRecord, SkillRevisionRecord } from "../db/rdb-provider";
import { SkillPreviewService } from "./skill-preview-service";
import { createZipFixture, skillMarkdown } from "./skill-test-fixtures";
import { validateSkillZip } from "./skill-zip-validator";

const teamId = randomUUID();
const skillId = randomUUID();
const revisionId = randomUUID();
const userId = randomUUID();
const timestamp = "2026-08-24T00:00:00.000Z";

async function context() {
  const zip = await createZipFixture([
    { path: "bundle/SKILL.md", content: skillMarkdown() },
    { path: "bundle/readme.txt", content: "fixed revision text" },
    { path: "bundle/image.bin", content: Buffer.from([0, 1, 2]) },
  ]);
  const validated = await validateSkillZip(zip);
  const skill: SkillRecord = {
    id: skillId, teamId, name: validated.name, activeName: validated.name, status: "active",
    currentRevisionId: revisionId, resourceRevision: 1, createdByUserId: userId,
    createdAt: timestamp, updatedAt: timestamp, archivedByUserId: null, archivedAt: null,
  };
  const revision: SkillRevisionRecord = {
    id: revisionId, skillId, baseRevisionId: null, sequence: 1, publicationStatus: "ready",
    description: validated.description, manifest: validated.manifest,
    compressedSizeBytes: zip.length, uncompressedSizeBytes: validated.uncompressedSizeBytes,
    zipSha256: createHash("sha256").update(zip).digest("hex"), contentSha256: validated.contentSha256,
    objectKey: "private/key.zip", createdByUserId: userId, createdAt: timestamp, readyAt: timestamp,
    failedAt: null, failureCode: null,
  };
  const db = {
    getSkillRecord: vi.fn().mockResolvedValue(skill),
    getSkillRevisionRecord: vi.fn().mockResolvedValue(revision),
  };
  const store = {
    getRevisionArchive: vi.fn().mockImplementation(async () => ({
      body: Readable.from([zip]),
      contentLength: zip.length,
      zipSha256Metadata: revision.zipSha256,
    })),
    headRevisionArchive: vi.fn(),
    putRevisionArchive: vi.fn(),
  };
  return { zip, revision, store, service: new SkillPreviewService({ db, store }) };
}

describe("Skill preview service", () => {
  it("reads the exact logical wrapper-stripped file and verifies its digest", async () => {
    const fixture = await context();
    await expect(fixture.service.preview({ teamId, skillId, revisionId, path: "readme.txt" }))
      .resolves.toMatchObject({ content: "fixed revision text", truncated: false, sequence: 1 });
  });

  it("returns metadata-only reasons for binary and missing files", async () => {
    const fixture = await context();
    await expect(fixture.service.preview({ teamId, skillId, revisionId, path: "image.bin" }))
      .rejects.toMatchObject({ code: "skill_file_not_previewable", details: { reason: "binary" } });
    await expect(fixture.service.preview({ teamId, skillId, revisionId, path: "missing.txt" }))
      .rejects.toMatchObject({ code: "skill_file_not_found" });
  });

  it("streams downloads only after RDB and object metadata verification", async () => {
    const fixture = await context();
    const download = await fixture.service.download({ teamId, skillId, revisionId });
    expect(download).toMatchObject({ skill: { id: skillId }, revision: { id: revisionId }, contentLength: fixture.zip.length });
    expect(download.body).toBeInstanceOf(Readable);

    fixture.store.getRevisionArchive.mockResolvedValueOnce({
      body: Readable.from([fixture.zip]),
      contentLength: fixture.zip.length + 1,
      zipSha256Metadata: fixture.revision.zipSha256,
    });
    await expect(fixture.service.download({ teamId, skillId, revisionId }))
      .rejects.toMatchObject({ code: "skill_storage_integrity_error" });
  });
});
