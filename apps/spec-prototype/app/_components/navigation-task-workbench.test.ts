import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./navigation-task-workbench.tsx", import.meta.url), "utf8");
const kanbanSource = source.slice(source.indexOf('<div className="boardViewport">'));

describe("054 Kanban property rendering contract", () => {
  it("shows Issue by default while keeping it user-configurable", () => {
    expect(source).toContain("{ taskid: false, issue: true, updated: false }");
  });

  it("renders Task ID data from the shared visible property state", () => {
    expect(kanbanSource).toContain('visibleProperties.has("taskid")');
    expect(kanbanSource).toContain('<span className="boardCardTaskId">{task.id}</span>');
  });

  it("applies the same visible property state to Issue and Updated At", () => {
    expect(source).toContain('visibleProperties.has("issue") && task.issue');
    expect(kanbanSource).toContain('visibleProperties.has("updated")');
    expect(kanbanSource).toContain('<TaskLabels task={task} visibleProperties={visibleProperties} />');
  });

  it("keeps every default field in each card", () => {
    expect(kanbanSource).toContain('<TaskStatusIcon status={task.status} />');
    expect(kanbanSource).toContain('className="boardCardPrimaryLink"');
    expect(kanbanSource).toContain("{task.title}</UiActionAnchor>");
    expect(kanbanSource).toContain('<small>Created</small><TaskDate value={task.createdAt} />');
  });

  it("opens the same Task detail route from table and Kanban", () => {
    expect(source).toContain("onClick={() => openTask(task.id)}");
    expect(kanbanSource).toContain('className="boardCardPrimaryLink"');
  });
});
