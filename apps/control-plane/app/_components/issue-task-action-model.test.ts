import { describe, expect, it } from "vitest";

import {
  issueTaskActionFailed,
  issueTaskActionInitial,
  issueTaskActionStarted,
  issueTaskActionSucceeded,
} from "./issue-task-action-model";

describe("Issue Task row action", () => {
  it("transitions Create → creating → Open Task without a navigation instruction", () => {
    expect(issueTaskActionInitial()).toEqual({ status: "idle" });
    expect(issueTaskActionStarted()).toEqual({ status: "creating" });
    const linked = issueTaskActionSucceeded("task-1");
    expect(linked).toEqual({ status: "linked", taskId: "task-1" });
    expect(linked).not.toHaveProperty("navigate");
  });

  it("exposes an error that can be retried", () => {
    expect(issueTaskActionFailed("Provider unavailable")).toEqual({ status: "error", message: "Provider unavailable" });
  });
});
