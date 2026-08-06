export type ProjectDraft = {
  name: string;
  slug: string;
  integration: string;
  connectionId: string;
  repository: string;
};

export function defaultProjectConnectionId(activeConnectionIds: string[]): string {
  return activeConnectionIds.length === 1 ? activeConnectionIds[0]! : "";
}

export function changeProjectConnection(draft: ProjectDraft, connectionId: string): ProjectDraft {
  return { ...draft, connectionId, repository: "" };
}

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
    && draft.connectionId.trim().length > 0
    && input.repositoryIdentifiers.includes(draft.repository);
}
