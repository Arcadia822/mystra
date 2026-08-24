import { createHash } from "node:crypto";
import { extname, posix } from "node:path";

import {
  SKILL_MAX_ARCHIVE_BYTES,
  SKILL_MAX_EXPANDED_BYTES,
  SKILL_MAX_FILE_BYTES,
  SKILL_MAX_FILES,
  SKILL_MAX_SKILL_MD_BYTES,
  SKILL_PREVIEW_MAX_BYTES,
  skillDescriptionSchema,
  skillManifestEntrySchema,
  skillNameSchema,
  type SkillManifestEntry,
  type SkillPreviewability,
} from "@mystra/shared";
import { parseDocument } from "yaml";
import { fromBufferPromise, type Entry } from "yauzl";

const MAX_ALL_ENTRIES = 1_200;
const CONTENT_DIGEST_PREFIX = Buffer.from("mystra-skill-content-v1\0", "utf8");
const SUPPORTED_COMPRESSION_METHODS = new Set([0, 8]);
const TEXT_EXTENSIONS = new Set([
  ".md", ".mdx", ".txt", ".json", ".yaml", ".yml", ".toml", ".csv",
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".sh", ".bash", ".zsh",
]);

export type SkillZipValidationCode =
  | "invalid_zip"
  | "unsupported_zip_feature"
  | "encrypted_entry"
  | "unsafe_path"
  | "path_collision"
  | "unsupported_file_type"
  | "too_many_entries"
  | "too_many_files"
  | "file_too_large"
  | "expanded_size_too_large"
  | "crc_or_size_mismatch"
  | "ambiguous_skill_root"
  | "missing_skill_md"
  | "invalid_skill_md"
  | "skill_name_mismatch";

export class SkillZipValidationError extends Error {
  readonly code: SkillZipValidationCode;
  readonly details: Readonly<Record<string, string | number>> | undefined;

  constructor(
    code: SkillZipValidationCode,
    message: string,
    details?: Readonly<Record<string, string | number>>,
  ) {
    super(message);
    this.name = "SkillZipValidationError";
    this.code = code;
    this.details = details;
  }
}

interface EntryDescriptor {
  entry: Entry;
  normalizedPath: string;
  logicalPath: string;
  directory: boolean;
  noise: boolean;
}

export interface ValidatedSkillZip {
  name: string;
  description: string;
  manifest: SkillManifestEntry[];
  compressedSizeBytes: number;
  uncompressedSizeBytes: number;
  zipSha256: string;
  contentSha256: string;
}

function boundedDetails(path: string, limit?: number): Readonly<Record<string, string | number>> {
  return limit === undefined ? { path: path.slice(0, 1_024) } : { path: path.slice(0, 1_024), limit };
}

function normalizeEntryPath(fileName: string, directory: boolean): string {
  const withoutTrailingSlash = directory && fileName.endsWith("/") ? fileName.slice(0, -1) : fileName;
  if (
    withoutTrailingSlash.length === 0
    || withoutTrailingSlash.startsWith("/")
    || /^[a-zA-Z]:/.test(withoutTrailingSlash)
    || withoutTrailingSlash.includes("\\")
    || withoutTrailingSlash.includes("\0")
  ) {
    throw new SkillZipValidationError("unsafe_path", "ZIP entry path is unsafe", boundedDetails(fileName));
  }

  const segments = withoutTrailingSlash.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new SkillZipValidationError("unsafe_path", "ZIP entry path is unsafe", boundedDetails(fileName));
  }

  const normalized = segments.map((segment) => segment.normalize("NFC")).join("/");
  if (normalized.length > 1_024) {
    throw new SkillZipValidationError("unsafe_path", "ZIP entry path is too long", boundedDetails(normalized, 1_024));
  }
  return normalized;
}

function entryIsDirectory(entry: Entry): boolean {
  return entry.fileName.endsWith("/");
}

function assertSupportedFileType(entry: Entry, directory: boolean): void {
  const platform = entry.versionMadeBy >>> 8;
  if (platform !== 3) return;
  const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
  const type = mode & 0xf000;
  if (type === 0) return;
  if ((directory && type !== 0x4000) || (!directory && type !== 0x8000)) {
    throw new SkillZipValidationError(
      "unsupported_file_type",
      "ZIP contains a non-regular file",
      boundedDetails(entry.fileName),
    );
  }
}

