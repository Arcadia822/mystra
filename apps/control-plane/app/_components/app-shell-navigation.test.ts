import { describe, expect, it } from "vitest";

import { PRIMARY_ITEMS } from "./shell-navigation";

describe("AppShell primary navigation", () => {
  it("keeps Overview, Inbox, Tasks, and Runtimes primary while global actions remain outside navigation", () => {
    expect(PRIMARY_ITEMS).toEqual([
      expect.objectContaining({ key: "overview", href: "/" }),
      expect.objectContaining({ key: "inbox", href: "/inbox" }),
      expect.objectContaining({ key: "tasks", href: "/tasks" }),
      expect.objectContaining({ key: "runtimes", href: "/runners" }),
    ]);
    expect(PRIMARY_ITEMS.some((item) => item.href === "/issues" || item.href === "/new")).toBe(false);
  });
});
