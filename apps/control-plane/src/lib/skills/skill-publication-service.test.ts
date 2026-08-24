import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type {
  RdbProvider,
  SkillPublicationReservation,
  SkillRecord,
  SkillRevisionRecord,
} from "../db/rdb-provider";
import { RdbError } from "../db/prisma-errors";
import { SkillContentStoreError, type SkillContentStore } from "./skill-content-store";
import { SkillFailure } from "./skill-errors";
import { SkillPublicationService } from "./skill-publication-service";
import { createZipFixture, skillMarkdown } from "./skill-test-fixtures";

const teamId = randomUUID();
const skillId = randomUUID();
const revisionId = randomUUID();
const userId = randomUUID();
const timestamp = "2026-08-24T00:00:00.000Z";

async function bundle(): Promise<Buffer> {
  return createZipFixture([{ path: "SKILL.md", content: skillMarkdown() }]);
}

function reservation(status: "uploading" | "ready" | "failed" = "uploading"): SkillPublicationReservation {
  const skill: SkillRecord = {
    id: skillId,
    teamId,
    name: "review-evidence",
    activeName: "review-evidence",
    status: "active",
    currentRevisionId: status === "ready" ? revisionId : null,
    resourceRevision: status === "ready" ? 1 : 0,
    createdByUserId: userId,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedByUserId: null,
    archivedAt: null,
  };
  const revision: SkillRevisionRecord = {
    id: revisionId,
    skillId,
    baseRevisionId: null,
    sequence: status === "ready" ? 1 : null,
    publicationStatus: status,
    description: "Review evidence exactly.",
    manifest: [{
      path: "SKILL.md",
      sizeBytes: 42,
      sha256: "a".repeat(64),
      mediaType: "text/markdown",
      previewability: "text",
    }],
    compressedSizeBytes: 100,
    uncompressedSizeBytes: 42,
    zipSha256: "b".repeat(64),
    contentSha256: "c".repeat(64),
    objectKey: `teams/${teamId}/skills/${skillId}/revisions/${revisionId}/bundle.zip`,
    createdByUserId: userId,
    createdAt: timestamp,
    readyAt: status === "ready" ? timestamp : null,
    failedAt: status === "failed" ? timestamp : null,
    failureCode: status === "failed" ? "integrity_conflict" : null,
  };
  return { skill, revision, created: status === "uploading" };
}

function dependencies(input: {
  state?: "uploading" | "ready" | "failed";
  head?: { contentLength: number; zipSha256Metadata?: string } | null;
  putError?: Error;
  finalizeError?: Error;
} = {}) {
  const reserved = reservation(input.state);
  const db = {
    reserveInitialSkillPublication: vi.fn().mockResolvedValue(reserved),
    reserveSkillRevisionPublication: vi.fn().mockResolvedValue(reserved),
    finalizeSkillRevisionPublication: input.finalizeError
      ? vi.fn().mockRejectedValue(input.finalizeError)
      : vi.fn().mockResolvedValue({
          skill: { ...reserved.skill, currentRevisionId: revisionId, resourceRevision: 1 },
          revision: { ...reserved.revision, publicationStatus: "ready", sequence: 1, readyAt: timestamp },
        }),
    failSkillRevisionPublication: vi.fn().mockResolvedValue({
      ...reserved.revision,
      publicationStatus: "failed",
      failedAt: timestamp,
      failureCode: "integrity_conflict",
    }),
    archiveSkillRecord: vi.fn().mockResolvedValue({
      ...reserved.skill,
      status: "archived",
      activeName: null,
      resourceRevision: 2,
      archivedByUserId: userId,
      archivedAt: timestamp,
    }),
  } satisfies Pick<
    RdbProvider,
    | "reserveInitialSkillPublication"
    | "reserveSkillRevisionPublication"
    | "finalizeSkillRevisionPublication"
    | "failSkillRevisionPublication"
    | "archiveSkillRecord"
  >;
  const headRevisionArchive = input.head !== undefined
    ? vi.fn().mockResolvedValue(input.head)
    : vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValue({
          contentLength: reserved.revision.compressedSizeBytes,
          zipSha256Metadata: reserved.revision.zipSha256,
        });
  const store = {
    headRevisionArchive,
    putRevisionArchive: input.putError
      ? vi.fn().mockRejectedValue(input.putError)
      : vi.fn().mockResolvedValue(undefined),
    getRevisionArchive: vi.fn(),
  } satisfies SkillContentStore;
  return { reserved, db, store, service: new SkillPublicationService({ db, store }) };
}

