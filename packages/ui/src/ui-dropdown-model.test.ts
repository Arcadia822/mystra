import { describe, expect, it } from "vitest";

import { resolveDropdownFloatingPosition } from "./ui-dropdown-model.js";

describe("resolveDropdownFloatingPosition", () => {
  it("keeps a start-aligned menu beside its trigger without a preset width", () => {
    expect(resolveDropdownFloatingPosition({
      align: "start",
      anchor: { bottom: 128, left: 24, right: 124, top: 100 },
      gap: 4,
      margin: 8,
      menuHeight: 96,
      menuWidth: 148,
      viewportHeight: 600,
      viewportWidth: 800,
    })).toEqual({ left: 24, maxHeight: 460, top: 132 });
  });

  it("flips above the trigger and clamps the menu to the viewport", () => {
    expect(resolveDropdownFloatingPosition({
      align: "end",
      anchor: { bottom: 588, left: 720, right: 792, top: 560 },
      gap: 4,
      margin: 8,
      menuHeight: 160,
      menuWidth: 180,
      viewportHeight: 600,
      viewportWidth: 800,
    })).toEqual({ left: 612, maxHeight: 548, top: 396 });
  });
});
