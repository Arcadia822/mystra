"use client";

import { type CSSProperties, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { joinClassNames, UiButton, UiIconButton } from "./ui-actions.js";
import { resolveDropdownFloatingPosition } from "./ui-dropdown-model.js";
import { ShellIcon, type ShellIconName } from "./icons.js";
import { UiSurface, UiSurfaceBody } from "./ui-surfaces.js";

export function UiPopover({
  align = "end",
  "aria-label": ariaLabel,
  children,
  className,
  icon,
  popupClassName,
  trigger,
  triggerClassName,
}: {
  align?: "start" | "end";
  "aria-label": string;
  children: ReactNode;
  className?: string;
  icon?: ShellIconName;
  popupClassName?: string;
  trigger?: ReactNode;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>();
  const popupId = useId();

  useEffect(() => {
    if (!open) return;
    function closeOnPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeOnPointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPopupStyle(undefined);
      return;
    }

    function updatePopupPosition() {
      const anchorElement = triggerRef.current;
      const popup = popupRef.current;
      if (!anchorElement || !popup) return;

      const anchor = anchorElement.getBoundingClientRect();
      const viewportMargin = 8;
      const availableWidth = Math.max(0, window.innerWidth - viewportMargin * 2);
      const popupWidth = Math.min(Math.max(anchor.width, popup.scrollWidth), Math.min(360, availableWidth));
      const position = resolveDropdownFloatingPosition({
        align,
        anchor,
        gap: 4,
        margin: viewportMargin,
        menuHeight: popup.scrollHeight,
        menuWidth: popupWidth,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      });

      setPopupStyle({
        left: position.left,
        maxHeight: Math.min(360, position.maxHeight),
        top: position.top,
        visibility: "visible",
        width: popupWidth,
      });
    }

    updatePopupPosition();
    window.addEventListener("resize", updatePopupPosition);
    window.addEventListener("scroll", updatePopupPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopupPosition);
      window.removeEventListener("scroll", updatePopupPosition, true);
    };
  }, [align, children, open]);

  const triggerProps = {
    "aria-controls": open ? popupId : undefined,
    "aria-expanded": open,
    "aria-haspopup": "dialog" as const,
    "aria-label": ariaLabel,
    onClick: () => setOpen((current) => !current),
    ref: triggerRef,
    title: ariaLabel,
  };

  return (
    <div className={joinClassNames("uiDropdown", className)} data-align={align} ref={rootRef}>
      {trigger ? (
        <UiButton {...triggerProps} className={triggerClassName} size="compact">{trigger}</UiButton>
      ) : (
        <UiIconButton {...triggerProps}><ShellIcon name={icon ?? "display"} /></UiIconButton>
      )}
      {open && typeof document !== "undefined" ? createPortal(
        <div
          className="uiPopoverLayer"
          ref={popupRef}
          style={popupStyle ?? { left: 0, top: 0, visibility: "hidden" }}
        >
          <UiSurface className={joinClassNames("uiPopover", popupClassName)} id={popupId} role="dialog" variant="popup">
            <UiSurfaceBody className="uiPopoverBody">{children}</UiSurfaceBody>
          </UiSurface>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