function isPackagingNoise(path: string): boolean {
  return path.startsWith("__MACOSX/") || posix.basename(path) === ".DS_Store";
}

function collisionKey(path: string): string {
  return path.normalize("NFC").toLocaleLowerCase("en-US");
}

function assertNoPathCollisions(descriptors: readonly EntryDescriptor[], useLogicalPath: boolean): void {
  const seen = new Map<string, string>();
  for (const descriptor of descriptors) {
    const path = useLogicalPath ? descriptor.logicalPath : descriptor.normalizedPath;
    if (!path) continue;
    const key = collisionKey(path);
    const previous = seen.get(key);
    if (previous !== undefined) {
      throw new SkillZipValidationError(
        "path_collision",
        "ZIP entry paths collide after normalization",
        { path: path.slice(0, 1_024), conflictingPath: previous.slice(0, 1_024) },
      );
    }
    seen.set(key, path);
  }
}

function resolveLogicalRoot(descriptors: EntryDescriptor[]): void {
  const relevant = descriptors.filter((descriptor) => !descriptor.noise);
  const regularPaths = relevant.filter((descriptor) => !descriptor.directory).map((descriptor) => descriptor.normalizedPath);
  if (regularPaths.length === 0) {
    throw new SkillZipValidationError("missing_skill_md", "ZIP does not contain SKILL.md");
  }

  const rootCandidate = regularPaths.includes("SKILL.md");
  const firstSegments = new Set(relevant.map((descriptor) => descriptor.normalizedPath.split("/")[0]));
  const wrapper = firstSegments.size === 1 ? [...firstSegments][0]! : undefined;
  const wrapperCandidate = wrapper !== undefined && regularPaths.includes(`${wrapper}/SKILL.md`);

  if (rootCandidate === wrapperCandidate) {
    throw new SkillZipValidationError(
      rootCandidate ? "ambiguous_skill_root" : "missing_skill_md",
      rootCandidate ? "ZIP contains an ambiguous Skill root" : "ZIP does not contain a root SKILL.md",
    );
  }

  for (const descriptor of relevant) {
    descriptor.logicalPath = rootCandidate
      ? descriptor.normalizedPath
      : descriptor.normalizedPath.slice(wrapper!.length + 1);
  }

  const logical = relevant.filter((descriptor) => descriptor.logicalPath.length > 0);
  assertNoPathCollisions(logical, true);
}

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function updateCrc32(crc: number, chunk: Buffer): number {
  let next = crc;
  for (const byte of chunk) next = CRC32_TABLE[(next ^ byte) & 0xff]! ^ (next >>> 8);
  return next >>> 0;
}

function uint64be(value: number): Buffer {
  const output = Buffer.allocUnsafe(8);
  output.writeBigUInt64BE(BigInt(value));
  return output;
}

function mediaTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".md": return "text/markdown";
    case ".mdx": return "text/mdx";
    case ".txt": return "text/plain";
    case ".json": return "application/json";
    case ".yaml": case ".yml": return "application/yaml";
    case ".toml": return "application/toml";
    case ".csv": return "text/csv";
    case ".ts": case ".tsx": return "text/typescript";
    case ".js": case ".jsx": case ".mjs": case ".cjs": return "text/javascript";
    case ".py": return "text/x-python";
    case ".sh": case ".bash": case ".zsh": return "text/x-shellscript";
    case ".html": return "text/html";
    case ".svg": return "image/svg+xml";
    default: return "application/octet-stream";
  }
}

function classifyPreview(path: string, size: number, captured: Buffer | undefined): SkillPreviewability {
  if (size > SKILL_PREVIEW_MAX_BYTES) return "too_large";
  const extension = extname(path).toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension)) return extension === ".html" || extension === ".svg" ? "unsupported" : "binary";
  if (captured?.includes(0)) return "binary";
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(captured);
    return "text";
  } catch {
    return "invalid_utf8";
  }
}

