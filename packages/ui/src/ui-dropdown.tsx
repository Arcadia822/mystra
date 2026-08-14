"use client";

import { type CSSProperties, type KeyboardEvent, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UiButton, joinClassNames, type UiActionSize } from "./ui-actions.js";
import { ShellIcon } from "./icons.js";
import { edgeEnabledDropdownIndex, nextEnabledDropdownIndex, resolveDropdownFloatingPosition } from "./ui-dropdown-model.js";

export interface UiDropdownOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface UiDropdownProps {
  "aria-label": string;
  align?: "start" | "end";
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
  onValueChange: (value: string) => void;
  options: UiDropdownOption[];
  placeholder: string;
  size?: UiActionSize;
  variant?: "field" | "ghost";
  value: string;
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
  size = "header",
  variant = "field",
  value,
}: UiDropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
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
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open, options, selectedIndex]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(undefined);
      return;
    }

    function updateMenuPosition() {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const anchor = trigger.getBoundingClientRect();
      const viewportMargin = 8;
      const availableWidth = Math.max(0, window.innerWidth - viewportMargin * 2);
      const menuWidth = Math.min(Math.max(anchor.width, menu.scrollWidth), Math.min(360, availableWidth));
      const position = resolveDropdownFloatingPosition({
        align,
        anchor,
        gap: 4,
        margin: viewportMargin,
        menuHeight: menu.scrollHeight,
        menuWidth,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      });

      setMenuStyle({
        left: position.left,
        maxHeight: Math.min(280, position.maxHeight),
        top: position.top,
        visibility: "visible",
        width: menuWidth,
      });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [align, open, options]);

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
    <div className={joinClassNames("uiDropdown", className)} data-align={align} data-variant={variant} ref={rootRef}>
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
        size={size}
      >
        {icon}
        <span className="uiDropdownValue">{selectedOption?.label ?? placeholder}</span>
        <span aria-hidden="true" className="uiDropdownChevron" />
      </UiButton>
      {open && typeof document !== "undefined" ? createPortal(
        <div
          aria-label={ariaLabel}
          className="uiDropdownMenu"
          data-align={align}
          id={listboxId}
          onKeyDown={handleListboxKeyDown}
          ref={menuRef}
          role="listbox"
          style={menuStyle ?? { left: 0, top: 0, visibility: "hidden" }}
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
              <span><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</span>
              <span aria-hidden="true" className="uiDropdownSelectedMark"><ShellIcon name="check" /></span>
            </UiButton>
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
