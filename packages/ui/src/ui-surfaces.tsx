import type { ComponentProps, ElementType, HTMLAttributes, ReactNode } from "react";
import { joinClassNames, UiIconButton, type UiIconButtonProps } from "./ui-actions.js";
import { ShellIcon } from "./icons.js";
import { UiInput } from "./ui-fields.js";

export type UiSurfaceVariant = "panel" | "popup" | "outline" | "ghost";
type UiSurfaceElement = "div" | "section" | "article" | "aside";

export interface UiSurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: UiSurfaceElement;
  selected?: boolean;
  variant?: UiSurfaceVariant;
}

export function UiSurface({ as = "div", children, className, selected = false, variant = "panel", ...props }: UiSurfaceProps) {
  const Element = as as ElementType;
  return <Element {...props} className={joinClassNames("uiSurface", className)} data-selected={selected || undefined} data-variant={variant}>{children}</Element>;
}

export function UiSurfaceHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={joinClassNames("uiSurfaceHeader", className)} />;
}
export function UiSurfaceBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={joinClassNames("uiSurfaceBody", className)} />;
}
export function UiSurfaceFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={joinClassNames("uiSurfaceFooter", className)} />;
}

const SHELL_RIGHT_PANEL_ID = "shell-right-panel";

export interface UiRightPanelToggleProps {
  className?: string;
  expanded: boolean;
  label: string;
  onToggle: () => void;
}

export function UiRightPanelToggle({ className, expanded, label, onToggle }: UiRightPanelToggleProps) {
  const icon = expanded ? "chevron-right" : "chevron-left";
  return (
    <UiIconButton
      aria-controls={SHELL_RIGHT_PANEL_ID}
      aria-expanded={expanded}
      aria-label={label}
      className={joinClassNames("rightPanelToggle", className)}
      onClick={onToggle}
      size="compact"
      title={label}
    >
      <ShellIcon data-icon={icon} name={icon} />
    </UiIconButton>
  );
}

export interface UiShellRightPanelProps {
  ariaLabel: string;
  children: ReactNode;
  collapseLabel: string;
  header: ReactNode;
  hidden?: boolean;
  onCollapse: () => void;
}

export function UiShellRightPanel({ ariaLabel, children, collapseLabel, header, hidden = false, onCollapse }: UiShellRightPanelProps) {
  return (
    <aside aria-label={ariaLabel} className="rightPanel" hidden={hidden} id={SHELL_RIGHT_PANEL_ID}>
      <header className="rightPanelHeader">
        <strong>{header}</strong>
        <UiRightPanelToggle expanded label={collapseLabel} onToggle={onCollapse} />
      </header>
      <div className="rightPanelContent">{children}</div>
    </aside>
  );
}

export interface UiDialogSurfaceProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  layout?: "default" | "rows";
}
export function UiDialogSurface({ children, className, layout = "default", ...props }: UiDialogSurfaceProps) {
  return <section {...props} className={joinClassNames("uiDialogSurface", className)} data-layout={layout}>{children}</section>;
}

export function UiDialogCloseButton(props: Omit<UiIconButtonProps, "children" | "size">) {
  return <UiIconButton {...props} className={joinClassNames("uiDialogCloseButton", props.className)} size="compact"><ShellIcon name="dismiss" /></UiIconButton>;
}

export function UiDialogTitleInput({ className, ...props }: ComponentProps<typeof UiInput>) {
  return <UiInput {...props} className={joinClassNames("uiDialogTitleInput", className)} />;
}
