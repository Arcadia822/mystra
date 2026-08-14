import { describe, expect, it } from "vitest";

import { getVisibleTaskProperties } from "./task-workbench-model";

describe("054 task property visibility", () => {
  it("keeps the canonical default fields in both layouts", () => {
    expect(getVisibleTaskProperties({ taskid: false, issue: true, updated: false })).toEqual([
      "status",
      "name",
      "project",
      "issue",
      "metadata",
      "created",
    ]);
  });

  it("adds Task ID, Issue, and Updated At when their shared Display controls are enabled", () => {
    expect(getVisibleTaskProperties({ taskid: true, issue: true, updated: true })).toEqual([
      "status",
      "taskid",
      "name",
      "project",
      "issue",
      "metadata",
      "updated",
      "created",
    ]);
  });
});
