import { describe, expect, it } from "vitest";

import {
  canSubmitProject,
  changeProjectConnection,
  defaultProjectConnectionId,
  type ProjectDraft,
} from "./project-create-model";

const draft: ProjectDraft = {
  name: "Fixture",
  slug: "fixture",
  integration: "github",
  connectionId: "00000000-0000-4000-8000-000000000041",
  repository: "arcadia/mystra-fixture",
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
      draft: { ...draft, connectionId: "" },
      repositoryIdentifiers: [draft.repository],
      isSubmitting: false,
    })).toBe(false);
    expect(canSubmitProject({
      draft,
      repositoryIdentifiers: [draft.repository],
      isSubmitting: true,
    })).toBe(false);
  });

  it("preselects exactly one active connection and requires confirmation for multiple", () => {
    expect(defaultProjectConnectionId([draft.connectionId])).toBe(draft.connectionId);
    expect(defaultProjectConnectionId([draft.connectionId, "00000000-0000-4000-8000-000000000042"]))
      .toBe("");
  });

  it("clears repository state when the selected connection changes", () => {
    expect(changeProjectConnection(draft, "00000000-0000-4000-8000-000000000042")).toEqual({
      ...draft,
      connectionId: "00000000-0000-4000-8000-000000000042",
      repository: "",
    });
  });
});
