import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./task-list.tsx", import.meta.url), "utf8");

describe("StackedList equal-width measurement lifecycle", () => {
  it("remeasures when displayed cells are inserted or removed", () => {
    expect(source).toContain("new MutationObserver(measure)");
    expect(source).toContain("mutationObserver.observe(root, { childList: true, subtree: true })");
    expect(source).toContain("mutationObserver.disconnect()");
  });
});
