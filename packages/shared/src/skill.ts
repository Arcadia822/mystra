import { z } from "zod";

export const SKILL_LIST_DEFAULT_LIMIT = 50;
export const SKILL_LIST_MAX_LIMIT = 100;
export const SKILL_MAX_FILES = 1_000;
export const SKILL_MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;
export const SKILL_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const SKILL_MAX_EXPANDED_BYTES = 100 * 1024 * 1024;
export const SKILL_MAX_SKILL_MD_BYTES = 1024 * 1024;
export const SKILL_PREVIEW_MAX_BYTES = 256 * 1024;

export const skillNameSchema = z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const skillDescriptionSchema = z.string().trim().min(1).max(500);
export const skillStatusSchema = z.enum(["active", "archived"]);
export type SkillStatus = z.infer<typeof skillStatusSchema>;

export const skillPublicationStatusSchema = z.enum(["uploading", "ready", "failed"]);
export type SkillPublicationStatus = z.infer<typeof skillPublicationStatusSchema>;

export const skillPreviewabilitySchema = z.enum([
  "text",
  "binary",
  "too_large",
  "invalid_utf8",
  "unsupported",
]);
export type SkillPreviewability = z.infer<typeof skillPreviewabilitySchema>;

export const skillSha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const skillLogicalPathSchema = z.string().min(1).max(1_024).superRefine((value, context) => {
  const segments = value.split("/");
  if (
    value.startsWith("/")
    || value.includes("\\")
    || value.includes("\0")
    || value !== value.normalize("NFC")
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    context.addIssue({ code: "custom", message: "Skill path must be a canonical root-relative POSIX path" });
  }
});

export const skillManifestEntrySchema = z.object({
  path: skillLogicalPathSchema,
  sizeBytes: z.number().int().min(0).max(SKILL_MAX_FILE_BYTES),
  sha256: skillSha256Schema,
  mediaType: z.string().trim().min(1).max(255),
  previewability: skillPreviewabilitySchema,
}).strict();
export type SkillManifestEntry = z.infer<typeof skillManifestEntrySchema>;

const skillRevisionBaseSchema = z.object({
  id: z.string().uuid(),
  skillId: z.string().uuid(),
  baseRevisionId: z.string().uuid().nullable(),
  sequence: z.number().int().positive(),
  publicationStatus: z.literal("ready"),
  description: skillDescriptionSchema,
  compressedSizeBytes: z.number().int().positive().max(SKILL_MAX_ARCHIVE_BYTES),
  uncompressedSizeBytes: z.number().int().positive().max(SKILL_MAX_EXPANDED_BYTES),
  zipSha256: skillSha256Schema,
  contentSha256: skillSha256Schema,
  createdByUserId: z.string().uuid(),
  createdAt: z.string().datetime(),
  readyAt: z.string().datetime(),
}).strict();

export const skillRevisionSummarySchema = skillRevisionBaseSchema;
export type SkillRevisionSummary = z.infer<typeof skillRevisionSummarySchema>;

export const skillRevisionDetailSchema = skillRevisionBaseSchema.extend({
  manifest: z.array(skillManifestEntrySchema).min(1).max(SKILL_MAX_FILES),
}).strict().superRefine((value, context) => {
  const encoder = new TextEncoder();
  for (let index = 1; index < value.manifest.length; index += 1) {
    const previous = encoder.encode(value.manifest[index - 1]!.path);
    const current = encoder.encode(value.manifest[index]!.path);
    let comparison = previous.length - current.length;
    for (let byte = 0; byte < Math.min(previous.length, current.length); byte += 1) {
      if (previous[byte] !== current[byte]) {
        comparison = previous[byte]! - current[byte]!;
        break;
      }
      if (byte === Math.min(previous.length, current.length) - 1) comparison = previous.length - current.length;
    }
    if (comparison >= 0) {
      context.addIssue({
        code: "custom",
        path: ["manifest", index, "path"],
        message: "Skill manifest paths must be unique and ordered by UTF-8 bytes",
      });
    }
  }
});
export type SkillRevisionDetail = z.infer<typeof skillRevisionDetailSchema>;

const skillBaseSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  name: skillNameSchema,
  description: skillDescriptionSchema,
  status: skillStatusSchema,
  currentRevisionId: z.string().uuid(),
  resourceRevision: z.number().int().positive(),
  createdByUserId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedByUserId: z.string().uuid().nullable(),
  archivedAt: z.string().datetime().nullable(),
}).strict().superRefine((value, context) => {
  const archiveFieldsPresent = value.archivedByUserId !== null && value.archivedAt !== null;
  if ((value.status === "archived") !== archiveFieldsPresent) {
    context.addIssue({ code: "custom", path: ["status"], message: "Skill archive fields must match status" });
  }
});

export const skillSummarySchema = skillBaseSchema.extend({
  currentRevision: skillRevisionSummarySchema,
}).strict();
export type SkillSummary = z.infer<typeof skillSummarySchema>;

export const skillDetailSchema = skillBaseSchema.extend({
  currentRevision: skillRevisionDetailSchema,
}).strict();
export type SkillDetail = z.infer<typeof skillDetailSchema>;

const queryBooleanSchema = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false" || value === undefined) return false;
  return value;
}, z.boolean());

const nullableQueryTextSchema = z.preprocess(
  (value) => value === undefined || value === "" ? null : value,
  z.string().trim().min(1).max(500).nullable(),
);

const nullableCursorSchema = z.preprocess(
  (value) => value === undefined || value === "" ? null : value,
  z.string().trim().min(1).max(4_096).nullable(),
);

export const skillListQuerySchema = z.object({
  cursor: nullableCursorSchema.default(null),
  limit: z.coerce.number().int().min(1).max(SKILL_LIST_MAX_LIMIT).default(SKILL_LIST_DEFAULT_LIMIT),
  query: nullableQueryTextSchema.default(null),
  includeArchived: queryBooleanSchema.default(false),
}).strict();
export type SkillListQuery = z.input<typeof skillListQuerySchema>;
export type ParsedSkillListQuery = z.output<typeof skillListQuerySchema>;

export const skillRevisionListQuerySchema = z.object({
  cursor: nullableCursorSchema.default(null),
  limit: z.coerce.number().int().min(1).max(SKILL_LIST_MAX_LIMIT).default(SKILL_LIST_DEFAULT_LIMIT),
}).strict();
export type SkillRevisionListQuery = z.input<typeof skillRevisionListQuerySchema>;

export const skillPageSchema = z.object({
  items: z.array(skillSummarySchema),
  nextCursor: z.string().min(1).max(4_096).nullable(),
}).strict();
export type SkillPage = z.infer<typeof skillPageSchema>;

export const skillRevisionPageSchema = z.object({
  items: z.array(skillRevisionSummarySchema),
  nextCursor: z.string().min(1).max(4_096).nullable(),
}).strict();
export type SkillRevisionPage = z.infer<typeof skillRevisionPageSchema>;

export const skillResponseSchema = z.object({ skill: skillDetailSchema }).strict();
export type SkillResponse = z.infer<typeof skillResponseSchema>;

export const skillPublicationResponseSchema = z.object({
  skill: skillDetailSchema,
  revision: skillRevisionDetailSchema,
}).strict();
export type SkillPublicationResponse = z.infer<typeof skillPublicationResponseSchema>;

export const skillFilePreviewResponseSchema = z.object({
  revisionId: z.string().uuid(),
  sequence: z.number().int().positive(),
  file: skillManifestEntrySchema.extend({ previewability: z.literal("text") }).strict(),
  content: z.string().max(SKILL_PREVIEW_MAX_BYTES),
  truncated: z.literal(false),
}).strict();
export type SkillFilePreviewResponse = z.infer<typeof skillFilePreviewResponseSchema>;

export const skillFileNotPreviewableDetailsSchema = z.object({
  file: skillManifestEntrySchema,
  reason: skillPreviewabilitySchema.exclude(["text"]),
}).strict();
export type SkillFileNotPreviewableDetails = z.infer<typeof skillFileNotPreviewableDetailsSchema>;

export const skillErrorCodeSchema = z.enum([
  "invalid_content_type",
  "content_length_required",
  "skill_zip_too_large",
  "invalid_skill_zip",
  "skill_name_conflict",
  "skill_not_found",
  "skill_revision_not_found",
  "skill_file_not_found",
  "skill_file_not_previewable",
  "skill_archived",
  "skill_name_mismatch",
  "revision_conflict",
  "skill_storage_unavailable",
  "skill_storage_misconfigured",
  "skill_storage_integrity_error",
  "skill_storage_integrity_conflict",
  "publication_failed",
]);
export type SkillErrorCode = z.infer<typeof skillErrorCodeSchema>;
