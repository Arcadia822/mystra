import type { HTMLAttributes } from "react";

import { ShellIcon, type ShellIconName } from "./shell-icons";
import { UiIconButton, type UiIconButtonProps } from "./ui-actions";

type SidebarVisualKind = "badge" | "button" | "icon" | "mark" | "status";
type SidebarVisualPosition = "leading" | "trailing";

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export interface SidebarVisualProps extends HTMLAttributes<HTMLSpanElement> {
  position?: SidebarVisualPosition;
  visual: SidebarVisualKind;
}

export function SidebarVisual({
  children,
  className,
  position = "leading",
  visual,
  ...props
}: SidebarVisualProps) {
  return (
    <span
      {...props}
      className={joinClassNames("sidebarVisual", className)}
      data-position={position}
      data-visual={visual}
    >
      {children}
    </span>
  );
}

export function SidebarIcon({
  name,
  position = "leading",
}: {
  name: ShellIconName;
  position?: SidebarVisualPosition;
}) {
  return (
    <SidebarVisual aria-hidden="true" position={position} visual="icon">
      <ShellIcon name={name} />
    </SidebarVisual>
  );
}

export function SidebarCountBadge({ count }: { count: number }) {
  return (
    <SidebarVisual aria-hidden="true" position="trailing" visual="badge">
      <span className="sidebarBadge">{count}</span>
    </SidebarVisual>
  );
}

export interface SidebarIconButtonProps
  extends Omit<UiIconButtonProps, "children" | "size"> {
  icon: ShellIconName;
}

export function SidebarIconButton({ className, icon, ...props }: SidebarIconButtonProps) {
  return (
    <SidebarVisual position="trailing" visual="button">
      <UiIconButton
        {...props}
        className={joinClassNames("sidebarVisualButton", className)}
        size="compact"
      >
        <ShellIcon name={icon} />
      </UiIconButton>
    </SidebarVisual>
  );
}

export function SidebarMark() {
  return (
    <SidebarVisual aria-hidden="true" visual="mark">
      <span className="sidebarMarkShape" />
    </SidebarVisual>
  );
}

export function SidebarStatusIcon({
  icon,
  label,
  status,
}: {
  icon: ShellIconName;
  label: string;
  status: string;
}) {
  return (
    <SidebarVisual
      aria-label={label}
      data-status={status}
      role="img"
      title={label}
      visual="status"
    >
      <ShellIcon name={icon} />
    </SidebarVisual>
  );
}
