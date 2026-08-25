import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  SKILL_MAX_ARCHIVE_BYTES,
  SKILL_MAX_EXPANDED_BYTES,
  workflowSkillProjectionAssignmentSchema,
  type SkillManifestEntry,
  type WorkflowSkillProjectionAssignment,
} from "@mystra/shared";
import { fromBufferPromise, type Entry } from "yauzl";

export type WorkflowMaterializationErrorCode =
  | "workspace_marker_mismatch" | "archive_too_large" | "archive_hash_mismatch"
  | "unsafe_archive" | "manifest_mismatch" | "publish_failed";

export class WorkflowMaterializationError extends Error {
  constructor(readonly code: WorkflowMaterializationErrorCode, message: string) {
    super(message);
    this.name = "WorkflowMaterializationError";
  }
}

type ManifestFile = { relativePath: string; skillId: string; revisionId: string };
type InstalledManifest = { version: 1; workspaceId: string; generation: number; entries: ManifestFile[] };

export async function materializeWorkflowSkills(input: {
  assignment: WorkflowSkillProjectionAssignment;
  workspaceDirectory: string;
  download(entry: WorkflowSkillProjectionAssignment["entries"][number]): Promise<Buffer>;
}): Promise<InstalledManifest> {
  const assignment = workflowSkillProjectionAssignmentSchema.parse(input.assignment);
  if (!path.isAbsolute(input.workspaceDirectory)) throw failure("workspace_marker_mismatch", "Workspace path must be absolute");
  const root = path.resolve(input.workspaceDirectory);
  await assertWorkspaceMarker(root, assignment.workspaceId);
  const mystraRoot = child(root, ".mystra");
  const skillsRoot = child(mystraRoot, "skills");
  const stagingRoot = child(mystraRoot, ".staging");
  const generationRoot = child(stagingRoot, String(assignment.generation));
  await assertDirectoryOrMissing(mystraRoot);
  await assertDirectoryOrMissing(skillsRoot);
  await assertDirectoryOrMissing(stagingRoot);
  await mkdir(skillsRoot, { recursive: true, mode: 0o700 });
  await rm(stagingRoot, { recursive: true, force: true });
  await mkdir(generationRoot, { recursive: true, mode: 0o700 });

  const previous = await readInstalledManifest(child(mystraRoot, "skills-manifest.json"), assignment.workspaceId);
  const published: Array<{ final: string; backup?: string }> = [];
  try {
    for (const entry of assignment.entries) {
      const archive = await input.download(entry);
      if (!Buffer.isBuffer(archive) || archive.length > SKILL_MAX_ARCHIVE_BYTES) {
        throw failure("archive_too_large", "Workflow Skill archive exceeds its bound");
      }
      if (createHash("sha256").update(archive).digest("hex") !== entry.zipSha256) {
        throw failure("archive_hash_mismatch", "Workflow Skill archive digest does not match its Revision");
      }
      await extractExactManifest(archive, child(generationRoot, entry.skillId), entry.manifest);
    }

    for (const entry of assignment.entries) {
      const final = child(root, entry.relativePath);
      const staged = child(generationRoot, entry.skillId);
      const backup = child(generationRoot, `${entry.skillId}.previous`);
      if (await exists(final)) await rename(final, backup);
      try {
        await rename(staged, final);
      } catch (error) {
        if (await exists(backup)) await rename(backup, final).catch(() => undefined);
        throw error;
      }
      published.push({ final, ...((await exists(backup)) ? { backup } : {}) });
    }

    const desired = new Set(assignment.entries.map((entry) => entry.relativePath));
    const removed = new Set<string>();
    for (const stale of previous?.entries ?? []) {
      if (!desired.has(stale.relativePath) && /^\.mystra\/skills\/[0-9a-f-]{36}$/u.test(stale.relativePath)) {
        await stageRemoval(stale.relativePath);
      }
    }
    for (const removal of assignment.removals) {
      if (!desired.has(removal)) await stageRemoval(removal);
    }
    const manifest: InstalledManifest = {
      version: 1, workspaceId: assignment.workspaceId, generation: assignment.generation,
      entries: assignment.entries.map(({ relativePath, skillId, revisionId }) => ({ relativePath, skillId, revisionId })),
    };
    const manifestPath = child(mystraRoot, "skills-manifest.json");
    const manifestTemporary = child(mystraRoot, `.skills-manifest.${assignment.generation}.tmp`);
    await writeFile(manifestTemporary, JSON.stringify(manifest), { encoding: "utf8", mode: 0o600 });
    await rename(manifestTemporary, manifestPath);
    for (const item of published) if (item.backup) await rm(item.backup, { recursive: true, force: true }).catch(() => undefined);
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
    return manifest;

    async function stageRemoval(relativePath: string) {
      if (removed.has(relativePath)) return;
      removed.add(relativePath);
      const final = child(root, relativePath);
      if (!(await exists(final))) return;
      const backup = child(generationRoot, `.removed-${path.basename(relativePath)}`);
      await rename(final, backup);
      published.push({ final, backup });
    }
  } catch (error) {
    for (const item of published.reverse()) {
      await rm(item.final, { recursive: true, force: true }).catch(() => undefined);
      if (item.backup) await rename(item.backup, item.final).catch(() => undefined);
    }
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
    if (error instanceof WorkflowMaterializationError) throw error;
    throw failure("publish_failed", "Workflow Skill generation could not be published");
  }
}

async function assertWorkspaceMarker(root: string, workspaceId: string) {
  try {
    const marker = JSON.parse(await readFile(child(root, ".mystra-workspace.json"), "utf8")) as Record<string, unknown>;
    if (marker.version !== 1 || marker.workspaceId !== workspaceId) throw new Error("mismatch");
  } catch {
    throw failure("workspace_marker_mismatch", "Current directory is not the bound Task Workspace");
  }
}

