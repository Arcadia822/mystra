export interface ProviderBrowseState {
  after: string | undefined;
  cursorHistory: string[];
  error: string | null;
  isLoading: boolean;
}

export interface ProjectIssuesBrowseState {
  activeProvider: "github" | "linear";
  github: ProviderBrowseState;
  linear: ProviderBrowseState;
  projectSlug: string;
}

function providerState(): ProviderBrowseState {
  return { after: undefined, cursorHistory: [], error: null, isLoading: false };
}

export function createProjectIssuesBrowseState(projectSlug: string): ProjectIssuesBrowseState {
  return { activeProvider: "github", github: providerState(), linear: providerState(), projectSlug };
}

export function selectProjectIssuesProvider(
  state: ProjectIssuesBrowseState,
  provider: "github" | "linear",
): ProjectIssuesBrowseState {
  return { ...state, activeProvider: provider };
}

export function resetProjectIssuesBrowseState(
  state: ProjectIssuesBrowseState,
  projectSlug: string,
): ProjectIssuesBrowseState {
  return state.projectSlug === projectSlug ? state : createProjectIssuesBrowseState(projectSlug);
}

export function hasSelectedProject(projectSlug: string): boolean {
  return projectSlug.trim().length > 0;
}
