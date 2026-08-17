import { describe, expect, it } from "vitest";

import type { TaskListItem } from "../_lib/types";
import { activeTasks, filterTasks, groupTasksByProject, inboxTasks, selectedSearchTask } from "./shell-model";

function task(overrides: Partial<TaskListItem> = {}): TaskListItem {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    teamId: "00000000-0000-4000-8000-000000000002",
    title: "Sidebar collapse is missing",
    description: "Durable context",
    projectId: null,
    issue: null,
    status: "pending",
    metadata: {},
    statusRevision: 1,
    statusNote: null,
    statusUpdatedAt: "2026-08-05T00:00:00.000Z",
    statusActor: { kind: "system", actorId: null, agentId: null, attemptId: null, sessionId: null },
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T01:00:00.000Z",
    ...overrides,
  };
}

describe("shell task models", () => {
  it("searches title, description, exact Issue, Project, and ID fields", () => {
    const item = task({
      projectId: "00000000-0000-4000-8000-000000000010",
      issue: { provider: "github", connectionId: "00000000-0000-4000-8000-000000000011", scopeExternalId: "repo", externalId: "issue-42", identifier: "42" },
    });
    for (const query of ["issue-42", "sidebar", "durable", item.projectId!, item.id]) {
      expect(filterTasks([item], query)).toEqual([item]);
    }
    expect(filterTasks([item], "no match")).toEqual([]);
  });

  it("keeps Inbox empty while Session review persistence is unavailable", () => {
    expect(inboxTasks([task()])).toEqual([]);
  });

  it("keeps only the three non-terminal Task states in Active Tasks", () => {
    const rows = [
      task({ status: "pending" }),
      task({ id: "00000000-0000-4000-8000-000000000003", status: "in_progress" }),
      task({ id: "00000000-0000-4000-8000-000000000004", status: "blocked" }),
      task({ id: "00000000-0000-4000-8000-000000000005", status: "done" }),
      task({ id: "00000000-0000-4000-8000-000000000006", status: "canceled" }),
    ];
    expect(activeTasks(rows).map((item) => item.status)).toEqual(["pending", "in_progress", "blocked"]);
  });

  it("groups every Task exactly once and orders No project last", () => {
    const projectTask = task({ projectId: "00000000-0000-4000-8000-000000000010" });
    const standalone = task({ id: "00000000-0000-4000-8000-000000000004", updatedAt: "2026-08-05T02:00:00.000Z" });
    const groups = groupTasksByProject([standalone, projectTask]);
    expect(groups.map((group) => group.projectId)).toEqual([projectTask.projectId, null]);
    expect(groups.flatMap((group) => group.tasks).map((item) => item.id).sort()).toEqual([projectTask.id, standalone.id].sort());
  });

  it("previews only the explicitly selected search result", () => {
    const item = task();
    expect(selectedSearchTask([item], undefined)).toBeUndefined();
    expect(selectedSearchTask([item], "missing")).toBeUndefined();
    expect(selectedSearchTask([item], item.id)).toBe(item);
  });
});
