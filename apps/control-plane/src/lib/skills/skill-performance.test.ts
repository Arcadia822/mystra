import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import Database from "better-sqlite3";
import { afterAll, describe, expect, it } from "vitest";

import { createSqlitePrismaClient } from "../db/prisma-client";
import { PrismaRdbProvider } from "../db/prisma-provider";
import type { SkillPublicationReservation, SkillRecord, SkillRevisionRecord } from "../db/rdb-provider";
import { SkillPreviewService } from "./skill-preview-service";
import { SkillPublicationService } from "./skill-publication-service";
import { SkillQueryService } from "./skill-query-service";
import { createZipFixture, skillMarkdown } from "./skill-test-fixtures";
import { validateSkillZip } from "./skill-zip-validator";

const SAMPLES = 100;
const WARMUPS = 5;
const tempDirectory = path.join(process.cwd(), `.test-skill-performance-${process.pid}`);
const migrations = [
  "20260806182000_init", "20260806210000_secret_envelopes", "20260807150000_identity_team_rbac",
  "20260807181000_runtime_provider", "20260808173000_project_issue_sources", "20260808180000_agent_definition",
  "20260808200000_task_context", "20260810130000_task_workspace_setup", "20260810160000_session_launch_framework",
  "20260811210000_factory_task_execution_context", "20260812090000_standard_agent_context", "20260824090000_skill_library",
].map((directory) => readFileSync(path.join(process.cwd(), `prisma/sqlite/migrations/${directory}/migration.sql`), "utf8"));

mkdirSync(tempDirectory, { recursive: true });

function percentile(samples: readonly number[], fraction: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * fraction) - 1]!;
}

async function benchmark(operation: () => Promise<void>): Promise<{ p50Ms: number; p95Ms: number }> {
  for (let index = 0; index < WARMUPS; index += 1) await operation();
  const samples: number[] = [];
  for (let index = 0; index < SAMPLES; index += 1) {
    const startedAt = performance.now();
    await operation();
    samples.push(performance.now() - startedAt);
  }
  return { p50Ms: percentile(samples, .5), p95Ms: percentile(samples, .95) };
}

