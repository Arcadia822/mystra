import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createRunnerRepoProviderRegistry } from "./repo-providers.js";

const tempDirs: string[] = [];

function repositoryTarget(
  projectId: string,
  provider: string,
  cloneUrl: string,
) {
  return {
    projectId,
    repository: {
      integration: provider,
      provider,
      externalId: `${provider}-repo`,
      fullName: "acme/project",
      url: cloneUrl.replace(/\.git$/, ""),
      cloneUrl,
      defaultBranch: "main",
      visibility: "private" as const,
      isArchived: false,
      fetchedAt: "2026-07-25T00:00:00.000Z",
    },
    defaultBaseBranch: "main",
  };
}

async function writeProviderModule(source: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "mystra-repo-provider-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, "provider.mjs");
  await writeFile(filePath, source, "utf8");
  return filePath;
}

describe("runner repo providers", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    }));
  });

  it("loads a startup-registered repo provider module and selects it by target host", async () => {
    const modulePath = await writeProviderModule(`
      export const repoProviders = {
        gitlab: {
          providerName: "gitlab",
          supports(repository) {
            return repository.provider === "gitlab";
          },
          async pushBranch(input) {
            return { status: "pushed", branchName: input.branchName };
          },
          async createReview() {
            return {
              status: "review_created",
              branch: { status: "pushed", branchName: "mystra/task-1" },
              review: {
                provider: "gitlab",
                url: "https://gitlab.example.com/group/project/-/merge_requests/1",
                number: 1,
                displayId: "!1",
              },
              metadata: {},
            };
          },
        },
      };
    `);

    const bundle = await createRunnerRepoProviderRegistry({
      builtinProviders: {},
      moduleSpecifiers: [modulePath],
    });

    expect(bundle.providerNames).toEqual(["gitlab"]);
    expect(bundle.registry.get("gitlab")?.providerName).toBe("gitlab");
    expect(bundle.registry.select(repositoryTarget(
      "00000000-0000-4000-8000-000000000301",
      "gitlab",
      "https://gitlab.example.com/group/project.git",
    ))?.providerName).toBe("gitlab");
  });

  it("selects an extension by the snapshot provider key", async () => {
    const modulePath = await writeProviderModule(`
      export default {
        github: {
          providerName: "github",
          supports(repository) {
            return repository.provider === "github";
          },
          async pushBranch(input) {
            return { status: "pushed", branchName: input.branchName };
          },
          async createReview() {
            return {
              status: "review_created",
              branch: { status: "pushed", branchName: "mystra/task-2" },
              review: {
                provider: "github",
                url: "https://github.com/acme/project/pull/2",
                number: 2,
                displayId: "#2",
              },
              metadata: {},
            };
          },
        },
      };
    `);

    const bundle = await createRunnerRepoProviderRegistry({
      builtinProviders: {},
      moduleSpecifiers: [modulePath],
    });

    expect(bundle.registry.select(repositoryTarget(
      "00000000-0000-4000-8000-000000000302",
      "github",
      "https://github.com/acme/project.git",
    ))?.providerName).toBe("github");
  });

  it("registers the built-in GitLab repo provider by default", async () => {
    const bundle = await createRunnerRepoProviderRegistry();

    expect(bundle.providerNames).toEqual(["gitlab", "github"]);
    expect(bundle.registry.select(repositoryTarget(
      "00000000-0000-4000-8000-000000000399",
      "gitlab",
      "https://gitlab.example.com/group/project.git",
    ))?.providerName).toBe("gitlab");
    expect(bundle.registry.select(repositoryTarget(
      "00000000-0000-4000-8000-000000000398",
      "github",
      "https://github.com/acme/project.git",
    ))?.providerName).toBe("github");
    expect(bundle.registry.select(repositoryTarget(
      "00000000-0000-4000-8000-000000000397",
      "unknown",
      "https://github.com/acme/project.git",
    ))).toBeUndefined();
  });

  it("rejects duplicate startup repo provider registrations", async () => {
    const firstModulePath = await writeProviderModule(`
      export const repoProviders = {
        gitlab: {
          providerName: "gitlab",
          supports() { return true; },
          async pushBranch(input) {
            return { status: "pushed", branchName: input.branchName };
          },
          async createReview() {
            return { status: "branch_pushed_no_review", branch: { status: "pushed", branchName: "mystra/task-3" }, metadata: {} };
          },
        },
      };
    `);
    const secondModulePath = await writeProviderModule(`
      export default {
        gitlab: {
          providerName: "gitlab",
          supports() { return true; },
          async pushBranch(input) {
            return { status: "pushed", branchName: input.branchName };
          },
          async createReview() {
            return { status: "branch_pushed_no_review", branch: { status: "pushed", branchName: "mystra/task-4" }, metadata: {} };
          },
        },
      };
    `);

    await expect(createRunnerRepoProviderRegistry({
      builtinProviders: {},
      moduleSpecifiers: [firstModulePath, secondModulePath],
    })).rejects.toThrow('Repo provider "gitlab" is already registered');
  });
});
