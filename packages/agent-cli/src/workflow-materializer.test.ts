import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { SkillManifestEntry, WorkflowSkillProjectionAssignment } from "@mystra/shared";
import { afterEach, describe, expect, it } from "vitest";
import { ZipFile } from "yazl";

import { WorkflowMaterializationError, materializeWorkflowSkills } from "./workflow-materializer.js";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const skillId = "00000000-0000-4000-8000-000000000002";
const revisionId = "00000000-0000-4000-8000-000000000003";
const roots: string[] = [];

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function workspace(markerId = workspaceId) {
  const root = await mkdtemp(path.join(tmpdir(), "mystra-workflow-"));
  roots.push(root);
  await writeFile(path.join(root, ".mystra-workspace.json"), JSON.stringify({ version: 1, workspaceId: markerId }));
  return root;
}

async function zip(files: Array<{ path: string; content: string }>) {
  const archive = new ZipFile();
  for (const file of files) archive.addBuffer(Buffer.from(file.content), file.path);
  archive.end();
  const chunks: Buffer[] = [];
  for await (const chunk of archive.outputStream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function assignment(archive: Buffer, files: Array<{ path: string; content: string }>, generation = 1): WorkflowSkillProjectionAssignment {
  const manifest: SkillManifestEntry[] = files.map((file) => ({
    path: file.path, sizeBytes: Buffer.byteLength(file.content), sha256: createHash("sha256").update(file.content).digest("hex"),
    mediaType: "text/markdown", previewability: "text",
  }));
  return {
    workspaceId, generation, removals: [], entries: [{
      skillId, revisionId, relativePath: `.mystra/skills/${skillId}`,
      zipSha256: createHash("sha256").update(archive).digest("hex"), manifest,
      downloadPath: `/api/runner/sessions/00000000-0000-4000-8000-000000000004/skills/${skillId}/revisions/${revisionId}/download`,
    }],
  };
}

describe("materializeWorkflowSkills", () => {
  it("verifies and atomically publishes the exact generation, then removes only previously managed stale Skills", async () => {
    const root = await workspace();
    const files = [{ path: "SKILL.md", content: "workflow" }, { path: "refs/guide.md", content: "guide" }];
    const archive = await zip(files);
    const first = assignment(archive, files);
    await materializeWorkflowSkills({ assignment: first, workspaceDirectory: root, download: async () => archive });
    expect(await readFile(path.join(root, `.mystra/skills/${skillId}/refs/guide.md`), "utf8")).toBe("guide");

    const unknown = path.join(root, ".mystra/skills/operator-owned");
    await mkdir(unknown, { recursive: true });
    await writeFile(path.join(unknown, "keep"), "yes");
    const empty = { ...first, generation: 2, entries: [], removals: [`.mystra/skills/${skillId}`] };
    await materializeWorkflowSkills({ assignment: empty, workspaceDirectory: root, download: async () => archive });
    await expect(readFile(path.join(root, `.mystra/skills/${skillId}/SKILL.md`))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(path.join(unknown, "keep"), "utf8")).toBe("yes");
  });

  it("rejects traversal, symlink-like entries, archive/file hash mismatches, and the wrong cwd marker without replacing the prior generation", async () => {
    const root = await workspace();
    const safeFiles = [{ path: "SKILL.md", content: "safe" }];
    const safeZip = await zip(safeFiles);
    await materializeWorkflowSkills({ assignment: assignment(safeZip, safeFiles), workspaceDirectory: root, download: async () => safeZip });

    const wrongHash = assignment(safeZip, [{ path: "SKILL.md", content: "tampered" }], 2);
    await expect(materializeWorkflowSkills({ assignment: wrongHash, workspaceDirectory: root, download: async () => safeZip }))
      .rejects.toMatchObject({ code: "manifest_mismatch" });
    expect(await readFile(path.join(root, `.mystra/skills/${skillId}/SKILL.md`), "utf8")).toBe("safe");

    const unsafeZip = await zip([{ path: "wrapper/SKILL.md", content: "safe" }, { path: "wrapper/extra", content: "x" }]);
    await expect(materializeWorkflowSkills({ assignment: assignment(unsafeZip, safeFiles, 2), workspaceDirectory: root, download: async () => unsafeZip }))
      .rejects.toBeInstanceOf(WorkflowMaterializationError);
    const traversal = replaceZipPath(await zip([{ path: "safe/SKILL.md", content: "safe" }]), "safe/SKILL.md", "../x/SKILL.md");
    await expect(materializeWorkflowSkills({ assignment: assignment(traversal, safeFiles, 2), workspaceDirectory: root, download: async () => traversal }))
      .rejects.toMatchObject({ code: "unsafe_archive" });
    const linkFiles = [{ path: "SKILL.md", content: "safe" }, { path: "link.txt", content: "target" }];
    const symlink = mutateZipEntryHeaders(await zip(linkFiles), "link.txt", ({ kind, offset }, value) => {
      if (kind === "central") value.writeUInt32LE((0xa1ff << 16) >>> 0, offset + 38);
    });
    await expect(materializeWorkflowSkills({ assignment: assignment(symlink, linkFiles, 2), workspaceDirectory: root, download: async () => symlink }))
      .rejects.toMatchObject({ code: "unsafe_archive" });
    const wrongRoot = await workspace("00000000-0000-4000-8000-000000000099");
    await expect(materializeWorkflowSkills({ assignment: assignment(safeZip, safeFiles), workspaceDirectory: wrongRoot, download: async () => safeZip }))
      .rejects.toMatchObject({ code: "workspace_marker_mismatch" });
  });
});

function replaceZipPath(buffer: Buffer, original: string, replacement: string) {
  const result = Buffer.from(buffer);
  const source = Buffer.from(original);
  const target = Buffer.from(replacement);
  if (source.length !== target.length) throw new Error("ZIP paths must have equal encoded length");
  let offset = 0;
  while ((offset = result.indexOf(source, offset)) !== -1) { target.copy(result, offset); offset += target.length; }
  return result;
}

function mutateZipEntryHeaders(
  buffer: Buffer, targetPath: string,
  mutate: (header: { kind: "local" | "central"; offset: number }, result: Buffer) => void,
) {
  const result = Buffer.from(buffer);
  const encoded = Buffer.from(targetPath);
  for (let offset = 0; offset <= result.length - 4; offset += 1) {
    const signature = result.readUInt32LE(offset);
    if (signature !== 0x04034b50 && signature !== 0x02014b50) continue;
    const kind = signature === 0x04034b50 ? "local" : "central";
    const nameLength = result.readUInt16LE(offset + (kind === "local" ? 26 : 28));
    const nameOffset = offset + (kind === "local" ? 30 : 46);
    if (nameLength === encoded.length && result.subarray(nameOffset, nameOffset + nameLength).equals(encoded)) mutate({ kind, offset }, result);
  }
  return result;
}