function parseSkillMarkdown(content: Buffer): { name: string; description: string } {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    throw new SkillZipValidationError("invalid_skill_md", "SKILL.md must be valid UTF-8");
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) throw new SkillZipValidationError("invalid_skill_md", "SKILL.md requires leading YAML frontmatter");

  const document = parseDocument(match[1]!, { schema: "core", customTags: [] });
  if (document.errors.length > 0) {
    throw new SkillZipValidationError("invalid_skill_md", "SKILL.md frontmatter is invalid");
  }

  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount: 10 });
  } catch {
    throw new SkillZipValidationError("invalid_skill_md", "SKILL.md frontmatter exceeds safe parser limits");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new SkillZipValidationError("invalid_skill_md", "SKILL.md frontmatter must be a mapping");
  }
  const frontmatter = value as Record<string, unknown>;
  const name = skillNameSchema.safeParse(frontmatter.name);
  const description = skillDescriptionSchema.safeParse(frontmatter.description);
  if (!name.success || !description.success) {
    throw new SkillZipValidationError("invalid_skill_md", "SKILL.md name or description is invalid");
  }
  return { name: name.data, description: description.data };
}

function mapZipError(error: unknown): SkillZipValidationError {
  if (error instanceof SkillZipValidationError) return error;
  const message = error instanceof Error ? error.message : "Invalid ZIP";
  if (/relative path|absolute path|backslash|invalid characters/i.test(message)) {
    return new SkillZipValidationError("unsafe_path", "ZIP entry path is unsafe");
  }
  if (/uncompressed size|unexpected end|invalid stored block|incorrect data check/i.test(message)) {
    return new SkillZipValidationError("crc_or_size_mismatch", "ZIP entry content does not match metadata");
  }
  return new SkillZipValidationError("invalid_zip", "ZIP structure is invalid");
}

