import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./session-business-state-prototype.tsx", import.meta.url), "utf8");

describe("055 Session business state prototype composition", () => {
  it("reuses the shared shell and UI surfaces", () => {
    expect(source).toContain("PrototypeShell");
    expect(source).toContain("UiSurface");
    expect(source).toContain("UiSurfaceHeader");
    expect(source).toContain("UiSurfaceBody");
    expect(source).toContain("UiButton");
    expect(source).not.toContain("<svg");
  });

  it("keeps technical phases in an explicitly internal-only section", () => {
    expect(source).toContain("Internal execution facts");
    expect(source).toContain("Diagnostic only · not Session state");
    expect(source).toContain("internalSessionExecutionFacts.map");
  });

  it("announces state changes and preserves independent object boundaries", () => {
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Task, TaskExecutionContext, Workspace, and Runtime state remain independent");
  });
});
