import type { Project, RepositorySnapshot } from "@mystra/shared";

import type { GitHubCredentialResolver } from "../integrations/github-credential";
import { GitRemoteRepositoryError } from "./remote-repository-reader";
import { createGitRemoteAccess, type GitRemoteAccess } from "./remote-access";

type ProjectRepositoryResolver = {
  getProjectRepository(repositoryExternalId: string): Promise<RepositorySnapshot | undefined>;
};

export class ProjectRemoteAccessFactory {
  readonly #githubCredentials: Pick<GitHubCredentialResolver, "resolve">;
  readonly #githubProvider: (token: string) => ProjectRepositoryResolver;

  constructor(input: {
    githubCredentials: Pick<GitHubCredentialResolver, "resolve">;
    githubProvider: (token: string) => ProjectRepositoryResolver;
  }) {
    this.#githubCredentials = input.githubCredentials;
    this.#githubProvider = input.githubProvider;
  }

  async resolve(project: Project): Promise<GitRemoteAccess> {
    try {
      const resolved = await this.#githubCredentials.resolve(project.repositoryConnectionId);
      const connection = resolved.connection;
      if (
        connection.id !== project.repositoryConnectionId
        || connection.teamId !== project.teamId
        || connection.integration !== "github"
        || connection.provider !== "github"
        || connection.status !== "active"
        || connection.credentialState !== "ready"
      ) {
        throw new Error("Project repository connection mismatch");
      }
      const repository = await this.#githubProvider(resolved.credential.secret)
        .getProjectRepository(project.repositoryExternalId);
      if (
        !repository
        || repository.integration !== "github"
        || repository.provider !== "github"
        || repository.externalId !== project.repositoryExternalId
        || repository.isArchived
      ) {
        throw new Error("Project repository identity mismatch");
      }
      return createGitRemoteAccess({
        endpoint: repository.cloneUrl,
        credential: {
          kind: "http-basic-token",
          username: resolved.credential.username,
          secret: resolved.credential.secret,
        },
      });
    } catch {
      throw new GitRemoteRepositoryError(
        "repository_unavailable",
        "Project repository is unavailable",
      );
    }
  }
}
