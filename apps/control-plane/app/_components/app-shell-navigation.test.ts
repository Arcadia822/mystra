import { describe, expect, it } from "vitest";

import { PRIMARY_ITEMS } from "./shell-navigation";

describe("AppShell Issue navigation", () => {
  it("routes primary Issues to Project-first browsing and keeps Task routes separate", () => {
    expect(PRIMARY_ITEMS.find((item) => item.key === "issues")?.href).toBe("/issues");
    expect(PRIMARY_ITEMS.some((item) => item.href === "/tasks")).toBe(false);
  });
});
