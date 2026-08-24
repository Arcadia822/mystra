import { describe, expect, it } from "vitest";

import {
  SKILL_LIST_DEFAULT_LIMIT,
  SKILL_LIST_MAX_LIMIT,
  SKILL_PREVIEW_MAX_BYTES,
  skillDetailSchema,
  skillFilePreviewResponseSchema,
  skillListQuerySchema,
  skillManifestEntrySchema,
  skillPageSchema,
  skillRevisionDetailSchema,
} from "./skill.js";

const teamId = "00000000-0000-4000-8000-000000000001";
const skillId = "00000000-0000-4000-8000-000000000002";
const revisionId = "00000000-0000-4000-8000-000000000003";
const createdByUserId = "00000000-0000-4000-8000-000000000004";
const timestamp = "2026-08-24T00:00:00.000Z";
const sha256 = "a".repeat(64);

const manifestEntry = {
  path: "SKILL.md",
  sizeBytes: 42,
  sha256,
  mediaType: "text/markdown",
  previewability: "text" as const,
};

const revision = {
  id: revisionId,
  skillId,
  baseRevisionId: null,
  sequence: 1,
  publicationStatus: "ready" as const,
  description: "A review skill",
  manifest: [manifestEntry],
  compressedSizeBytes: 100,
  uncompressedSizeBytes: 42,
  zipSha256: sha256,
  contentSha256: "b".repeat(64),
  createdByUserId,
  createdAt: timestamp,
  readyAt: timestamp,
};

describe("Skill contracts", () => {
  it("accepts a bounded, ordered manifest and rejects storage-private fields", () => {
    expect(skillManifestEntrySchema.parse(manifestEntry)).toEqual(manifestEntry);
    expect(skillRevisionDetailSchema.parse(revision).manifest).toEqual([manifestEntry]);
    expect(() => skillRevisionDetailSchema.parse({ ...revision, objectKey: "private/key.zip" })).toThrow();
    expect(() => skillRevisionDetailSchema.parse({ ...revision, failureCode: "secret" })).toThrow();
    expect(() => skillRevisionDetailSchema.parse({
      ...revision,
      manifest: [{ ...manifestEntry, path: "../SKILL.md" }],
    })).toThrow();
  });

  it("keeps public Skills visible only at positive resource revisions", () => {
    const skill = {
      id: skillId,
      teamId,
      name: "review-evidence",
      description: "A review skill",
      status: "active" as const,
      currentRevisionId: revisionId,
      resourceRevision: 1,
      createdByUserId,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedByUserId: null,
      archivedAt: null,
      currentRevision: revision,
    };

    expect(skillDetailSchema.parse(skill).resourceRevision).toBe(1);
    expect(() => skillDetailSchema.parse({ ...skill, resourceRevision: 0 })).toThrow();
    expect(() => skillDetailSchema.parse({ ...skill, activeName: "review-evidence" })).toThrow();
  });

  it("parses bounded list queries and opaque cursors", () => {
    expect(skillListQuerySchema.parse({})).toEqual({
      cursor: null,
      limit: SKILL_LIST_DEFAULT_LIMIT,
      query: null,
      includeArchived: false,
    });
    expect(skillListQuerySchema.parse({ limit: String(SKILL_LIST_MAX_LIMIT), includeArchived: "true" }))
      .toMatchObject({ limit: SKILL_LIST_MAX_LIMIT, includeArchived: true });
    expect(() => skillListQuerySchema.parse({ limit: SKILL_LIST_MAX_LIMIT + 1 })).toThrow();
    expect(skillPageSchema.parse({ items: [], nextCursor: null })).toEqual({ items: [], nextCursor: null });
  });

  it("allows only exact safe text preview responses", () => {
    expect(SKILL_PREVIEW_MAX_BYTES).toBe(256 * 1024);
    expect(skillFilePreviewResponseSchema.parse({
      revisionId,
      sequence: 1,
      file: manifestEntry,
      content: "---\nname: review-evidence\n---",
      truncated: false,
    }).truncated).toBe(false);
    expect(() => skillFilePreviewResponseSchema.parse({
      revisionId,
      sequence: 1,
      file: { ...manifestEntry, previewability: "binary" },
      content: "not allowed",
      truncated: false,
    })).toThrow();
  });
});
