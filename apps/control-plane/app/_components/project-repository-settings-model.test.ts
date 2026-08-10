import { describe, expect, it } from "vitest";

import {
  branchReadFailed,
  branchReadLoaded,
  createProjectRepositorySettingsModel,
  validateProjectRepositoryBaseBranch,
} from "./project-repository-settings-model";

describe("Project repository settings model", () => {
  it("keeps the configured branch independent from symbolic HEAD observations", () => {
    const initial = createProjectRepositorySettingsModel("release/0.1");
    const loaded = branchReadLoaded(initial, {
      branches: [
        { name: "main", ref: "refs/heads/main", commit: "a".repeat(40) },
        { name: "release/0.1", ref: "refs/heads/release/0.1", commit: "b".repeat(40) },
      ],
      head: { name: "main", ref: "refs/heads/main", commit: "a".repeat(40) },
      pageInfo: { hasNextPage: false, endCursor: null },
    });
    expect(loaded.mode).toBe("picker");
    expect(loaded.value).toBe("release/0.1");
    expect(loaded.observedHead).toBe("main");
  });

  it("degrades branch-read failure to editable text without clearing configuration", () => {
    const failed = branchReadFailed(createProjectRepositorySettingsModel("develop"));
    expect(failed).toMatchObject({ mode: "text", value: "develop" });
    expect(validateProjectRepositoryBaseBranch("feature/valid")).toBeNull();
    expect(validateProjectRepositoryBaseBranch("bad branch")).toBeTruthy();
  });
});
