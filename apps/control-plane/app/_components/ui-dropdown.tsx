"use client";

import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { UiButton } from "./ui-actions";
import { ShellIcon } from "./shell-icons";
import { edgeEnabledDropdownIndex, nextEnabledDropdownIndex } from "./ui-dropdown-model";

export interface UiDropdownOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface UiDropdownProps {
  "aria-label": string;
  align?: "start" | "end";
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
  onValueChange: (value: string) => void;
  options: UiDropdownOption[];
  placeholder: string;
  value: string;
}

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function UiDropdown({
  "aria-label": ariaLabel,
  align = "start",
  className,
  disabled = false,
  icon,
  onValueChange,
  options,
  placeholder,
  value,
}: UiDropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    if (!open) return;
    const initialIndex = selectedIndex >= 0 ? selectedIndex : edgeEnabledDropdownIndex(options, "first");
    const nextIndex = Math.max(0, initialIndex);
    setActiveIndex(nextIndex);
    window.requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus());

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open, options, selectedIndex]);

  function moveActive(direction: 1 | -1) {
    const nextIndex = nextEnabledDropdownIndex(options, activeIndex, direction);
    if (nextIndex < 0) return;
    setActiveIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  }

  function selectOption(option: UiDropdownOption) {
    if (option.disabled) return;
    onValueChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleListboxKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const nextIndex = edgeEnabledDropdownIndex(options, event.key === "Home" ? "first" : "last");
      if (nextIndex >= 0) {
        setActiveIndex(nextIndex);
        optionRefs.current[nextIndex]?.focus();
      }
    } else if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      setOpen(false);
      if (event.key === "Escape") triggerRef.current?.focus();
    }
  }

  return (
    <div className={joinClassNames("uiDropdown", className)} data-align={align} ref={rootRef}>
      <UiButton
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="uiDropdownTrigger"
        data-placeholder={!selectedOption || undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        ref={triggerRef}
        size="header"
      >
        {icon}
        <span className="uiDropdownValue">{selectedOption?.label ?? placeholder}</span>
        <span aria-hidden="true" className="uiDropdownChevron" />
      </UiButton>

      {open ? (
        <div
          aria-label={ariaLabel}
          className="uiDropdownMenu"
          id={listboxId}
          onKeyDown={handleListboxKeyDown}
          role="listbox"
        >
          {options.map((option, index) => (
            <UiButton
              aria-selected={option.value === value}
              block
              className="uiDropdownOption"
              data-description={Boolean(option.description) || undefined}
              disabled={option.disabled}
              key={option.value}
              onClick={() => selectOption(option)}
              ref={(node) => { optionRefs.current[index] = node; }}
              role="option"
              size="header"
            >
              <span>
                <strong>{option.label}</strong>
                {option.description ? <small>{option.description}</small> : null}
              </span>
              <span aria-hidden="true" className="uiDropdownSelectedMark"><ShellIcon name="check" /></span>
            </UiButton>
          ))}
        </div>
      ) : null}
    </div>
  );
}
