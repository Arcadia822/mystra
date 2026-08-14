import { describe, expect, it } from "vitest";

import {
  getStackedListFieldPresentation,
  resolveVisibleLabelCount,
  STANDARD_STACKED_LIST_RENDER_TYPES,
  type StackedListCustomFieldDefinition,
  type StackedListStandardFieldDefinition,
} from "./task-list-model.js";

// @ts-expect-error Standard fields reject render types outside the shared whitelist.
const invalidStandardField = { key: "progress", align: "right", renderType: "progress" } satisfies StackedListStandardFieldDefinition;
void invalidStandardField;

describe("resolveVisibleLabelCount", () => {
  it("keeps every label when the row fits", () => {
    expect(resolveVisibleLabelCount({ availableWidth: 180, gap: 8, itemWidths: [40, 48, 52], overflowWidth: 30 })).toBe(3);
  });

  it("reserves room for the overflow trigger", () => {
    expect(resolveVisibleLabelCount({ availableWidth: 132, gap: 8, itemWidths: [40, 48, 52], overflowWidth: 30 })).toBe(1);
  });

  it("shows only the overflow trigger when no label fits completely", () => {
    expect(resolveVisibleLabelCount({ availableWidth: 70, gap: 8, itemWidths: [52, 52], overflowWidth: 30 })).toBe(0);
  });
});

describe("standard stacked field presentation", () => {
  it("exposes only the standard render types", () => {
    expect(STANDARD_STACKED_LIST_RENDER_TYPES).toEqual(["text", "datetime", "icon", "labels"]);
  });

  it("uses one text presentation for text and datetime values", () => {
    const text: StackedListStandardFieldDefinition = { key: "taskid", align: "left", renderType: "text" };
    const datetime: StackedListStandardFieldDefinition = { key: "created", align: "right", renderType: "datetime" };

    expect(getStackedListFieldPresentation(text).className).toBe("uiStackedListText");
    expect(getStackedListFieldPresentation(datetime).className).toBe("uiStackedListText");
  });

  it("makes icon fields equal-width by default", () => {
    const icon: StackedListStandardFieldDefinition = { key: "status", align: "left", renderType: "icon" };

    expect(getStackedListFieldPresentation(icon).equalWidth).toBe(true);
  });

  it("allows explicit custom fields without expanding the standard render type enum", () => {
    const custom: StackedListCustomFieldDefinition = { key: "progress", align: "right", renderType: "custom" };

    expect(getStackedListFieldPresentation(custom).className).toBeNull();
  });
});
