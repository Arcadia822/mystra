import Link from "next/link";
import {
  type AnchorHTMLAttributes,
  forwardRef,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ReactNode,
} from "react";

export type UiActionTone = "ghost" | "soft" | "solid" | "danger";
export type UiActionSize = "compact" | "header" | "default";

interface UiActionStyleProps {
  active?: boolean;
  block?: boolean;
  iconOnly?: boolean;
  size?: UiActionSize;
  tone?: UiActionTone;
}

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export interface UiButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, UiActionStyleProps {}

export const UiButton = forwardRef<HTMLButtonElement, UiButtonProps>(function UiButton(
  {
    active = false,
    block = false,
    children,
    className,
    iconOnly = false,
    size = "header",
    tone = "ghost",
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      {...props}
      className={joinClassNames("uiAction", className)}
      data-active={active || undefined}
      data-block={block || undefined}
      data-icon-only={iconOnly || undefined}
      data-size={size}
      data-tone={tone}
      ref={ref}
      type={type}
    >
      {children}
    </button>
  );
});

export interface UiIconButtonProps extends Omit<UiButtonProps, "aria-label" | "iconOnly"> {
  "aria-label": string;
}

export const UiIconButton = forwardRef<HTMLButtonElement, UiIconButtonProps>(
  function UiIconButton(props, ref) {
    return <UiButton {...props} iconOnly ref={ref} />;
  },
);

export interface UiActionLinkProps
  extends ComponentProps<typeof Link>, UiActionStyleProps {
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

export interface UiActionAnchorProps
  extends AnchorHTMLAttributes<HTMLAnchorElement>, UiActionStyleProps {}

export const UiActionAnchor = forwardRef<HTMLAnchorElement, UiActionAnchorProps>(
  function UiActionAnchor(
    {
      active = false,
      block = false,
      children,
      className,
      iconOnly = false,
      size = "header",
      tone = "ghost",
      ...props
    },
    ref,
  ) {
    return (
      <a
        {...props}
        className={joinClassNames("uiAction", className)}
        data-active={active || undefined}
        data-block={block || undefined}
        data-icon-only={iconOnly || undefined}
        data-size={size}
        data-tone={tone}
        ref={ref}
      >
        {children}
      </a>
    );
  },
);
