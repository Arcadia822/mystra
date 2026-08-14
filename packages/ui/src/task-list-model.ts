export const STANDARD_STACKED_LIST_RENDER_TYPES = ["text", "datetime", "icon", "labels"] as const;

export type StackedListStandardRenderType = typeof STANDARD_STACKED_LIST_RENDER_TYPES[number];
export type StackedListFieldAlignment = "left" | "right";

interface StackedListFieldDefinitionBase {
  key: string;
  align: StackedListFieldAlignment;
  equalWidth?: boolean;
}

export interface StackedListStandardFieldDefinition extends StackedListFieldDefinitionBase {
  renderType: StackedListStandardRenderType;
}

export interface StackedListCustomFieldDefinition extends StackedListFieldDefinitionBase {
  renderType: "custom";
}

export type StackedListFieldDefinition = StackedListStandardFieldDefinition | StackedListCustomFieldDefinition;

export function getStackedListFieldPresentation(field: StackedListFieldDefinition): {
  className: "uiStackedListText" | "uiStackedListIcon" | "uiStackedListLabels" | null;
  equalWidth: boolean;
} {
  const equalWidth = field.equalWidth ?? field.renderType === "icon";
  if (field.renderType === "text" || field.renderType === "datetime") {
    return { className: "uiStackedListText", equalWidth };
  }
  if (field.renderType === "icon") return { className: "uiStackedListIcon", equalWidth };
  if (field.renderType === "labels") return { className: "uiStackedListLabels", equalWidth };
  return { className: null, equalWidth };
}

export function resolveVisibleLabelCount({
  availableWidth,
  gap,
  itemWidths,
  overflowWidth,
}: {
  availableWidth: number;
  gap: number;
  itemWidths: readonly number[];
  overflowWidth: number;
}): number {
  const fullWidth = itemWidths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, itemWidths.length - 1);
  if (fullWidth <= availableWidth) return itemWidths.length;

  let prefixWidth = 0;
  let visibleCount = 0;
  for (let index = 0; index < itemWidths.length; index += 1) {
    const nextPrefixWidth = prefixWidth + (index > 0 ? gap : 0) + itemWidths[index]!;
    const widthWithOverflow = nextPrefixWidth + gap + overflowWidth;
    if (widthWithOverflow > availableWidth) break;
    prefixWidth = nextPrefixWidth;
    visibleCount = index + 1;
  }
  return visibleCount;
}
