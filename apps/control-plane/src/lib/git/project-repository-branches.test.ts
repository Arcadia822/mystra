import { describe, expect, it, vi } from "vitest";

import { createGitRemoteAccess } from "./remote-access.js";
import { GitRemoteRepositoryError } from "./remote-repository-reader.js";
import { ProjectRepositoryBranchesService } from "./project-repository-branches.js";

const teamId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000002";
const connectionId = "00000000-0000-4000-8000-000000000003";
const sha = "0123456789abcdef0123456789abcdef01234567";

const project = {
  id: projectId,
  teamId,
  name: "Mystra",
  slug: "mystra",
  repositoryConnectionId: connectionId,
  repositoryExternalId: "42",
  repositoryBaseBranch: "main",
  metadata: {},
  archivedAt: null,
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};

function createService(inspectBranches = vi.fn(async () => ({
  head: { name: "main", ref: "refs/heads/main", commit: sha },
  branches: [
    { name: "zeta", ref: "refs/heads/zeta", commit: sha },
    { name: "Alpha", ref: "refs/heads/Alpha", commit: sha },
    { name: "main", ref: "refs/heads/main", commit: sha },
    { name: "feature/café", ref: "refs/heads/feature/café", commit: sha },
  ],
}))) {
  const access = createGitRemoteAccess({ endpoint: "https://github.com/example/mystra.git" });
  const resolve = vi.fn(async () => access);
  const getProjectBySlug = vi.fn(async () => project);
  return {
    service: new ProjectRepositoryBranchesService({
      db: { getProjectBySlug } as never,
      accessFactory: { resolve },
      reader: { inspectBranches } as never,
    }),
    getProjectBySlug,
    inspectBranches,
    resolve,
  };
}

describe("ProjectRepositoryBranchesService", () => {
  it("sorts canonical refs by stable UTF-8 byte order and uses bounded standard Git inspection", async () => {
    const { service, inspectBranches, resolve } = createService();

    const result = await service.list("mystra", teamId, { first: 100 });

    expect(result.branches.map((branch) => branch.ref)).toEqual([
      "refs/heads/Alpha",
      "refs/heads/feature/café",
      "refs/heads/main",
      "refs/heads/zeta",
    ]);
    expect(result.head?.name).toBe("main");
    expect(result.pageInfo).toEqual({ hasNextPage: false, endCursor: null });
    expect(resolve).toHaveBeenCalledWith(project);
    expect(inspectBranches).toHaveBeenCalledWith({
      access: expect.any(Object),
      timeoutMs: 30_000,
      maxRefs: 10_000,
      maxOutputBytes: 8 * 1024 * 1024,
    });
  });

  it("filters before pagination and resumes after the last canonical ref", async () => {
    const { service } = createService();

    const first = await service.list("mystra", teamId, { first: 1, query: "A" });
    expect(first.branches.map((branch) => branch.name)).toEqual(["Alpha"]);
    expect(first.pageInfo.hasNextPage).toBe(true);
    expect(first.pageInfo.endCursor).toEqual(expect.any(String));

    const second = await service.list("mystra", teamId, {
      first: 1,
      query: "a",
      after: first.pageInfo.endCursor!,
    });
    expect(second.branches.map((branch) => branch.name)).toEqual(["feature/café"]);
  });

  it("rejects malformed and cross-scope cursors before reading the remote", async () => {
    const firstService = createService();
    const first = await firstService.service.list("mystra", teamId, { first: 1 });

    const secondService = createService();
    secondService.getProjectBySlug.mockResolvedValueOnce({
      ...project,
      id: "00000000-0000-4000-8000-000000000099",
      slug: "another",
    });
    await expect(secondService.service.list("another", teamId, {
      first: 1,
      after: first.pageInfo.endCursor!,
    })).rejects.toMatchObject({ code: "repository_branches_unavailable" });
    expect(secondService.resolve).not.toHaveBeenCalled();
    expect(secondService.inspectBranches).not.toHaveBeenCalled();

    await expect(firstService.service.list("mystra", teamId, {
      first: 1,
      after: "not-a-cursor",
    })).rejects.toMatchObject({ code: "repository_branches_unavailable" });
  });

  it("does not disguise Git inspection failure as an empty branch page", async () => {
    const inspectBranches = vi.fn(async () => {
      throw new GitRemoteRepositoryError(
        "repository_branches_unavailable",
        "Remote repository branches are unavailable",
      );
    });
    const { service } = createService(inspectBranches);

    await expect(service.list("mystra", teamId, { first: 50 })).rejects.toMatchObject({
      code: "repository_branches_unavailable",
    });
  });

  it("fails closed for missing, archived, or cross-Team Projects", async () => {
    for (const value of [undefined, { ...project, archivedAt: "2026-08-10T01:00:00.000Z" }]) {
      const { service, getProjectBySlug, resolve } = createService();
      getProjectBySlug.mockResolvedValueOnce(value as never);
      await expect(service.list("mystra", teamId, { first: 50 })).rejects.toMatchObject({
        code: "repository_branches_unavailable",
      });
      expect(resolve).not.toHaveBeenCalled();
      expect(getProjectBySlug).toHaveBeenCalledWith("mystra", { teamId });
    }
  });
});
