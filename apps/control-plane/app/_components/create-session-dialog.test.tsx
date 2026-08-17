import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./create-session-dialog.tsx", import.meta.url), "utf8");

describe("CreateSessionDialog composition", () => {
  it("renders only Prompt and Provider inputs with canonical copy", () => {
    expect(source).toContain("Create Session");
    expect(source).toContain('aria-label="Prompt"');
    expect(source).toContain('aria-label="Provider"');
    expect(source).toContain("Session-only context, constraints, or a specific focus");
    expect(source).toContain('from "@mystra/shared/session"');
    expect(source).toContain('import type { RuntimeView, Session, Task, TaskWorkspaceView } from "@mystra/shared"');
    expect(source).toContain("manualContext: { text: prompt.trim() }");
    expect(source).not.toContain('aria-label="Runtime"');
    expect(source).not.toContain('aria-label="Agent Context"');
    expect(source).not.toContain(">Cancel<");
    expect(source).not.toContain("Launch Session");
  });

  it("keeps precondition/API errors in the modal and restores trigger focus on close", () => {
    expect(source).toContain('workspace?.state !== "ready"');
    expect(source).toContain("providers.length === 0");
    expect(source).toContain("setError(caught instanceof Error");
    expect(source).toContain("triggerRef.current?.focus()");
    expect(source).toContain('event.key !== "Escape"');
    expect(source).toContain("event.target === event.currentTarget");
  });
});
