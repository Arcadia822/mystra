import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

import { SKILL_MAX_ARCHIVE_BYTES, skillFilePreviewResponseSchema, type SkillFilePreviewResponse } from "@mystra/shared";

import type { RdbProvider, SkillRecord, SkillRevisionRecord } from "../db/rdb-provider";
import type { SkillContentStore } from "./skill-content-store";
import { SkillFailure, asSkillFailure } from "./skill-errors";
import { readSkillZipLogicalFile } from "./skill-zip-validator";

type PreviewDb = Pick<RdbProvider, "getSkillRecord" | "getSkillRevisionRecord">;

export interface SkillDownload {
  skill: SkillRecord;
  revision: SkillRevisionRecord;
  body: Readable;
  contentLength: number;
}

export class SkillPreviewService {
  readonly #db: PreviewDb;
  readonly #store: SkillContentStore;

  constructor(input: { db: PreviewDb; store: SkillContentStore }) {
    this.#db = input.db;
    this.#store = input.store;
  }

  async preview(input: {
    teamId: string;
    skillId: string;
    revisionId: string;
    path: string;
  }): Promise<SkillFilePreviewResponse> {
    try {
      const { revision } = await this.#loadReadyRevision(input);
      const file = revision.manifest.find((entry) => entry.path === input.path);
      if (!file) throw new SkillFailure("skill_file_not_found", "Skill file not found");
      if (file.previewability !== "text") {
        throw new SkillFailure(
          "skill_file_not_previewable",
          "Skill file is not previewable",
          { file, reason: file.previewability },
        );
      }
      const archive = await this.#readVerifiedArchive(revision);
      const content = await readSkillZipLogicalFile(archive, file.path);
      if (
        content.length !== file.sizeBytes
        || createHash("sha256").update(content).digest("hex") !== file.sha256
      ) {
        throw new SkillFailure("skill_storage_integrity_error", "Skill file does not match its manifest");
      }
      let text: string;
      try {
        if (content.includes(0)) throw new Error("NUL");
        text = new TextDecoder("utf-8", { fatal: true }).decode(content);
      } catch {
        throw new SkillFailure("skill_storage_integrity_error", "Skill file text classification is invalid");
      }
      return skillFilePreviewResponseSchema.parse({
        revisionId: revision.id,
        sequence: revision.sequence,
        file,
        content: text,
        truncated: false,
      });
    } catch (error) {
      throw asSkillFailure(error);
    }
  }

  async download(input: {
    teamId: string;
    skillId: string;
    revisionId: string;
  }): Promise<SkillDownload> {
    try {
      const records = await this.#loadReadyRevision(input);
      const object = await this.#store.getRevisionArchive({ objectKey: records.revision.objectKey });
      assertObjectMetadata(records.revision, object);
      return { ...records, body: object.body, contentLength: object.contentLength };
    } catch (error) {
      throw asSkillFailure(error);
    }
  }

  async #loadReadyRevision(input: {
    teamId: string;
    skillId: string;
    revisionId: string;
  }): Promise<{ skill: SkillRecord; revision: SkillRevisionRecord }> {
    const skill = await this.#db.getSkillRecord(input.skillId, { teamId: input.teamId });
    if (!skill) throw new SkillFailure("skill_not_found", "Skill not found");
    const revision = await this.#db.getSkillRevisionRecord(input);
    if (!revision || revision.publicationStatus !== "ready" || revision.sequence === null) {
      throw new SkillFailure("skill_revision_not_found", "Skill Revision not found");
    }
    return { skill, revision };
  }

  async #readVerifiedArchive(revision: SkillRevisionRecord): Promise<Buffer> {
    const object = await this.#store.getRevisionArchive({ objectKey: revision.objectKey });
    assertObjectMetadata(revision, object);
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const rawChunk of object.body) {
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
      size += chunk.length;
      if (size > SKILL_MAX_ARCHIVE_BYTES || size > revision.compressedSizeBytes) {
        object.body.destroy();
        throw new SkillFailure("skill_storage_integrity_error", "Stored Skill archive exceeds its recorded size");
      }
      chunks.push(chunk);
    }
    const archive = Buffer.concat(chunks);
    if (
      archive.length !== revision.compressedSizeBytes
      || createHash("sha256").update(archive).digest("hex") !== revision.zipSha256
    ) {
      throw new SkillFailure("skill_storage_integrity_error", "Stored Skill archive does not match its Revision");
    }
    return archive;
  }
}

function assertObjectMetadata(
  revision: SkillRevisionRecord,
  object: { contentLength: number; zipSha256Metadata?: string },
): void {
  if (
    object.contentLength !== revision.compressedSizeBytes
    || object.zipSha256Metadata !== revision.zipSha256
  ) {
    throw new SkillFailure("skill_storage_integrity_error", "Stored Skill object metadata does not match its Revision");
  }
}
