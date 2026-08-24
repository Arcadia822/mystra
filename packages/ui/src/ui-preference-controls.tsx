import type { KeyboardEvent, ReactNode } from "react";
import { UiButton } from "./ui-actions.js";
import { UiInput } from "./ui-fields.js";

export interface UiSegmentedOption<T extends string> { icon?: ReactNode; label: string; value: T }
export function UiSegmented<T extends string>({ "aria-label": ariaLabel, options, role = "group", value, onValueChange }: {
  "aria-label": string;
  options: readonly UiSegmentedOption<T>[];
  role?: "group" | "tablist";
  value: T;
  onValueChange: (value: T) => void;
}) {
  const tabs = role === "tablist";

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!tabs) return;
    const currentIndex = options.findIndex((option) => option.value === value);
    if (currentIndex < 0) return;

    const direction = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? options.length - 1
        : direction
          ? (currentIndex + direction + options.length) % options.length
          : -1;
    if (nextIndex < 0) return;

    event.preventDefault();
    const next = options[nextIndex]!;
    onValueChange(next.value);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  }

  return <div aria-label={ariaLabel} className="uiSegmented" onKeyDown={onKeyDown} role={role}>{options.map((option) => {
    const selected = option.value === value;
    return (
      <UiButton
        active={selected}
        aria-pressed={tabs ? undefined : selected}
        aria-selected={tabs ? selected : undefined}
        className="uiSegmentedOption"
        key={option.value}
        onClick={() => onValueChange(option.value)}
        role={tabs ? "tab" : undefined}
        size="compact"
        tabIndex={tabs ? selected ? 0 : -1 : undefined}
        tone="ghost"
      >
        {option.icon}{option.label}
      </UiButton>
    );
  })}</div>;
}

export function UiRange({ label, max, min, onValueChange, value, valueDisplay = value }: {
  label: string; max: number; min: number; onValueChange: (value: number) => void; value: number; valueDisplay?: ReactNode;
}) {
  return <label className="uiRange"><span className="srOnly">{label}</span><UiInput aria-label={label} max={max} min={min} onChange={(event) => onValueChange(Number(event.currentTarget.value))} type="range" value={value} /><output>{valueDisplay}</output></label>;
}
