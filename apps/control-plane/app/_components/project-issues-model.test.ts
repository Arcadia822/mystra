import { describe, expect, it } from "vitest";

import {
  createProjectIssuesBrowseState,
  hasSelectedProject,
  resetProjectIssuesBrowseState,
  selectProjectIssuesProvider,
} from "./project-issues-model";

describe("Project Issues browse state", () => {
  it("keeps provider state separate while switching providers", () => {
    const initial = createProjectIssuesBrowseState("mystra");
    const paged = { ...initial, github: { ...initial.github, after: "github-cursor" } };
    const selected = selectProjectIssuesProvider(paged, "linear");
    expect(selected.github.after).toBe("github-cursor");
    expect(selected.linear.after).toBeUndefined();
  });

  it("clears both provider states when Project changes", () => {
    const initial = createProjectIssuesBrowseState("mystra");
    const changed = resetProjectIssuesBrowseState({
      ...initial,
      linear: { ...initial.linear, after: "linear-cursor" },
    }, "castrel");
    expect(changed.projectSlug).toBe("castrel");
    expect(changed.linear.after).toBeUndefined();
  });

  it("does not enable remote Issue browsing before Project selection", () => {
    expect(hasSelectedProject("")).toBe(false);
    expect(hasSelectedProject("mystra")).toBe(true);
  });
});
