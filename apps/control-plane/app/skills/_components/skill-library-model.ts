import type { SkillFilePreviewResponse, SkillManifestEntry } from "@mystra/shared";

export function skillListUrl(input: { query: string; includeArchived: boolean }): string {
  const params = new URLSearchParams({ limit: "100" });
  if (input.query.trim()) params.set("query", input.query.trim());
  if (input.includeArchived) params.set("includeArchived", "true");
  return `/api/skills?${params}`;
}

export function skillRevisionDownloadUrl(skillId: string, revisionId: string): string {
  return `/api/skills/${encodeURIComponent(skillId)}/revisions/${encodeURIComponent(revisionId)}/download`;
}

export function findExactManifestFile(
  manifest: readonly SkillManifestEntry[],
  path: string | null,
): SkillManifestEntry | null {
  return manifest.find((entry) => entry.path === path) ?? null;
}

export function filePreviewPresentation(input: {
  file: SkillManifestEntry | null;
  preview: SkillFilePreviewResponse | null;
  loading: boolean;
}): { kind: "loading" | "text" | "metadata"; reason?: string; text?: string } {
  if (input.loading) return { kind: "loading" };
  if (input.file && input.preview?.file.path === input.file.path) {
    return { kind: "text", text: input.preview.content };
  }
  return { kind: "metadata", ...(input.file ? { reason: input.file.previewability } : {}) };
}
