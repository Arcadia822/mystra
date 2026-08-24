import type { Readable } from "node:stream";

export interface PutRevisionArchiveInput {
  objectKey: string;
  body: Buffer;
  contentLength: number;
  zipSha256: string;
}

export interface HeadRevisionArchiveResult {
  contentLength: number;
  zipSha256Metadata?: string;
}

export interface GetRevisionArchiveResult extends HeadRevisionArchiveResult {
  body: Readable;
}

export interface SkillContentStore {
  putRevisionArchive(input: PutRevisionArchiveInput): Promise<void>;
  headRevisionArchive(input: { objectKey: string }): Promise<HeadRevisionArchiveResult | null>;
  getRevisionArchive(input: { objectKey: string }): Promise<GetRevisionArchiveResult>;
}

export type SkillContentStoreErrorCode =
  | "skill_storage_unavailable"
  | "skill_storage_misconfigured"
  | "skill_storage_integrity_error"
  | "skill_storage_integrity_conflict";

export class SkillContentStoreError extends Error {
  readonly code: SkillContentStoreErrorCode;

  constructor(code: SkillContentStoreErrorCode, message: string) {
    super(message);
    this.name = "SkillContentStoreError";
    this.code = code;
  }
}
