import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export {
  UiActionAnchor,
  UiButton,
  UiIconButton,
  type UiActionAnchorProps,
  type UiActionSize,
  type UiActionTone,
  type UiButtonProps,
  type UiIconButtonProps,
} from "@mystra/ui";
import { joinClassNames } from "@mystra/ui";

interface UiActionStyleProps {
  active?: boolean;
  block?: boolean;
  iconOnly?: boolean;
  size?: "compact" | "header" | "default";
  tone?: "ghost" | "soft" | "solid" | "danger";
}

export interface UiActionLinkProps extends ComponentProps<typeof Link>, UiActionStyleProps {
  children: ReactNode;
}

export function UiActionLink({
  active = false,
  block = false,
  children,
  className,
  iconOnly = false,
  size = "header",
  tone = "ghost",
  ...props
}: UiActionLinkProps) {
  return (
    <Link
      {...props}
      className={joinClassNames("uiAction", className)}
      data-active={active || undefined}
      data-block={block || undefined}
      data-icon-only={iconOnly || undefined}
      data-size={size}
      data-tone={tone}
    >
      {children}
    </Link>
  );
}
