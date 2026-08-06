import { describe, expect, it } from "vitest";

import { edgeEnabledDropdownIndex, nextEnabledDropdownIndex } from "./ui-dropdown-model";

const options = [
  { value: "a", label: "A" },
  { value: "b", label: "B", disabled: true },
  { value: "c", label: "C" },
];

describe("UiDropdown keyboard index model", () => {
  it("wraps across enabled options and skips disabled entries", () => {
    expect(nextEnabledDropdownIndex(options, 0, 1)).toBe(2);
    expect(nextEnabledDropdownIndex(options, 2, 1)).toBe(0);
    expect(nextEnabledDropdownIndex(options, 0, -1)).toBe(2);
  });

  it("resolves Home and End to the first and last enabled entries", () => {
    const onlyDisabledOptions = [{ value: "x", label: "X", disabled: true }];

    expect(edgeEnabledDropdownIndex(options, "first")).toBe(0);
    expect(edgeEnabledDropdownIndex(options, "last")).toBe(2);
    expect(edgeEnabledDropdownIndex(onlyDisabledOptions, "first")).toBe(-1);
  });
});
