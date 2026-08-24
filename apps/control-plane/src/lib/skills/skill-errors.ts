import type { SkillErrorCode } from "@mystra/shared";

import { RdbError } from "../db/prisma-errors";
import { SkillContentStoreError } from "./skill-content-store";
import { SkillZipValidationError } from "./skill-zip-validator";

export class SkillFailure extends Error {
  readonly code: SkillErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: SkillErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "SkillFailure";
    this.code = code;
    this.details = details;
  }
}

export function skillHttpStatus(code: SkillErrorCode): number {
  switch (code) {
    case "invalid_content_type":
    case "content_length_required":
    case "skill_zip_too_large":
    case "invalid_skill_zip":
    case "skill_name_mismatch":
      return 400;
    case "skill_not_found":
    case "skill_revision_not_found":
    case "skill_file_not_found":
      return 404;
    case "skill_name_conflict":
    case "skill_archived":
    case "revision_conflict":
    case "skill_storage_integrity_conflict":
    case "publication_failed":
      return 409;
    case "skill_file_not_previewable":
      return 422;
    case "skill_storage_unavailable":
    case "skill_storage_misconfigured":
      return 503;
    case "skill_storage_integrity_error":
      return 502;
  }
}

export function asSkillFailure(error: unknown): SkillFailure {
  if (error instanceof SkillFailure) return error;
  if (error instanceof SkillZipValidationError) {
    return new SkillFailure("invalid_skill_zip", "The ZIP does not satisfy the Skill package contract", error.details);
  }
  if (error instanceof SkillContentStoreError) {
    return new SkillFailure(error.code, error.message);
  }
  if (error instanceof RdbError) {
    if (error.code === "RDB_NOT_FOUND") return new SkillFailure("skill_not_found", "Skill not found");
    if (error.code === "RDB_CONFLICT") {
      if (/active Skill already uses this name/u.test(error.message)) {
        return new SkillFailure("skill_name_conflict", "An active Skill already uses this name");
      }
      if (/Archived Skill/u.test(error.message)) {
        return new SkillFailure("skill_archived", "Archived Skill cannot accept new revisions");
      }
      if (/name cannot change/u.test(error.message)) {
        return new SkillFailure("skill_name_mismatch", "Skill name cannot change across revisions");
      }
      if (/resource revision|base revision|concurrency race/u.test(error.message)) {
        return new SkillFailure("revision_conflict", "Skill changed since the requested revision");
      }
      return new SkillFailure("publication_failed", "Skill publication cannot be completed");
    }
    if (error.code === "RDB_UNAVAILABLE") {
      return new SkillFailure("publication_failed", "Skill persistence is unavailable");
    }
  }
  return new SkillFailure("publication_failed", "Skill operation failed");
}
