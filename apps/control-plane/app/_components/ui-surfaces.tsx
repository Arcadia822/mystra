import type { ElementType, HTMLAttributes, ReactNode } from "react";

type UiSurfaceVariant = "panel" | "popup" | "outline" | "ghost";
type UiSurfaceElement = "div" | "section" | "article" | "aside";

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export interface UiSurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: UiSurfaceElement;
  selected?: boolean;
  variant?: UiSurfaceVariant;
}

export function UiSurface({
  as = "div",
  children,
  className,
  selected = false,
  variant = "panel",
  ...props
}: UiSurfaceProps) {
  const Element = as as ElementType;
  return (
    <Element
      {...props}
      className={joinClassNames("uiSurface", className)}
      data-selected={selected || undefined}
      data-variant={variant}
    >
      {children}
    </Element>
  );
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

export interface UiDialogSurfaceProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function UiDialogSurface({ children, className, ...props }: UiDialogSurfaceProps) {
  return (
    <section {...props} className={joinClassNames("uiDialogSurface", className)}>
      {children}
    </section>
  );
}

