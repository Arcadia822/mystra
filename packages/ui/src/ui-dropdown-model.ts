export interface DropdownIndexOption { disabled?: boolean }

export interface DropdownFloatingRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface DropdownFloatingPositionInput {
  align: "start" | "end";
  anchor: DropdownFloatingRect;
  gap: number;
  margin: number;
  menuHeight: number;
  menuWidth: number;
  viewportHeight: number;
  viewportWidth: number;
}

export interface DropdownFloatingPosition {
  left: number;
  maxHeight: number;
  top: number;
}

export function resolveDropdownFloatingPosition({
  align,
  anchor,
  gap,
  margin,
  menuHeight,
  menuWidth,
  viewportHeight,
  viewportWidth,
}: DropdownFloatingPositionInput): DropdownFloatingPosition {
  const availableBelow = Math.max(0, viewportHeight - anchor.bottom - gap - margin);
  const availableAbove = Math.max(0, anchor.top - gap - margin);
  const placeAbove = availableBelow < menuHeight && availableAbove > availableBelow;
  const maxHeight = placeAbove ? availableAbove : availableBelow;
  const renderedHeight = Math.min(menuHeight, maxHeight);
  const desiredLeft = align === "end" ? anchor.right - menuWidth : anchor.left;
  const maximumLeft = Math.max(margin, viewportWidth - margin - menuWidth);

  return {
    left: Math.min(Math.max(margin, desiredLeft), maximumLeft),
    maxHeight,
    top: placeAbove ? Math.max(margin, anchor.top - gap - renderedHeight) : anchor.bottom + gap,
  };
}

export function nextEnabledDropdownIndex(options: readonly DropdownIndexOption[], currentIndex: number, direction: 1 | -1): number {
  if (options.length === 0) return -1;
  let nextIndex = currentIndex;
  for (let attempts = 0; attempts < options.length; attempts += 1) {
    nextIndex = (nextIndex + direction + options.length) % options.length;
    if (!options[nextIndex]?.disabled) return nextIndex;
  }
  return -1;
}
export function edgeEnabledDropdownIndex(options: readonly DropdownIndexOption[], edge: "first" | "last"): number {
  return edge === "first" ? options.findIndex((option) => !option.disabled) : options.findLastIndex((option) => !option.disabled);
}
