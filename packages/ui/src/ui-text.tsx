import { type ElementType, type HTMLAttributes } from "react";

import { joinClassNames } from "./ui-actions.js";

export type UiTextElement = "span" | "p" | "strong" | "h2" | "h3" | "h4";
export type UiTextRole = "body" | "heading" | "annotation";

export interface UiTextProps extends HTMLAttributes<HTMLElement> {
  as?: UiTextElement;
  variant?: UiTextRole;
}

export function UiText({ as = "span", className, variant = "body", ...props }: UiTextProps) {
  const Element = as as ElementType;
  return <Element {...props} className={joinClassNames("uiText", className)} data-variant={variant} />;
}
