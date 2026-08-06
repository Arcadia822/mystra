export interface DropdownIndexOption {
  disabled?: boolean;
}

export function nextEnabledDropdownIndex(
  options: readonly DropdownIndexOption[],
  currentIndex: number,
  direction: 1 | -1,
): number {
  if (options.length === 0) return -1;
  let nextIndex = currentIndex;
  for (let attempts = 0; attempts < options.length; attempts += 1) {
    nextIndex = (nextIndex + direction + options.length) % options.length;
    if (!options[nextIndex]?.disabled) return nextIndex;
  }
  return -1;
}

export function edgeEnabledDropdownIndex(
  options: readonly DropdownIndexOption[],
  edge: "first" | "last",
): number {
  if (edge === "first") return options.findIndex((option) => !option.disabled);
  return options.findLastIndex((option) => !option.disabled);
}
