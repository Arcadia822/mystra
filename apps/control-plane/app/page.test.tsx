import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Overview root", () => {
  it("renders the 053 replacement seam without turning New Task into a landing page", () => {
    const source = read("./page.tsx");
    expect(source).toContain("Overview is being prepared in Spec 053.");
    expect(source).not.toContain("redirect(");
    expect(source).not.toContain("NewTaskComposer");
  });

  it("keeps the obsolete /new page non-navigable", () => {
    expect(existsSync(new URL("./new/page.tsx", import.meta.url))).toBe(false);
  });
});
