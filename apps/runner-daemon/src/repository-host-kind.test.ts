import { describe, expect, it } from "vitest";

import { detectRepositoryHostKind } from "./repository-host-kind.js";

describe("detectRepositoryHostKind", () => {
  it("detects GitLab SSH remotes from the configured HTTP base host", () => {
    expect(detectRepositoryHostKind(
      "ssh://git@git.cloudwise.com:36000/castrel/castrel-ai.git",
      { gitlabHttpBaseUrl: "https://git.cloudwise.com" },
    )).toBe("gitlab");
  });

  it("detects GitHub SCP-style remotes from the configured HTTP base host", () => {
    expect(detectRepositoryHostKind(
      "git@github.enterprise.example:acme/project.git",
      { githubHttpBaseUrl: "https://github.enterprise.example" },
    )).toBe("github");
  });

  it("falls back to provider keywords for standard public remotes", () => {
    expect(detectRepositoryHostKind("https://gitlab.example.com/group/project.git")).toBe("gitlab");
    expect(detectRepositoryHostKind("https://github.com/acme/project.git")).toBe("github");
  });

  it("returns unknown for hosts that do not map to a configured provider", () => {
    expect(detectRepositoryHostKind("ssh://git@example.internal:2222/acme/project.git")).toBe("unknown");
  });
});
