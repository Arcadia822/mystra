import type { HTMLAttributes, ReactNode } from "react";
import { ShellIcon, type ShellIconName } from "./icons.js";
import { UiActionAnchor, UiButton, UiIconButton, type UiIconButtonProps, joinClassNames } from "./ui-actions.js";

export interface UiBreadcrumbItem {
  href?: string;
  label: ReactNode;
}

export interface UiBreadcrumbProps extends Omit<HTMLAttributes<HTMLElement>, "aria-label"> {
  ariaLabel?: string;
  items: readonly UiBreadcrumbItem[];
}

export function UiBreadcrumb({ ariaLabel = "Breadcrumb", className, items, ...props }: UiBreadcrumbProps) {
  return (
    <nav {...props} aria-label={ariaLabel} className={joinClassNames("uiBreadcrumb", className)}>
      <ol>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.href ?? "current"}-${index}`}>
              {index > 0 ? <ShellIcon className="uiBreadcrumbSeparator" data-icon="chevron-right" name="chevron-right" /> : null}
              {item.href && !current ? (
                <UiActionAnchor href={item.href} size="inline">{item.label}</UiActionAnchor>
              ) : (
                <span aria-current={current ? "page" : undefined} className="uiBreadcrumbLabel">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface VerticalNavItemProps {
  active?: boolean;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
}

export function VerticalNavItem({ active = false, ariaLabel, children, className, href, onClick }: VerticalNavItemProps) {
  const merged = joinClassNames("verticalNavItem", className);
  return href ? (
    <UiActionAnchor active={active} aria-label={ariaLabel} block className={merged} href={href} onClick={onClick} size="header">
      {children}
    </UiActionAnchor>
  ) : (
    <UiButton active={active} aria-label={ariaLabel} block className={merged} onClick={onClick} size="header">
      {children}
    </UiButton>
  );
}

type SidebarVisualPosition = "leading" | "trailing";
export interface SidebarVisualProps extends HTMLAttributes<HTMLSpanElement> {
  position?: SidebarVisualPosition;
  visual: "badge" | "button" | "icon" | "mark" | "status";
}
export function SidebarVisual({ children, className, position = "leading", visual, ...props }: SidebarVisualProps) {
  return <span {...props} className={joinClassNames("sidebarVisual", className)} data-position={position} data-visual={visual}>{children}</span>;
}
export function SidebarIcon({ name, position = "leading" }: { name: ShellIconName; position?: SidebarVisualPosition }) {
  return <SidebarVisual aria-hidden="true" position={position} visual="icon"><ShellIcon name={name} /></SidebarVisual>;
}
export function SidebarIconButton({ className, icon, ...props }: Omit<UiIconButtonProps, "children" | "size"> & { icon: ShellIconName }) {
  return <SidebarVisual position="trailing" visual="button"><UiIconButton {...props} className={joinClassNames("sidebarVisualButton", className)} size="compact"><ShellIcon name={icon} /></UiIconButton></SidebarVisual>;
}
export function SidebarMark() {
  return <SidebarVisual aria-hidden="true" visual="mark"><span className="sidebarMarkShape" /></SidebarVisual>;
}
