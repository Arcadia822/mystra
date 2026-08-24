import { describe, expect, it } from "vitest";

import {
  filePreviewPresentation,
  findExactManifestFile,
  skillListUrl,
  skillRevisionDownloadUrl,
} from "./skill-library-model";

const textFile = { path: "SKILL.md", sizeBytes: 20, sha256: "a".repeat(64), mediaType: "text/markdown", previewability: "text" as const };
const binaryFile = { path: "assets/logo.bin", sizeBytes: 3, sha256: "b".repeat(64), mediaType: "application/octet-stream", previewability: "binary" as const };

describe("Skill library presentation model", () => {
  it("builds canonical list and immutable download URLs", () => {
    expect(skillListUrl({ query: " review evidence ", includeArchived: true })).toBe("/api/skills?limit=100&query=review+evidence&includeArchived=true");
    expect(skillRevisionDownloadUrl("skill/id", "2")).toBe("/api/skills/skill%2Fid/revisions/2/download");
  });

  it("uses exact logical-path lookup without normalization fallback", () => {
    expect(findExactManifestFile([textFile, binaryFile], "SKILL.md")).toEqual(textFile);
    expect(findExactManifestFile([textFile, binaryFile], "./SKILL.md")).toBeNull();
    expect(findExactManifestFile([textFile, binaryFile], "Assets/logo.bin")).toBeNull();
  });

  it("separates text preview from stable metadata-only reasons", () => {
    expect(filePreviewPresentation({ file: textFile, loading: true, preview: null })).toEqual({ kind: "loading" });
    expect(filePreviewPresentation({ file: binaryFile, loading: false, preview: null })).toEqual({ kind: "metadata", reason: "binary" });
    expect(filePreviewPresentation({
      file: textFile,
      loading: false,
      preview: { revisionId: "00000000-0000-4000-8000-000000000001", sequence: 1, file: textFile, content: "# Skill", truncated: false },
    })).toEqual({ kind: "text", text: "# Skill" });
  });
});
