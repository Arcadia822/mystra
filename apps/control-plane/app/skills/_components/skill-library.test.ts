import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./skill-library.tsx", import.meta.url), "utf8");

describe("production Skill library composition", () => {
  it("uses shared UI primitives and canonical Skill APIs", () => {
    for (const primitive of ["UiSurface", "UiButton", "UiInput", "UiSelect", "UiDialogSurface", "ShellIcon"]) {
      expect(source).toContain(primitive);
    }
    expect(source).toContain("/api/skills");
    expect(source).not.toContain("<svg");
  });

  it("supports immutable Revision browsing, exact file preview, ZIP transfer and archive", () => {
    expect(source).toContain("Viewing immutable Revision");
    expect(source).toContain("Download ZIP");
    expect(source).toContain("New revision");
    expect(source).toContain('headers: { "if-match"');
    expect(source).toContain("window.confirm");
  });

  it("keeps upload validation and non-execution boundaries visible", () => {
    expect(source).toContain("validated in memory");
    expect(source).toContain("Every entry validated before publication");
    expect(source).toContain("never rendered or executed");
    expect(source).toContain('aria-live="polite"');
  });
});
