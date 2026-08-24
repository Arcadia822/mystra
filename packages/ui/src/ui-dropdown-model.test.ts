import { describe, expect, it } from "vitest";

import { resolveDropdownFloatingPosition, resolveDropdownPortalHost, showDropdownInTopLayer } from "./ui-dropdown-model.js";

describe("resolveDropdownPortalHost", () => {
  it("keeps a dialog-owned dropdown in the dialog top-layer subtree", () => {
    const dialog = {} as Element;
    const body = {} as Element;

    expect(resolveDropdownPortalHost({ closest: () => dialog }, body)).toBe(dialog);
    expect(resolveDropdownPortalHost({ closest: () => null }, body)).toBe(body);
    expect(resolveDropdownPortalHost(null, body)).toBe(body);
  });
});

describe("showDropdownInTopLayer", () => {
  it("promotes a closed dropdown menu into the browser top layer", () => {
    let showCount = 0;

    expect(showDropdownInTopLayer({
      matches: () => false,
      showPopover: () => { showCount += 1; },
    })).toBe(true);
    expect(showCount).toBe(1);
  });

  it("does not reopen an existing popover or require unsupported browsers to expose the API", () => {
    let showCount = 0;

    expect(showDropdownInTopLayer({
      matches: () => true,
      showPopover: () => { showCount += 1; },
    })).toBe(false);
    expect(showDropdownInTopLayer({ matches: () => false })).toBe(false);
    expect(showCount).toBe(0);
  });
});

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
