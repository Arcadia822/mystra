import type { ReactNode } from "react";

import { UiActionLink, UiButton } from "./ui-actions";

interface VerticalNavItemBaseProps {
  active?: boolean;
  ariaControls?: string;
  ariaCurrent?: "page";
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  id?: string;
  role?: string;
  onClick?: () => void;
}

interface VerticalNavItemLinkProps extends VerticalNavItemBaseProps {
  href: string;
}

interface VerticalNavItemButtonProps extends VerticalNavItemBaseProps {
  href?: undefined;
}

export type VerticalNavItemProps = VerticalNavItemLinkProps | VerticalNavItemButtonProps;

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function VerticalNavItem({
  active = false,
  ariaControls,
  ariaCurrent,
  ariaLabel,
  children,
  className,
  href,
  id,
  onClick,
  role,
}: VerticalNavItemProps) {
  const mergedClassName = joinClassNames("verticalNavItem", className);

  if (href) {
    return (
      <UiActionLink
        active={active}
        aria-controls={ariaControls}
        aria-current={ariaCurrent}
        aria-label={ariaLabel}
        aria-selected={role === "tab" ? active : undefined}
        block
        className={mergedClassName}
        href={href}
        id={id}
        role={role}
        size="header"
        {...(onClick ? { onClick } : {})}
      >
        {children}
      </UiActionLink>
    );
  }

  return (
    <UiButton
      active={active}
      aria-controls={ariaControls}
      aria-label={ariaLabel}
      aria-selected={role === "tab" ? active : undefined}
      block
      className={mergedClassName}
      id={id}
      role={role}
      size="header"
      onClick={onClick}
    >
      {children}
    </UiButton>
  );
}
