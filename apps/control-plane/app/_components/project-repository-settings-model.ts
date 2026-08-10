import type { GitRemoteRef, ProjectRepositoryBranchPage } from "@mystra/shared";
import { isValidGitBranchName } from "@mystra/shared/task-workspace";

export type ProjectRepositorySettingsModel = {
  mode: "loading" | "picker" | "text";
  value: string;
  branches: GitRemoteRef[];
  observedHead: string | null;
  readError: string | null;
};

export function createProjectRepositorySettingsModel(
  repositoryBaseBranch: string,
): ProjectRepositorySettingsModel {
  return {
    mode: "loading",
    value: repositoryBaseBranch,
    branches: [],
    observedHead: null,
    readError: null,
  };
}

export function branchReadLoaded(
  current: ProjectRepositorySettingsModel,
  page: ProjectRepositoryBranchPage,
): ProjectRepositorySettingsModel {
  return {
    ...current,
    mode: "picker",
    branches: page.branches,
    observedHead: page.head?.name ?? null,
    readError: null,
  };
}

export function branchReadFailed(
  current: ProjectRepositorySettingsModel,
  message = "Remote branches unavailable; enter a branch name directly.",
): ProjectRepositorySettingsModel {
  return { ...current, mode: "text", branches: [], readError: message };
}

export function validateProjectRepositoryBaseBranch(value: string): string | null {
  return isValidGitBranchName(value) ? null : "Enter a valid Git branch name.";
}
