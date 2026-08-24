import {
  skillDetailSchema,
  skillPageSchema,
  skillRevisionDetailSchema,
  skillRevisionPageSchema,
  skillRevisionSummarySchema,
  skillSummarySchema,
  type SkillDetail,
  type SkillPage,
  type SkillRevisionDetail,
  type SkillRevisionPage,
  type SkillRevisionSummary,
  type SkillSummary,
} from "@mystra/shared";

import type { RdbProvider, SkillRecord, SkillRevisionRecord } from "../db/rdb-provider";
import { SkillFailure, asSkillFailure } from "./skill-errors";

type QueryDb = Pick<
  RdbProvider,
  "getSkillRecord" | "getSkillRevisionRecord" | "listSkillRecords" | "listSkillRevisionRecords"
>;

function revisionSummary(record: SkillRevisionRecord): SkillRevisionSummary {
  if (record.publicationStatus !== "ready" || record.sequence === null || record.readyAt === null) {
    throw new SkillFailure("skill_revision_not_found", "Skill Revision not found");
  }
  return skillRevisionSummarySchema.parse({
    id: record.id,
    skillId: record.skillId,
    baseRevisionId: record.baseRevisionId,
    sequence: record.sequence,
    publicationStatus: "ready",
    description: record.description,
    compressedSizeBytes: record.compressedSizeBytes,
    uncompressedSizeBytes: record.uncompressedSizeBytes,
    zipSha256: record.zipSha256,
    contentSha256: record.contentSha256,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    readyAt: record.readyAt,
  });
}

function revisionDetail(record: SkillRevisionRecord): SkillRevisionDetail {
  return skillRevisionDetailSchema.parse({
    ...revisionSummary(record),
    manifest: record.manifest,
  });
}

function skillFields(skill: SkillRecord, revision: SkillRevisionRecord) {
  if (skill.currentRevisionId === null || skill.resourceRevision < 1) {
    throw new SkillFailure("skill_not_found", "Skill not found");
  }
  return {
    id: skill.id,
    teamId: skill.teamId,
    name: skill.name,
    description: revision.description,
    status: skill.status,
    currentRevisionId: skill.currentRevisionId,
    resourceRevision: skill.resourceRevision,
    createdByUserId: skill.createdByUserId,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
    archivedByUserId: skill.archivedByUserId,
    archivedAt: skill.archivedAt,
  };
}

export class SkillQueryService {
  readonly #db: QueryDb;

  constructor(db: QueryDb) {
    this.#db = db;
  }

  async list(input: {
    teamId: string;
    cursor?: string | null;
    limit: number;
    query?: string | null;
    includeArchived?: boolean;
  }): Promise<SkillPage> {
    try {
      const page = await this.#db.listSkillRecords({
        teamId: input.teamId,
        limit: input.limit,
        ...(input.cursor ? { cursor: input.cursor } : {}),
        ...(input.query ? { query: input.query } : {}),
        ...(input.includeArchived === undefined ? {} : { includeArchived: input.includeArchived }),
      });
      const items = await Promise.all(page.items.map(async (skill): Promise<SkillSummary> => {
        const current = await this.#currentRevision(input.teamId, skill);
        return skillSummarySchema.parse({ ...skillFields(skill, current), currentRevision: revisionSummary(current) });
      }));
      return skillPageSchema.parse({ items, nextCursor: page.nextCursor });
    } catch (error) {
      throw asSkillFailure(error);
    }
  }

  async get(input: { teamId: string; skillId: string }): Promise<SkillDetail> {
    try {
      const skill = await this.#db.getSkillRecord(input.skillId, { teamId: input.teamId });
      if (!skill) throw new SkillFailure("skill_not_found", "Skill not found");
      const current = await this.#currentRevision(input.teamId, skill);
      return skillDetailSchema.parse({ ...skillFields(skill, current), currentRevision: revisionDetail(current) });
    } catch (error) {
      throw asSkillFailure(error);
    }
  }

  async listRevisions(input: {
    teamId: string;
    skillId: string;
    cursor?: string | null;
    limit: number;
  }): Promise<SkillRevisionPage> {
    try {
      const page = await this.#db.listSkillRevisionRecords({
        teamId: input.teamId,
        skillId: input.skillId,
        limit: input.limit,
        ...(input.cursor ? { cursor: input.cursor } : {}),
      });
      return skillRevisionPageSchema.parse({
        items: page.items.map(revisionSummary),
        nextCursor: page.nextCursor,
      });
    } catch (error) {
      throw asSkillFailure(error);
    }
  }

  async getRevision(input: {
    teamId: string;
    skillId: string;
    revisionId: string;
  }): Promise<SkillRevisionDetail> {
    try {
      const record = await this.#db.getSkillRevisionRecord(input);
      if (!record || record.publicationStatus !== "ready") {
        throw new SkillFailure("skill_revision_not_found", "Skill Revision not found");
      }
      return revisionDetail(record);
    } catch (error) {
      throw asSkillFailure(error);
    }
  }

  async #currentRevision(teamId: string, skill: SkillRecord): Promise<SkillRevisionRecord> {
    if (skill.currentRevisionId === null) throw new SkillFailure("skill_not_found", "Skill not found");
    const revision = await this.#db.getSkillRevisionRecord({
      teamId,
      skillId: skill.id,
      revisionId: skill.currentRevisionId,
    });
    if (!revision || revision.publicationStatus !== "ready") {
      throw new SkillFailure("publication_failed", "Skill current Revision is unavailable");
    }
    return revision;
  }
}
