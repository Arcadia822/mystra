export type ProjectDraft = {
  name: string;
  slug: string;
  integration: string;
  repository: string;
  agent: "codex" | "copilot";
  runtimeImage: string;
};

export function canSubmitProject(input: {
  draft: ProjectDraft;
  repositoryIdentifiers: string[];
  isSubmitting: boolean;
}): boolean {
  const { draft } = input;
  return !input.isSubmitting
    && draft.name.trim().length > 0
    && draft.slug.trim().length > 0
    && draft.integration.trim().length > 0
    && draft.runtimeImage.trim().length > 0
    && input.repositoryIdentifiers.includes(draft.repository);
}
