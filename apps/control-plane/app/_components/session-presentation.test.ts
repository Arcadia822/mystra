import { describe, expect, it } from "vitest";

import type { SessionEvent } from "@mystra/shared";
import { mergeSessionEvents, presentSessionEvent, sessionStateLabel, shouldPollSession } from "./session-presentation";

const base = {
  sessionId: "00000000-0000-4000-8000-000000000001",
  sourceId: "test",
  sourceSequence: 1,
  kind: "session.response_started" as const,
  version: 1 as const,
  payload: {},
  metadata: {},
  occurredAt: "2026-08-10T00:00:00.000Z",
  acceptedAt: "2026-08-10T00:00:00.000Z",
};

function event(sequence: number): SessionEvent {
  return { ...base, eventId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`, globalSequence: sequence };
}

describe("Session event presentation", () => {
  it("keeps ready distinct from terminal states and polling states", () => {
    expect(sessionStateLabel("ready", "zh-CN")).toContain("可继续");
    expect(sessionStateLabel("closed", "zh-CN")).toBe("已关闭");
    expect(shouldPollSession("running")).toBe(true);
    expect(shouldPollSession("running", true)).toBe(false);
    expect(shouldPollSession("ready")).toBe(false);
    expect(shouldPollSession("failed")).toBe(false);
  });

  it("merges by eventId and sorts by globalSequence", () => {
    expect(mergeSessionEvents([event(2)], [event(1), event(2)]).map((item) => item.globalSequence)).toEqual([1, 2]);
  });

  it("redacts sensitive domain facts and safely labels unknown events", () => {
    const prompt = presentSessionEvent({ ...event(1), kind: "session.system_prompt_configured", payload: { finalPrompt: "do not expose" } }, "en");
    expect(JSON.stringify(prompt)).not.toContain("do not expose");
    const workspace = presentSessionEvent({ ...event(1), kind: "session.workspace_attached", payload: { workspaceRef: "/private/path" } }, "en");
    expect(JSON.stringify(workspace)).not.toContain("/private/path");
    expect(presentSessionEvent({ ...event(1), kind: "session.future_event" }, "en").title).toContain("Unknown event");
  });
});
