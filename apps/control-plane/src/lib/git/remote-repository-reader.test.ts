import { describe, expect, it, vi } from "vitest";

import { createGitRemoteAccess } from "./remote-access.js";
import {
  GitRemoteRepositoryError,
  RemoteRepositoryReader,
  type GitCommandRequest,
} from "./remote-repository-reader.js";

const shaMain = "0123456789abcdef0123456789abcdef01234567";
const shaRelease = "abcdef0123456789abcdef0123456789abcdef01";

function access(secret = "secret-that-must-never-appear") {
  return createGitRemoteAccess({
    endpoint: "https://github.com/example/repository.git",
    credential: { kind: "http-basic-token", username: "x-access-token", secret },
  });
}

describe("RemoteRepositoryReader", () => {
  it("inspects symbolic HEAD and all branch refs with one bounded advertisement", async () => {
    const runGit = vi.fn(async (_request: GitCommandRequest) => ({
      status: 0,
      stdout: [
        "ref: refs/heads/main\tHEAD",
        `${shaMain}\tHEAD`,
        `${shaRelease}\trefs/heads/release/0.1`,
        `${shaMain}\trefs/heads/main`,
        "",
      ].join("\n"),
    }));
    const reader = new RemoteRepositoryReader({ runGit });

    const result = await reader.inspectBranches({
      access: access(),
      timeoutMs: 30_000,
      maxRefs: 10_000,
      maxOutputBytes: 8 * 1024 * 1024,
    });

    expect(result).toEqual({
      head: { name: "main", ref: "refs/heads/main", commit: shaMain },
      branches: [
        { name: "release/0.1", ref: "refs/heads/release/0.1", commit: shaRelease },
        { name: "main", ref: "refs/heads/main", commit: shaMain },
      ],
    });
    expect(runGit).toHaveBeenCalledTimes(1);
    expect(runGit).toHaveBeenCalledWith(expect.objectContaining({
      args: [
        "ls-remote",
        "--symref",
        "--quiet",
        "https://github.com/example/repository.git",
        "HEAD",
        "refs/heads/*",
      ],
      timeoutMs: 30_000,
      maxOutputBytes: 8 * 1024 * 1024,
      credential: expect.objectContaining({ secret: "secret-that-must-never-appear" }),
    }));
  });

  it("resolves only the exact configured branch and treats status 2 as missing", async () => {
    const runGit = vi.fn()
      .mockResolvedValueOnce({ status: 0, stdout: `${shaRelease}\trefs/heads/release/0.1\n` })
      .mockResolvedValueOnce({ status: 2, stdout: "" });
    const reader = new RemoteRepositoryReader({ runGit });
    const input = {
      access: access(),
      branch: "release/0.1",
      timeoutMs: 30_000,
      maxRefs: 10_000,
      maxOutputBytes: 8 * 1024 * 1024,
    };

    await expect(reader.resolveBranch(input)).resolves.toEqual({
      name: "release/0.1",
      ref: "refs/heads/release/0.1",
      commit: shaRelease,
    });
    expect(runGit).toHaveBeenNthCalledWith(1, expect.objectContaining({
      args: [
        "ls-remote",
        "--refs",
        "--exit-code",
        "--quiet",
        "https://github.com/example/repository.git",
        "refs/heads/release/0.1",
      ],
    }));
    await expect(reader.resolveBranch(input)).rejects.toMatchObject({
      code: "repository_unavailable",
    });
  });

  it("accepts an empty unborn repository without inventing HEAD", async () => {
    const reader = new RemoteRepositoryReader({
      runGit: async () => ({ status: 0, stdout: "" }),
    });
    await expect(reader.inspectBranches({
      access: access(), timeoutMs: 30_000, maxRefs: 10_000, maxOutputBytes: 1024,
    })).resolves.toEqual({ head: null, branches: [] });
  });

  it("rejects malformed, oversized, over-count and conflicting advertisements", async () => {
    const outputs = [
      `not-a-sha\trefs/heads/main\n`,
      `${shaMain}\trefs/tags/v1\n`,
      `${shaMain}\trefs/heads/main\n${shaRelease}\trefs/heads/main\n`,
      `${shaMain}\trefs/heads/main\n${shaRelease}\trefs/heads/release\n`,
      `${shaMain}\trefs/heads/main\n`,
    ];
    for (const [index, stdout] of outputs.entries()) {
      const reader = new RemoteRepositoryReader({
        runGit: async () => ({ status: 0, stdout }),
      });
      await expect(reader.inspectBranches({
        access: access(),
        timeoutMs: 30_000,
        maxRefs: index === 3 ? 1 : 10_000,
        maxOutputBytes: index === 4 ? 4 : 8 * 1024 * 1024,
      })).rejects.toBeInstanceOf(GitRemoteRepositoryError);
    }
  });

  it("redacts credentials and third-party stderr from stable failures", async () => {
    const secret = "ultra-private-token";
    const reader = new RemoteRepositoryReader({
      runGit: async () => ({ status: 128, stdout: "", stderr: `fatal: auth ${secret}` }),
    });
    let failure: unknown;
    try {
      await reader.inspectBranches({
        access: access(secret), timeoutMs: 30_000, maxRefs: 10_000, maxOutputBytes: 1024,
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: "repository_branches_unavailable" });
    expect(String(failure)).not.toContain(secret);
    expect(String(failure)).not.toContain("fatal: auth");
  });
});
