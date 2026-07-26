import { describe, expect, it } from "vitest";

import { canSubmitProject, type ProjectDraft } from "./project-create-model";

const draft: ProjectDraft = {
  name: "Fixture",
  slug: "fixture",
  integration: "github",
  repository: "arcadia/mystra-fixture",
  agent: "copilot",
  runtimeImage: "mystra-copilot:fixture",
};

describe("Project create form model", () => {
  it("requires a repository returned by the selected Integration", () => {
    expect(canSubmitProject({
      draft,
      repositoryIdentifiers: [],
      isSubmitting: false,
    })).toBe(false);
    expect(canSubmitProject({
      draft,
      repositoryIdentifiers: [draft.repository],
      isSubmitting: false,
    })).toBe(true);
  });

  it("prevents empty fields and double submission", () => {
    expect(canSubmitProject({
      draft: { ...draft, runtimeImage: "" },
      repositoryIdentifiers: [draft.repository],
      isSubmitting: false,
    })).toBe(false);
    expect(canSubmitProject({
      draft,
      repositoryIdentifiers: [draft.repository],
      isSubmitting: true,
    })).toBe(false);
  });
});
