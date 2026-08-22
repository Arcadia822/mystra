import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("Inbox root", () => {
  it("renders only the shared centered placeholder without fetching review data", () => {
    expect(source).toContain('<PagePlaceholder label="Inbox" />');
    expect(source).not.toContain("useShellTasks");
    expect(source).not.toContain("InboxMasterDetail");
  });
});