describe("Skill publication service", () => {
  it("validates, reserves, uploads, verifies and finalizes an initial publication", async () => {
    const context = dependencies();
    const zip = await bundle();

    await expect(context.service.create({ teamId, createdByUserId: userId, zipBuffer: zip }))
      .resolves.toMatchObject({ skill: { resourceRevision: 1 }, revision: { publicationStatus: "ready" } });

    expect(context.db.reserveInitialSkillPublication).toHaveBeenCalledWith(expect.objectContaining({
      teamId,
      name: "review-evidence",
      createdByUserId: userId,
      content: expect.objectContaining({ zipSha256: expect.stringMatching(/^[a-f0-9]{64}$/) }),
    }));
    expect(context.store.putRevisionArchive).toHaveBeenCalledOnce();
    expect(context.db.finalizeSkillRevisionPublication).toHaveBeenCalledWith({
      teamId,
      skillId,
      revisionId,
      expectedResourceRevision: 0,
    });
  });

  it("resumes from matching Head metadata and skips a second Put", async () => {
    const reserved = reservation();
    const context = dependencies({
      head: {
        contentLength: reserved.revision.compressedSizeBytes,
        zipSha256Metadata: reserved.revision.zipSha256,
      },
    });
    await context.service.create({ teamId, createdByUserId: userId, zipBuffer: await bundle() });
    expect(context.store.putRevisionArchive).not.toHaveBeenCalled();
    expect(context.db.finalizeSkillRevisionPublication).toHaveBeenCalledOnce();
  });

  it("leaves retryable storage failures uploading", async () => {
    const context = dependencies({
      putError: new SkillContentStoreError("skill_storage_unavailable", "temporary"),
    });
    await expect(context.service.create({ teamId, createdByUserId: userId, zipBuffer: await bundle() }))
      .rejects.toMatchObject({ code: "skill_storage_unavailable" });
    expect(context.db.failSkillRevisionPublication).not.toHaveBeenCalled();
  });

  it("marks terminal object mismatch and finalize concurrency loss failed", async () => {
    const mismatch = dependencies({ head: { contentLength: 999, zipSha256Metadata: "f".repeat(64) } });
    await expect(mismatch.service.create({ teamId, createdByUserId: userId, zipBuffer: await bundle() }))
      .rejects.toMatchObject({ code: "skill_storage_integrity_conflict" });
    expect(mismatch.db.failSkillRevisionPublication).toHaveBeenCalledOnce();

    const race = dependencies({ finalizeError: new RdbError("RDB_CONFLICT", "Skill resource revision changed") });
    await expect(race.service.create({ teamId, createdByUserId: userId, zipBuffer: await bundle() }))
      .rejects.toMatchObject({ code: "revision_conflict" });
    expect(race.db.failSkillRevisionPublication).toHaveBeenCalledOnce();
  });

  it("returns ready retries without storage and preserves terminal failed retries", async () => {
    const ready = dependencies({ state: "ready" });
    await expect(ready.service.create({ teamId, createdByUserId: userId, zipBuffer: await bundle() }))
      .resolves.toMatchObject({ revision: { publicationStatus: "ready" } });
    expect(ready.store.headRevisionArchive).not.toHaveBeenCalled();

    const failed = dependencies({ state: "failed" });
    await expect(failed.service.create({ teamId, createdByUserId: userId, zipBuffer: await bundle() }))
      .rejects.toBeInstanceOf(SkillFailure);
    expect(failed.store.headRevisionArchive).not.toHaveBeenCalled();
  });

  it("publishes updates with transient expected revision and archives idempotently through RDB state", async () => {
    const context = dependencies();
    await context.service.publishRevision({
      teamId,
      skillId,
      expectedResourceRevision: 1,
      createdByUserId: userId,
      zipBuffer: await bundle(),
    });
    expect(context.db.reserveSkillRevisionPublication).toHaveBeenCalledWith(expect.objectContaining({
      expectedResourceRevision: 1,
      name: "review-evidence",
    }));
    await context.service.archive({ teamId, skillId, expectedResourceRevision: 1, archivedByUserId: userId });
    expect(context.db.archiveSkillRecord).toHaveBeenCalledOnce();
  });
});