export async function validateSkillZip(zipBuffer: Buffer): Promise<ValidatedSkillZip> {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length === 0) {
    throw new SkillZipValidationError("invalid_zip", "ZIP body is empty");
  }
  if (zipBuffer.length > SKILL_MAX_ARCHIVE_BYTES) {
    throw new SkillZipValidationError("file_too_large", "ZIP exceeds the archive limit", { limit: SKILL_MAX_ARCHIVE_BYTES });
  }

  let zipFile;
  try {
    zipFile = await fromBufferPromise(zipBuffer, {
      autoClose: false,
      decodeStrings: true,
      strictFileNames: true,
      validateEntrySizes: true,
    });
  } catch (error) {
    throw mapZipError(error);
  }

  try {
    const descriptors: EntryDescriptor[] = [];
    let declaredExpandedSize = 0;

    try {
      for await (const entry of zipFile.eachEntry()) {
        if (descriptors.length >= MAX_ALL_ENTRIES) {
          throw new SkillZipValidationError("too_many_entries", "ZIP has too many entries", { limit: MAX_ALL_ENTRIES });
        }
        const directory = entryIsDirectory(entry);
        const normalizedPath = normalizeEntryPath(entry.fileName, directory);
        assertSupportedFileType(entry, directory);
        if (entry.isEncrypted()) {
          throw new SkillZipValidationError("encrypted_entry", "Encrypted ZIP entries are not supported", boundedDetails(normalizedPath));
        }
        if (!directory && (!SUPPORTED_COMPRESSION_METHODS.has(entry.compressionMethod) || !entry.canDecodeFileData())) {
          throw new SkillZipValidationError(
            "unsupported_zip_feature",
            "ZIP compression method is not supported",
            boundedDetails(normalizedPath),
          );
        }
        if (!directory) {
          declaredExpandedSize += entry.uncompressedSize;
          if (entry.uncompressedSize > SKILL_MAX_FILE_BYTES) {
            throw new SkillZipValidationError("file_too_large", "ZIP entry exceeds the file limit", boundedDetails(normalizedPath, SKILL_MAX_FILE_BYTES));
          }
          if (declaredExpandedSize > SKILL_MAX_EXPANDED_BYTES) {
            throw new SkillZipValidationError("expanded_size_too_large", "ZIP exceeds the expanded size limit", { limit: SKILL_MAX_EXPANDED_BYTES });
          }
        }
        descriptors.push({
          entry,
          normalizedPath,
          logicalPath: "",
          directory,
          noise: isPackagingNoise(normalizedPath),
        });
      }
    } catch (error) {
      throw mapZipError(error);
    }

    assertNoPathCollisions(descriptors, false);
    resolveLogicalRoot(descriptors);

    const regularDescriptors = descriptors
      .filter((descriptor) => !descriptor.noise && !descriptor.directory && descriptor.logicalPath.length > 0)
      .sort((left, right) => Buffer.compare(Buffer.from(left.logicalPath), Buffer.from(right.logicalPath)));
    if (regularDescriptors.length > SKILL_MAX_FILES) {
      throw new SkillZipValidationError("too_many_files", "Skill contains too many logical files", { limit: SKILL_MAX_FILES });
    }
    if (!regularDescriptors.some((descriptor) => descriptor.logicalPath === "SKILL.md")) {
      throw new SkillZipValidationError("missing_skill_md", "Skill root does not contain SKILL.md");
    }
    const skillMarkdownDescriptor = regularDescriptors.find((descriptor) => descriptor.logicalPath === "SKILL.md")!;
    if (skillMarkdownDescriptor.entry.uncompressedSize > SKILL_MAX_SKILL_MD_BYTES) {
      throw new SkillZipValidationError("file_too_large", "SKILL.md exceeds its limit", { limit: SKILL_MAX_SKILL_MD_BYTES });
    }

    const contentHash = createHash("sha256");
    contentHash.update(CONTENT_DIGEST_PREFIX);
    const manifest: SkillManifestEntry[] = [];
    let expandedSize = 0;
    let skillMetadata: { name: string; description: string } | undefined;

    for (const descriptor of regularDescriptors) {
      const pathBytes = Buffer.from(descriptor.logicalPath, "utf8");
      const pathLength = Buffer.allocUnsafe(4);
      pathLength.writeUInt32BE(pathBytes.length);
      contentHash.update(pathLength);
      contentHash.update(pathBytes);
      contentHash.update(uint64be(descriptor.entry.uncompressedSize));

      const fileHash = createHash("sha256");
      let crc = 0xffffffff;
      let actualSize = 0;
      const shouldCapture = descriptor.logicalPath === "SKILL.md"
        || (TEXT_EXTENSIONS.has(extname(descriptor.logicalPath).toLowerCase())
          && descriptor.entry.uncompressedSize <= SKILL_PREVIEW_MAX_BYTES);
      const captured: Buffer[] = [];
      let capturedSize = 0;
      const captureLimit = descriptor.logicalPath === "SKILL.md"
        ? SKILL_MAX_SKILL_MD_BYTES
        : SKILL_PREVIEW_MAX_BYTES;

      try {
        const stream = await zipFile.openReadStreamPromise(descriptor.entry);
        for await (const rawChunk of stream) {
          const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
          actualSize += chunk.length;
          expandedSize += chunk.length;
          if (actualSize > SKILL_MAX_FILE_BYTES || expandedSize > SKILL_MAX_EXPANDED_BYTES) {
            stream.destroy();
            throw new SkillZipValidationError(
              actualSize > SKILL_MAX_FILE_BYTES ? "file_too_large" : "expanded_size_too_large",
              "ZIP expanded content exceeds a limit",
              boundedDetails(descriptor.logicalPath),
            );
          }
          crc = updateCrc32(crc, chunk);
          fileHash.update(chunk);
          contentHash.update(chunk);
          if (shouldCapture) {
            capturedSize += chunk.length;
            if (capturedSize > captureLimit) {
              stream.destroy();
              throw new SkillZipValidationError(
                descriptor.logicalPath === "SKILL.md" ? "file_too_large" : "crc_or_size_mismatch",
                "ZIP entry exceeds its declared capture limit",
                boundedDetails(descriptor.logicalPath, captureLimit),
              );
            }
            captured.push(chunk);
          }
        }
      } catch (error) {
        throw mapZipError(error);
      }

      if (actualSize !== descriptor.entry.uncompressedSize || ((crc ^ 0xffffffff) >>> 0) !== descriptor.entry.crc32) {
        throw new SkillZipValidationError(
          "crc_or_size_mismatch",
          "ZIP entry content does not match CRC or size metadata",
          boundedDetails(descriptor.logicalPath),
        );
      }

      const content = shouldCapture ? Buffer.concat(captured) : undefined;
      if (descriptor.logicalPath === "SKILL.md") {
        skillMetadata = parseSkillMarkdown(content!);
      }

      manifest.push(skillManifestEntrySchema.parse({
        path: descriptor.logicalPath,
        sizeBytes: actualSize,
        sha256: fileHash.digest("hex"),
        mediaType: mediaTypeFor(descriptor.logicalPath),
        previewability: classifyPreview(descriptor.logicalPath, actualSize, content),
      }));
    }

    if (!skillMetadata) throw new SkillZipValidationError("missing_skill_md", "Skill root does not contain SKILL.md");
    return {
      ...skillMetadata,
      manifest,
      compressedSizeBytes: zipBuffer.length,
      uncompressedSizeBytes: expandedSize,
      zipSha256: createHash("sha256").update(zipBuffer).digest("hex"),
      contentSha256: contentHash.digest("hex"),
    };
  } finally {
    zipFile.close();
  }
}

