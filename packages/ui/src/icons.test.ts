import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TaskStatusIcon, type TaskStatus } from "./icons.js";

function renderStatus(status: TaskStatus): string {
  return renderToStaticMarkup(createElement(TaskStatusIcon, { status }));
}

describe("TaskStatusIcon", () => {
  it("renders the same circular base for every production status", () => {
    for (const status of ["pending", "in_progress", "blocked", "done", "canceled"] satisfies TaskStatus[]) {
      expect(renderStatus(status)).toContain('class="taskStatusBase" cx="12" cy="12" r="9"');
    }
  });

  it("renders a half-circle progress fill", () => {
    expect(renderStatus("in_progress")).toContain('class="taskStatusProgress" d="M12 3a9 9 0 0 1 0 18Z"');
  });

  it("renders a distinct mark for handoff, completed and canceled", () => {
    expect(renderStatus("blocked")).toContain('class="taskStatusMark taskStatusHandoffMark"');
    expect(renderStatus("done")).toContain('class="taskStatusMark taskStatusDoneMark"');
    expect(renderStatus("canceled")).toContain('class="taskStatusMark taskStatusCanceledMark"');
  });
});