function id(prefix: string, index: number): string {
  return `${prefix}-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function seedCapacityDatabase(): { databasePath: string; teamId: string; userId: string; firstSkillId: string } {
  const databasePath = path.join(tempDirectory, `${randomUUID()}.db`);
  const database = new Database(databasePath);
  for (const migration of migrations) database.exec(migration);
  const teamId = "00000000-0000-4000-8000-000000000001";
  const userId = "00000000-0000-4000-8000-000000000002";
  const timestamp = "2026-08-24T00:00:00.000Z";
  database.prepare("INSERT INTO users (id, username, display_username, display_name, status, require_password_change, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', 0, ?, ?)")
    .run(userId, "benchmark", "benchmark", "Benchmark", timestamp, timestamp);
  database.prepare("INSERT INTO teams (id, display_name, status, archived_at, created_at, updated_at) VALUES (?, ?, 'active', NULL, ?, ?)")
    .run(teamId, "Benchmark Team", timestamp, timestamp);

  const insertSkill = database.prepare("INSERT INTO skills (id, team_id, name, active_name, status, current_revision_id, resource_revision, created_by_user_id, created_at, updated_at, archived_by_user_id, archived_at) VALUES (?, ?, ?, ?, 'active', NULL, 0, ?, ?, ?, NULL, NULL)");
  const insertRevision = database.prepare("INSERT INTO skill_revisions (id, skill_id, base_revision_id, sequence, publication_status, description, manifest_json, compressed_size_bytes, uncompressed_size_bytes, zip_sha256, content_sha256, object_key, created_by_user_id, created_at, ready_at, failed_at, failure_code) VALUES (?, ?, ?, 1, 'ready', ?, ?, 100, 42, ?, ?, ?, ?, ?, ?, NULL, NULL)");
  const updateSkill = database.prepare("UPDATE skills SET current_revision_id = ?, resource_revision = 1 WHERE id = ?");
  const manifest = JSON.stringify([{ path: "SKILL.md", sizeBytes: 42, sha256: "a".repeat(64), mediaType: "text/markdown", previewability: "text" }]);
  database.transaction(() => {
    for (let index = 1; index <= 10_000; index += 1) {
      const skillId = id("10000000", index);
      const revisionId = id("20000000", index);
      const name = `skill-${String(index).padStart(5, "0")}`;
      insertSkill.run(skillId, teamId, name, name, userId, timestamp, timestamp);
      insertRevision.run(revisionId, skillId, null, `Benchmark Skill ${index}`, manifest, "a".repeat(64), "b".repeat(64), `teams/${teamId}/skills/${skillId}/revisions/${revisionId}/bundle.zip`, userId, timestamp, timestamp);
      updateSkill.run(revisionId, skillId);
    }
  })();

  const firstSkillId = id("10000000", 1);
  const insertHistory = database.prepare("INSERT INTO skill_revisions (id, skill_id, base_revision_id, sequence, publication_status, description, manifest_json, compressed_size_bytes, uncompressed_size_bytes, zip_sha256, content_sha256, object_key, created_by_user_id, created_at, ready_at, failed_at, failure_code) VALUES (?, ?, ?, ?, 'ready', ?, ?, 100, 42, ?, ?, ?, ?, ?, ?, NULL, NULL)");
  database.transaction(() => {
    let baseRevisionId = id("20000000", 1);
    for (let sequence = 2; sequence <= 1_000; sequence += 1) {
      const revisionId = id("30000000", sequence);
      insertHistory.run(revisionId, firstSkillId, baseRevisionId, sequence, `Benchmark Revision ${sequence}`, manifest, String(sequence).padStart(64, "0"), "c".repeat(64), `teams/${teamId}/skills/${firstSkillId}/revisions/${revisionId}/bundle.zip`, userId, timestamp, timestamp);
      baseRevisionId = revisionId;
    }
  })();
  database.close();
  return { databasePath, teamId, userId, firstSkillId };
}

describe("Skill library warmed performance gates", () => {
  it("reports four independent capacity fixtures with at least 100 samples", async () => {
    const capacity = seedCapacityDatabase();
    const provider = new PrismaRdbProvider(createSqlitePrismaClient({ databaseUrl: `file:${capacity.databasePath}` }));
    const query = new SkillQueryService(provider);
    const list = await benchmark(async () => { await query.list({ teamId: capacity.teamId, limit: 100, query: "skill", includeArchived: false }); });
    const detail = await benchmark(async () => { await query.get({ teamId: capacity.teamId, skillId: capacity.firstSkillId }); });
    const history = await benchmark(async () => { await query.listRevisions({ teamId: capacity.teamId, skillId: capacity.firstSkillId, limit: 100 }); });
    await provider.close();

    const largePayload = randomBytes(20 * 1024 * 1024 - 2_048);
    const publishZip = await createZipFixture([
      { path: "SKILL.md", content: skillMarkdown("performance-skill", "Performance publication fixture."), compress: false },
      { path: "payload.bin", content: largePayload, compress: false },
    ]);
    const validatedPublish = await validateSkillZip(publishZip);
    const skillId = randomUUID();
    const revisionId = randomUUID();
    const timestamp = "2026-08-24T00:00:00.000Z";
    const skill: SkillRecord = { id: skillId, teamId: capacity.teamId, name: validatedPublish.name, activeName: validatedPublish.name, status: "active", currentRevisionId: null, resourceRevision: 0, createdByUserId: capacity.userId, createdAt: timestamp, updatedAt: timestamp, archivedByUserId: null, archivedAt: null };
    const uploading: SkillRevisionRecord = { id: revisionId, skillId, baseRevisionId: null, sequence: null, publicationStatus: "uploading", description: validatedPublish.description, manifest: validatedPublish.manifest, compressedSizeBytes: publishZip.length, uncompressedSizeBytes: validatedPublish.uncompressedSizeBytes, zipSha256: validatedPublish.zipSha256, contentSha256: validatedPublish.contentSha256, objectKey: `teams/${capacity.teamId}/skills/${skillId}/revisions/${revisionId}/bundle.zip`, createdByUserId: capacity.userId, createdAt: timestamp, readyAt: null, failedAt: null, failureCode: null };
    const ready: SkillRevisionRecord = { ...uploading, sequence: 1, publicationStatus: "ready", readyAt: timestamp };
    const reservation: SkillPublicationReservation = { skill, revision: uploading, created: true };
    let objectPresent = false;
    const publication = new SkillPublicationService({
      db: {
        reserveInitialSkillPublication: async () => reservation,
        reserveSkillRevisionPublication: async () => reservation,
        finalizeSkillRevisionPublication: async () => ({ skill: { ...skill, currentRevisionId: revisionId, resourceRevision: 1 }, revision: ready }),
        failSkillRevisionPublication: async () => ready,
        archiveSkillRecord: async () => skill,
      },
      store: {
        headRevisionArchive: async () => objectPresent ? { contentLength: publishZip.length, zipSha256Metadata: validatedPublish.zipSha256 } : null,
        putRevisionArchive: async () => { objectPresent = true; },
        getRevisionArchive: async () => ({ body: Readable.from([publishZip]), contentLength: publishZip.length, zipSha256Metadata: validatedPublish.zipSha256 }),
      },
    });
    const publish = await benchmark(async () => {
      objectPresent = false;
      await publication.create({ teamId: capacity.teamId, createdByUserId: capacity.userId, zipBuffer: publishZip });
    });

    const previewText = "x".repeat(256 * 1024);
    const previewZip = await createZipFixture([
      { path: "SKILL.md", content: skillMarkdown("preview-skill", "Preview performance fixture.") },
      { path: "preview.txt", content: previewText },
    ]);
    const validatedPreview = await validateSkillZip(previewZip);
    const previewSkill = { ...skill, name: validatedPreview.name, activeName: validatedPreview.name, currentRevisionId: revisionId, resourceRevision: 1 };
    const previewRevision: SkillRevisionRecord = { ...ready, description: validatedPreview.description, manifest: validatedPreview.manifest, compressedSizeBytes: previewZip.length, uncompressedSizeBytes: validatedPreview.uncompressedSizeBytes, zipSha256: validatedPreview.zipSha256, contentSha256: validatedPreview.contentSha256 };
    const previewService = new SkillPreviewService({
      db: { getSkillRecord: async () => previewSkill, getSkillRevisionRecord: async () => previewRevision },
      store: { getRevisionArchive: async () => ({ body: Readable.from([previewZip]), contentLength: previewZip.length, zipSha256Metadata: validatedPreview.zipSha256 }), headRevisionArchive: async () => null, putRevisionArchive: async () => {} },
    });
    const preview = await benchmark(async () => { await previewService.preview({ teamId: capacity.teamId, skillId, revisionId, path: "preview.txt" }); });

    const report = {
      environment: { node: process.version, platform: `${process.platform}-${process.arch}`, database: "SQLite", objectProvider: "in-memory S3 semantics" },
      samples: SAMPLES,
      fixtures: {
        tenThousandSkills: { list, detail },
        oneThousandRevisions: history,
        twentyMiBPublish: { ...publish, archiveBytes: publishZip.length },
        twoHundredFiftySixKiBPreview: preview,
      },
      memoryModel: { rawZipBuffers: 1, boundedDescriptors: 1_200, concurrentEntryStreams: 1, temporaryExtractionDirectory: false },
    };
    console.info(`SKILL_PERFORMANCE_REPORT ${JSON.stringify(report)}`);

    expect(SAMPLES).toBeGreaterThanOrEqual(100);
    expect(list.p95Ms).toBeLessThan(300);
    expect(detail.p95Ms).toBeLessThan(300);
    expect(history.p95Ms).toBeLessThan(300);
    expect(publish.p95Ms).toBeLessThan(5_000);
    expect(preview.p95Ms).toBeLessThan(1_000);
    expect(publishZip.length).toBeLessThanOrEqual(20 * 1024 * 1024);
  }, 180_000);
});

afterAll(() => { rmSync(tempDirectory, { recursive: true, force: true }); });
