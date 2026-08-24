import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./skill-library-prototype.tsx", import.meta.url), "utf8");

describe("056 Skill library prototype composition", () => {
  it("reuses the shared shell, surfaces, actions, fields and icons", () => {
    expect(source).toContain("PrototypeShell");
    expect(source).toContain("UiSurface");
    expect(source).toContain("UiButton");
    expect(source).toContain("UiInput");
    expect(source).toContain("UiSelect");
    expect(source).toContain("ShellIcon");
    expect(source).not.toContain("<svg");
  });

  it("keeps revision identity visible during file preview", () => {
    expect(source).toContain("Viewing immutable Revision");
    expect(source).toContain("Revision {selectedRevision.sequence}");
    expect(source).toContain("Download ZIP");
  });

  it("states the safe upload and preview boundaries", () => {
    expect(source).toContain("Every entry validated before publication");
    expect(source).toContain("no temporary extraction");
    expect(source).toContain("does not render or execute uploaded content");
    expect(source).toContain('aria-live="polite"');
  });
});
