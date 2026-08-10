import {
  projectRepositoryBranchPageSchema,
  type Project,
  type ProjectRepositoryBranchPage,
  type ProjectRepositoryBranchQuery,
} from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import {
  decodeProjectRepositoryBranchCursor,
  encodeProjectRepositoryBranchCursor,
  type ProjectRepositoryBranchCursorScope,
} from "./project-repository-branch-cursor";
import type { GitRemoteAccess } from "./remote-access";
import {
  GitRemoteRepositoryError,
  type RemoteRepositoryReader,
} from "./remote-repository-reader";

const DEFAULT_GIT_READ_LIMITS = {
  timeoutMs: 30_000,
  maxRefs: 10_000,
  maxOutputBytes: 8 * 1024 * 1024,
} as const;

type ProjectRepositoryDb = Pick<RdbProvider, "getProjectBySlug">;

export interface GitRemoteAccessResolver {
  resolve(project: Project): Promise<GitRemoteAccess>;
}

export class ProjectRepositoryBranchesService {
  readonly #db: ProjectRepositoryDb;
  readonly #accessFactory: GitRemoteAccessResolver;
  readonly #reader: Pick<RemoteRepositoryReader, "inspectBranches">;

  constructor(input: {
    db: ProjectRepositoryDb;
    accessFactory: GitRemoteAccessResolver;
    reader: Pick<RemoteRepositoryReader, "inspectBranches">;
  }) {
    this.#db = input.db;
    this.#accessFactory = input.accessFactory;
    this.#reader = input.reader;
  }

  async list(
    slug: string,
    teamId: string,
    input: ProjectRepositoryBranchQuery,
  ): Promise<ProjectRepositoryBranchPage> {
    const project = await this.#db.getProjectBySlug(slug, { teamId });
    if (!project || project.archivedAt) {
      throw unavailable("Active Project repository is unavailable");
    }

    const query = normalizeQuery(input.query);
    const scope: ProjectRepositoryBranchCursorScope = {
      projectId: project.id,
      connectionId: project.repositoryConnectionId,
      repositoryExternalId: project.repositoryExternalId,
      query,
    };
    const afterRef = input.after
      ? decodeProjectRepositoryBranchCursor(input.after, scope)
      : undefined;

    try {
      const access = await this.#accessFactory.resolve(project);
      const advertisement = await this.#reader.inspectBranches({
        access,
        ...DEFAULT_GIT_READ_LIMITS,
      });
      const matching = advertisement.branches
        .filter((branch) => query === "" || branch.name.toLowerCase().includes(query))
        .sort((left, right) => compareUtf8(left.ref, right.ref));
      const start = afterRef
        ? matching.findIndex((branch) => compareUtf8(branch.ref, afterRef) > 0)
        : 0;
      const pageStart = start < 0 ? matching.length : start;
      const branches = matching.slice(pageStart, pageStart + input.first);
      const hasNextPage = pageStart + branches.length < matching.length;
      const last = branches.at(-1);

      return projectRepositoryBranchPageSchema.parse({
        branches,
        head: advertisement.head,
        pageInfo: {
          hasNextPage,
          endCursor: hasNextPage && last
            ? encodeProjectRepositoryBranchCursor(scope, last.ref)
            : null,
        },
      });
    } catch (error) {
      if (
        error instanceof GitRemoteRepositoryError
        && error.code === "repository_branches_unavailable"
      ) throw error;
      throw unavailable("Remote repository branches are unavailable");
    }
  }
}

function normalizeQuery(query: string | undefined): string {
  return query?.trim().toLowerCase() ?? "";
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function unavailable(message: string): GitRemoteRepositoryError {
  return new GitRemoteRepositoryError("repository_branches_unavailable", message);
}
