import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { RdbProvider, SkillRecord, SkillRevisionRecord } from "../db/rdb-provider";
import { SkillQueryService } from "./skill-query-service";

const teamId = randomUUID();
const skillId = randomUUID();
const revisionId = randomUUID();
const userId = randomUUID();
const timestamp = "2026-08-24T00:00:00.000Z";

const revision: SkillRevisionRecord = {
  id: revisionId,
  skillId,
  baseRevisionId: null,
  sequence: 1,
  publicationStatus: "ready",
  description: "Review evidence",
  manifest: [{ path: "SKILL.md", sizeBytes: 42, sha256: "a".repeat(64), mediaType: "text/markdown", previewability: "text" }],
  compressedSizeBytes: 100,
  uncompressedSizeBytes: 42,
  zipSha256: "b".repeat(64),
  contentSha256: "c".repeat(64),
  objectKey: "private/key.zip",
  createdByUserId: userId,
  createdAt: timestamp,
  readyAt: timestamp,
  failedAt: null,
  failureCode: null,
};

const skill: SkillRecord = {
  id: skillId,
  teamId,
  name: "review-evidence",
  activeName: "review-evidence",
  status: "active",
  currentRevisionId: revisionId,
  resourceRevision: 1,
  createdByUserId: userId,
  createdAt: timestamp,
  updatedAt: timestamp,
  archivedByUserId: null,
  archivedAt: null,
};

function service(overrides: Partial<Pick<RdbProvider,
  "getSkillRecord" | "getSkillRevisionRecord" | "listSkillRecords" | "listSkillRevisionRecords"
>> = {}) {
  const db = {
    getSkillRecord: vi.fn().mockResolvedValue(skill),
    getSkillRevisionRecord: vi.fn().mockResolvedValue(revision),
    listSkillRecords: vi.fn().mockResolvedValue({ items: [skill], nextCursor: null }),
    listSkillRevisionRecords: vi.fn().mockResolvedValue({ items: [revision], nextCursor: null }),
    ...overrides,
  };
  return { db, query: new SkillQueryService(db) };
}

describe("Skill query service", () => {
  it("maps private records to strict public list/detail/history contracts", async () => {
    const context = service();
    const page = await context.query.list({ teamId, limit: 50, includeArchived: false });
    expect(page.items[0]).toMatchObject({ name: "review-evidence", description: "Review evidence" });
    expect(page.items[0]).not.toHaveProperty("activeName");
    expect(page.items[0]?.currentRevision).not.toHaveProperty("objectKey");

    const detail = await context.query.get({ teamId, skillId });
    expect(detail.currentRevision.manifest).toHaveLength(1);
    expect(detail.currentRevision).not.toHaveProperty("failureCode");

    const history = await context.query.listRevisions({ teamId, skillId, limit: 50 });
    expect(history.items).toHaveLength(1);
    expect(history.items[0]).not.toHaveProperty("manifest");
  });

  it("fails closed for missing/cross-Team Skills and non-ready revisions", async () => {
    await expect(service({ getSkillRecord: vi.fn().mockResolvedValue(undefined) }).query.get({ teamId, skillId }))
      .rejects.toMatchObject({ code: "skill_not_found" });
    await expect(service({
      getSkillRevisionRecord: vi.fn().mockResolvedValue({ ...revision, publicationStatus: "uploading", sequence: null, readyAt: null }),
    }).query.getRevision({ teamId, skillId, revisionId }))
      .rejects.toMatchObject({ code: "skill_revision_not_found" });
  });
});
