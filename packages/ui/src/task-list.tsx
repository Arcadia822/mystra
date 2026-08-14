"use client";

import type { CSSProperties, ReactNode } from "react";
import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import { ShellIcon, type ShellIconName } from "./icons.js";
import { joinClassNames } from "./ui-actions.js";
import {
  getStackedListFieldPresentation,
  resolveVisibleLabelCount,
  type StackedListCustomFieldDefinition,
  type StackedListFieldDefinition,
  type StackedListStandardFieldDefinition,
} from "./task-list-model.js";
import { UiPopover } from "./ui-popover.js";

export const UiLabel = forwardRef<HTMLSpanElement, { children: ReactNode; icon?: ShellIconName; className?: string }>(
  function UiLabel({ children, icon, className }, ref) {
    return <span className={joinClassNames("taskLabel", className)} ref={ref}>{icon ? <ShellIcon name={icon} /> : null}{children}</span>;
  },
);

export interface UiLabelOverflowItem {
  content: ReactNode;
  icon?: ShellIconName;
  id: string;
}

export function UiLabelOverflow({
  "aria-label": ariaLabel,
  items,
}: {
  "aria-label": string;
  items: readonly UiLabelOverflowItem[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const measureItemRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const overflowMeasureRef = useRef<HTMLSpanElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const hiddenItems = items.slice(visibleCount);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const style = window.getComputedStyle(root);
      const gap = Number.parseFloat(style.columnGap || style.gap) || 0;
      const itemWidths = items.map((_, index) => measureItemRefs.current[index]?.getBoundingClientRect().width ?? 0);
      setVisibleCount(resolveVisibleLabelCount({
        availableWidth: root.clientWidth,
        gap,
        itemWidths,
        overflowWidth: overflowMeasureRef.current?.getBoundingClientRect().width ?? 0,
      }));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [items]);

  return (
    <div className="uiLabelOverflow" ref={rootRef}>
      {items.slice(0, visibleCount).map((item) => (
        <UiLabel {...(item.icon ? { icon: item.icon } : {})} key={item.id}>{item.content}</UiLabel>
      ))}
      {hiddenItems.length > 0 ? (
        <UiPopover
          align="end"
          aria-label={`${ariaLabel}: ${hiddenItems.length} more`}
          className="uiLabelOverflowControl"
          popupClassName="uiLabelOverflowPopup"
          trigger={<span>+{hiddenItems.length}</span>}
          triggerClassName="taskLabel uiLabelOverflowTrigger"
        >
          <div className="uiLabelOverflowList">
            {hiddenItems.map((item) => <UiLabel {...(item.icon ? { icon: item.icon } : {})} key={item.id}>{item.content}</UiLabel>)}
          </div>
        </UiPopover>
      ) : null}
      <div aria-hidden="true" className="uiLabelOverflowMeasure">
        {items.map((item, index) => (
          <UiLabel {...(item.icon ? { icon: item.icon } : {})} className="uiLabelOverflowMeasureItem" key={item.id} ref={(node) => { measureItemRefs.current[index] = node; }}>{item.content}</UiLabel>
        ))}
        <span className="taskLabel uiLabelOverflowMeasureCount" ref={overflowMeasureRef}>+{items.length}</span>
      </div>
    </div>
  );
}

export type StackedListField = StackedListFieldDefinition;
export type { StackedListCustomFieldDefinition, StackedListFieldDefinition, StackedListStandardFieldDefinition } from "./task-list-model.js";

export function validateStackedListFields(fields: readonly StackedListField[]): void {
  for (const align of ["left", "right"] as const) {
    const side = fields.filter((field) => field.align === align);
    if (align === "right") side.reverse();
    let sawNatural = false;
    for (const field of side) {
      const equalWidth = getStackedListFieldPresentation(field).equalWidth;
      if (!equalWidth) sawNatural = true;
      if (equalWidth && sawNatural) {
        throw new TypeError(`equalWidth field "${field.key}" must stay on the outer edge or touch another equalWidth field.`);
      }
    }
  }
}

function fieldVariable(key: string): `--stacked-${string}-width` {
  return `--stacked-${key.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}-width`;
}

export function StackedList({
  children,
  className,
  fields = [],
}: {
  children: ReactNode;
  className?: string;
  fields?: readonly StackedListField[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  validateStackedListFields(fields);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      for (const field of fields.filter((item) => getStackedListFieldPresentation(item).equalWidth)) {
        const cells = root.querySelectorAll<HTMLElement>(`[data-stacked-field="${field.key}"]`);
        let width = 0;
        cells.forEach((cell) => {
          const previous = cell.style.width;
          cell.style.width = "auto";
          width = Math.max(width, cell.scrollWidth);
          cell.style.width = previous;
        });
        root.style.setProperty(fieldVariable(field.key), `${Math.ceil(width)}px`);
      }
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    const mutationObserver = new MutationObserver(measure);
    resizeObserver.observe(root);
    mutationObserver.observe(root, { childList: true, subtree: true });
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [fields]);

  return <div className={joinClassNames("uiStackedList", className)} ref={ref} role="list">{children}</div>;
}

export function StackedListHelperRow({ children }: { children: ReactNode }) {
  return <div aria-live="polite" className="uiStackedListHelperRow">{children}</div>;
}

export function StackedListRow({ left, name, right, onClick }: { left: ReactNode; name: ReactNode; right: ReactNode; onClick?: () => void }) {
  return <button className="uiStackedListRow" onClick={onClick} role="listitem" type="button"><span className="uiStackedListLeft">{left}</span><span className="uiStackedListName uiStackedListText">{name}</span><span className="uiStackedListSpacer" /><span className="uiStackedListRight">{right}</span></button>;
}

export function StackedListField({
  children,
  field,
}: {
  children: ReactNode;
  field: StackedListStandardFieldDefinition;
}) {
  const presentation = getStackedListFieldPresentation(field);
  const style = presentation.equalWidth ? { width: `var(${fieldVariable(field.key)}, auto)` } as CSSProperties : undefined;
  return <span className={joinClassNames("uiStackedListField", presentation.className)} data-align={field.align} data-render-type={field.renderType} data-stacked-field={field.key} style={style}>{children}</span>;
}

export function StackedListCustomField({
  children,
  className,
  field,
}: {
  children: ReactNode;
  className?: string;
  field: StackedListCustomFieldDefinition;
}) {
  const presentation = getStackedListFieldPresentation(field);
  const style = presentation.equalWidth ? { width: `var(${fieldVariable(field.key)}, auto)` } as CSSProperties : undefined;
  return <span className={joinClassNames("uiStackedListField", className)} data-align={field.align} data-render-type="custom" data-stacked-field={field.key} style={style}>{children}</span>;
}
