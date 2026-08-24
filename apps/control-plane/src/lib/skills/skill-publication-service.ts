import type {
  RdbProvider,
  SkillPublicationReservation,
  SkillRecord,
  SkillRevisionRecord,
} from "../db/rdb-provider";
import { RdbError } from "../db/prisma-errors";
import {
  SkillContentStoreError,
  type HeadRevisionArchiveResult,
  type SkillContentStore,
} from "./skill-content-store";
import { SkillFailure, asSkillFailure } from "./skill-errors";
import { validateSkillZip, type ValidatedSkillZip } from "./skill-zip-validator";

type PublicationDb = Pick<
  RdbProvider,
  | "reserveInitialSkillPublication"
  | "reserveSkillRevisionPublication"
  | "finalizeSkillRevisionPublication"
  | "failSkillRevisionPublication"
  | "archiveSkillRecord"
>;

export interface PublishedSkillRevision {
  skill: SkillRecord;
  revision: SkillRevisionRecord;
}

export class SkillPublicationService {
  readonly #db: PublicationDb;
  readonly #store: SkillContentStore;

  constructor(input: { db: PublicationDb; store: SkillContentStore }) {
    this.#db = input.db;
    this.#store = input.store;
  }

  async create(input: {
    teamId: string;
    createdByUserId: string;
    zipBuffer: Buffer;
  }): Promise<PublishedSkillRevision> {
    try {
      const validated = await validateSkillZip(input.zipBuffer);
      const reservation = await this.#db.reserveInitialSkillPublication({
        teamId: input.teamId,
        name: validated.name,
        createdByUserId: input.createdByUserId,
        content: publicationContent(validated),
      });
      return await this.#completePublication(reservation, input.zipBuffer, 0);
    } catch (error) {
      throw asSkillFailure(error);
    }
  }

  async publishRevision(input: {
    teamId: string;
    skillId: string;
    expectedResourceRevision: number;
    createdByUserId: string;
    zipBuffer: Buffer;
  }): Promise<PublishedSkillRevision> {
    try {
      const validated = await validateSkillZip(input.zipBuffer);
      const reservation = await this.#db.reserveSkillRevisionPublication({
        teamId: input.teamId,
        skillId: input.skillId,
        expectedResourceRevision: input.expectedResourceRevision,
        name: validated.name,
        createdByUserId: input.createdByUserId,
        content: publicationContent(validated),
      });
      return await this.#completePublication(
        reservation,
        input.zipBuffer,
        input.expectedResourceRevision,
      );
    } catch (error) {
      throw asSkillFailure(error);
    }
  }

  async archive(input: {
    teamId: string;
    skillId: string;
    expectedResourceRevision: number;
    archivedByUserId: string;
  }): Promise<SkillRecord> {
    try {
      return await this.#db.archiveSkillRecord(input);
    } catch (error) {
      throw asSkillFailure(error);
    }
  }

  async #completePublication(
    reservation: SkillPublicationReservation,
    zipBuffer: Buffer,
    expectedResourceRevision: number,
  ): Promise<PublishedSkillRevision> {
    if (reservation.revision.publicationStatus === "ready") {
      return { skill: reservation.skill, revision: reservation.revision };
    }
    if (reservation.revision.publicationStatus === "failed") {
      throw new SkillFailure("publication_failed", "This Skill publication is terminal");
    }

    let head = await this.#store.headRevisionArchive({ objectKey: reservation.revision.objectKey });
    if (head === null) {
      await this.#store.putRevisionArchive({
        objectKey: reservation.revision.objectKey,
        body: zipBuffer,
        contentLength: reservation.revision.compressedSizeBytes,
        zipSha256: reservation.revision.zipSha256,
      });
      head = await this.#store.headRevisionArchive({ objectKey: reservation.revision.objectKey });
      if (head === null) {
        throw new SkillContentStoreError(
          "skill_storage_unavailable",
          "Skill storage did not make the uploaded object readable",
        );
      }
    }

    if (!headMatchesReservation(head, reservation.revision)) {
      await this.#markTerminal(reservation, "object_integrity_conflict");
      throw new SkillFailure(
        "skill_storage_integrity_conflict",
        "Stored Skill content does not match the reserved Revision",
      );
    }

    try {
      return await this.#db.finalizeSkillRevisionPublication({
        teamId: reservation.skill.teamId,
        skillId: reservation.skill.id,
        revisionId: reservation.revision.id,
        expectedResourceRevision,
      });
    } catch (error) {
      if (error instanceof RdbError && error.code === "RDB_CONFLICT") {
        await this.#markTerminal(reservation, "publication_concurrency_conflict");
      }
      throw error;
    }
  }

  async #markTerminal(
    reservation: SkillPublicationReservation,
    failureCode: string,
  ): Promise<void> {
    await this.#db.failSkillRevisionPublication({
      teamId: reservation.skill.teamId,
      skillId: reservation.skill.id,
      revisionId: reservation.revision.id,
      failureCode,
    });
  }
}

function publicationContent(validated: ValidatedSkillZip) {
  return {
    description: validated.description,
    manifest: validated.manifest,
    compressedSizeBytes: validated.compressedSizeBytes,
    uncompressedSizeBytes: validated.uncompressedSizeBytes,
    zipSha256: validated.zipSha256,
    contentSha256: validated.contentSha256,
  };
}

function headMatchesReservation(
  head: HeadRevisionArchiveResult,
  revision: SkillRevisionRecord,
): boolean {
  return head.contentLength === revision.compressedSizeBytes
    && head.zipSha256Metadata === revision.zipSha256;
}
