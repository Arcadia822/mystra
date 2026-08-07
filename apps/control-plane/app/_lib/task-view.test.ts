import { describe, expect, it } from "vitest";

import { taskTitle } from "./task-view";

const task = {
  id: "00000000-0000-4000-8000-000000000040",
  projectId: "00000000-0000-4000-8000-000000000041",
  metadata: {},
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:00.000Z",
};

describe("Task view projection", () => {
  it("uses a validated generic title without restoring removed persistence fields", () => {
    const withMetadata = {
      ...task,
      metadata: { title: "Repair build" },
    };

    expect(taskTitle(withMetadata)).toBe("Repair build");
  });

  it("falls back to the dispatch key and stable task identifier", () => {
    expect(taskTitle({ ...task, issueDispatchKey: "linear:MYS-43" })).toBe("linear:MYS-43");
    expect(taskTitle(task)).toBe("Task 00000000");
  });
});