export async function readSkillZipLogicalFile(zipBuffer: Buffer, logicalPath: string): Promise<Buffer> {
  let zipFile;
  try {
    zipFile = await fromBufferPromise(zipBuffer, {
      autoClose: false,
      decodeStrings: true,
      strictFileNames: true,
      validateEntrySizes: true,
    });
  } catch (error) {
    throw mapZipError(error);
  }
  try {
    const descriptors: EntryDescriptor[] = [];
    let declaredExpandedSize = 0;
    try {
      for await (const entry of zipFile.eachEntry()) {
        if (descriptors.length >= MAX_ALL_ENTRIES) {
          throw new SkillZipValidationError("too_many_entries", "ZIP has too many entries", { limit: MAX_ALL_ENTRIES });
        }
        const directory = entryIsDirectory(entry);
        const normalizedPath = normalizeEntryPath(entry.fileName, directory);
        assertSupportedFileType(entry, directory);
        if (entry.isEncrypted()) throw new SkillZipValidationError("encrypted_entry", "Encrypted ZIP entry");
        if (!directory && (!SUPPORTED_COMPRESSION_METHODS.has(entry.compressionMethod) || !entry.canDecodeFileData())) {
          throw new SkillZipValidationError("unsupported_zip_feature", "Unsupported ZIP compression");
        }
        if (!directory) {
          declaredExpandedSize += entry.uncompressedSize;
          if (entry.uncompressedSize > SKILL_MAX_FILE_BYTES) {
            throw new SkillZipValidationError("file_too_large", "ZIP entry exceeds the file limit");
          }
          if (declaredExpandedSize > SKILL_MAX_EXPANDED_BYTES) {
            throw new SkillZipValidationError("expanded_size_too_large", "ZIP exceeds the expanded size limit");
          }
        }
        descriptors.push({
          entry,
          normalizedPath,
          logicalPath: "",
          directory,
          noise: isPackagingNoise(normalizedPath),
        });
      }
    } catch (error) {
      throw mapZipError(error);
    }
    assertNoPathCollisions(descriptors, false);
    resolveLogicalRoot(descriptors);
    const descriptor = descriptors.find((candidate) => (
      !candidate.noise && !candidate.directory && candidate.logicalPath === logicalPath
    ));
    if (!descriptor) throw new SkillZipValidationError("unsafe_path", "Requested logical file does not exist");
    const chunks: Buffer[] = [];
    let size = 0;
    let crc = 0xffffffff;
    try {
      const stream = await zipFile.openReadStreamPromise(descriptor.entry);
      for await (const rawChunk of stream) {
        const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
        size += chunk.length;
        if (size > SKILL_MAX_FILE_BYTES) {
          stream.destroy();
          throw new SkillZipValidationError("file_too_large", "ZIP entry exceeds the file limit");
        }
        crc = updateCrc32(crc, chunk);
        chunks.push(chunk);
      }
    } catch (error) {
      throw mapZipError(error);
    }
    if (size !== descriptor.entry.uncompressedSize || ((crc ^ 0xffffffff) >>> 0) !== descriptor.entry.crc32) {
      throw new SkillZipValidationError("crc_or_size_mismatch", "ZIP entry content does not match metadata");
    }
    return Buffer.concat(chunks);
  } finally {
    zipFile.close();
  }
}
