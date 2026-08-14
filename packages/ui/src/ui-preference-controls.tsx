import type { ReactNode } from "react";
import { UiButton } from "./ui-actions.js";
import { UiInput } from "./ui-fields.js";

export interface UiSegmentedOption<T extends string> { icon?: ReactNode; label: string; value: T }
export function UiSegmented<T extends string>({ "aria-label": ariaLabel, options, value, onValueChange }: {
  "aria-label": string;
  options: Array<UiSegmentedOption<T>>;
  value: T;
  onValueChange: (value: T) => void;
}) {
  return <div aria-label={ariaLabel} className="uiSegmented" role="group">{options.map((option) => (
    <UiButton active={option.value === value} aria-pressed={option.value === value} className="uiSegmentedOption" key={option.value} onClick={() => onValueChange(option.value)} size="compact" tone="ghost">
      {option.icon}{option.label}
    </UiButton>
  ))}</div>;
}

export function UiRange({ label, max, min, onValueChange, value, valueDisplay = value }: {
  label: string; max: number; min: number; onValueChange: (value: number) => void; value: number; valueDisplay?: ReactNode;
}) {
  return <label className="uiRange"><span className="srOnly">{label}</span><UiInput aria-label={label} max={max} min={min} onChange={(event) => onValueChange(Number(event.currentTarget.value))} type="range" value={value} /><output>{valueDisplay}</output></label>;
}