async function extractExactManifest(archive: Buffer, destination: string, manifest: readonly SkillManifestEntry[]) {
  const zip = await fromBufferPromise(archive, { autoClose: false, decodeStrings: true, strictFileNames: true, validateEntrySizes: true })
    .catch(() => { throw failure("unsafe_archive", "Workflow Skill ZIP structure is invalid"); });
  try {
    const files: Array<{ entry: Entry; path: string }> = [];
    for await (const entry of zip.eachEntry()) {
      const directory = entry.fileName.endsWith("/");
      const clean = normalizeZipPath(entry.fileName, directory);
      assertRegular(entry, directory);
      if (entry.isEncrypted() || (!directory && ![0, 8].includes(entry.compressionMethod))) {
        throw failure("unsafe_archive", "Workflow Skill ZIP uses an unsupported feature");
      }
      if (!directory) files.push({ entry, path: clean });
    }
    const expected = new Map(manifest.map((file) => [file.path, file]));
    const prefix = resolveWrapper(files.map((file) => file.path), [...expected.keys()]);
    const logical = files.map((file) => ({ ...file, path: prefix ? file.path.slice(prefix.length + 1) : file.path }));
    if (logical.length !== expected.size || new Set(logical.map((file) => file.path)).size !== logical.length || logical.some((file) => !expected.has(file.path))) {
      throw failure("manifest_mismatch", "Workflow Skill ZIP files do not exactly match the signed manifest");
    }
    await mkdir(destination, { recursive: true, mode: 0o700 });
    let expanded = 0;
    for (const file of logical) {
      const expectedFile = expected.get(file.path)!;
      const chunks: Buffer[] = [];
      let size = 0;
      const hash = createHash("sha256");
      const stream = await zip.openReadStreamPromise(file.entry).catch(() => { throw failure("unsafe_archive", "Workflow Skill ZIP entry cannot be read"); });
      for await (const raw of stream) {
        const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        size += chunk.length; expanded += chunk.length;
        if (size > expectedFile.sizeBytes || expanded > SKILL_MAX_EXPANDED_BYTES) {
          stream.destroy(); throw failure("manifest_mismatch", "Workflow Skill file exceeds its signed size");
        }
        hash.update(chunk); chunks.push(chunk);
      }
      if (size !== expectedFile.sizeBytes || hash.digest("hex") !== expectedFile.sha256) {
        throw failure("manifest_mismatch", "Workflow Skill file does not match its signed manifest");
      }
      const target = child(destination, file.path);
      await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      await writeFile(target, Buffer.concat(chunks), { mode: 0o600, flag: "wx" });
    }
  } catch (error) {
    if (error instanceof WorkflowMaterializationError) throw error;
    throw failure("unsafe_archive", "Workflow Skill ZIP is unsafe");
  } finally {
    zip.close();
  }
}

function normalizeZipPath(name: string, directory: boolean) {
  const value = directory && name.endsWith("/") ? name.slice(0, -1) : name;
  const segments = value.split("/");
  if (!value || value.startsWith("/") || /^[A-Za-z]:/u.test(value) || value.includes("\\") || value.includes("\0") || segments.some((part) => !part || part === "." || part === "..")) {
    throw failure("unsafe_archive", "Workflow Skill ZIP path is unsafe");
  }
  const normalized = segments.map((part) => part.normalize("NFC")).join("/");
  if (normalized !== value || normalized.length > 1_024) throw failure("unsafe_archive", "Workflow Skill ZIP path is not canonical");
  return normalized;
}

function assertRegular(entry: Entry, directory: boolean) {
  if ((entry.versionMadeBy >>> 8) !== 3) return;
  const type = ((entry.externalFileAttributes >>> 16) & 0xffff) & 0xf000;
  if (type !== 0 && type !== (directory ? 0x4000 : 0x8000)) throw failure("unsafe_archive", "Workflow Skill ZIP contains a non-regular entry");
}

function resolveWrapper(actual: string[], expected: string[]) {
  const exact = actual.every((item) => expected.includes(item));
  if (exact) return "";
  const wrappers = new Set(actual.map((item) => item.split("/")[0]));
  if (wrappers.size !== 1) throw failure("manifest_mismatch", "Workflow Skill ZIP root is ambiguous");
  const wrapper = [...wrappers][0]!;
  return actual.every((item) => item.startsWith(`${wrapper}/`) && expected.includes(item.slice(wrapper.length + 1)))
    ? wrapper
    : (() => { throw failure("manifest_mismatch", "Workflow Skill ZIP root does not match its manifest"); })();
}

async function readInstalledManifest(file: string, workspaceId: string): Promise<InstalledManifest | undefined> {
  try {
    const value = JSON.parse(await readFile(file, "utf8")) as InstalledManifest;
    return value.version === 1 && value.workspaceId === workspaceId && Array.isArray(value.entries) ? value : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw failure("publish_failed", "Installed Workflow Skill manifest is invalid");
  }
}

function child(root: string, relative: string) {
  const candidate = path.resolve(root, relative);
  const rel = path.relative(root, candidate);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw failure("unsafe_archive", "Workflow Skill path escaped its root");
  return candidate;
}

async function exists(target: string) {
  try { await lstat(target); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function assertDirectoryOrMissing(target: string) {
  try {
    const stat = await lstat(target);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw failure("unsafe_archive", "Workflow Skill destination is not a safe directory");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
}

function failure(code: WorkflowMaterializationErrorCode, message: string) {
  return new WorkflowMaterializationError(code, message);
}
