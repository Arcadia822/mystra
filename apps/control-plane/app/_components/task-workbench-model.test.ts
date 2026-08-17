import { describe, expect, it } from "vitest";

import { getVisibleTaskProperties, TASK_STATUS_ORDER, taskPageUrl } from "./task-workbench-model";

describe("Task workbench model", () => {
  it("keeps the approved five-column identity and default property visibility", () => {
    expect(TASK_STATUS_ORDER).toEqual(["pending", "in_progress", "blocked", "done", "canceled"]);
    expect(getVisibleTaskProperties({ taskid: false, issue: true, updated: false })).toEqual([
      "status", "name", "project", "issue", "metadata", "created",
    ]);
  });

  it("serializes repeatable status filters and binds cursor paging to the same query", () => {
    const url = taskPageUrl({ query: " FrontEnd ", statuses: ["blocked", "pending"], sort: "title", direction: "asc", cursor: "opaque" });
    const parsed = new URL(url, "http://localhost");
    expect(parsed.searchParams.getAll("status")).toEqual(["blocked", "pending"]);
    expect(parsed.searchParams.get("query")).toBe("FrontEnd");
    expect(parsed.searchParams.get("cursor")).toBe("opaque");
  });
});
