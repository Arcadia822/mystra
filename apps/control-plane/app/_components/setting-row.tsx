import type { HTMLAttributes, ReactNode } from "react";

function classes(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function SettingGroup({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={classes("settingGroup", className)} />;
}

export function SettingRow({
  children,
  className,
  control,
  description,
  title,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  control?: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div {...props} className={classes("settingRow", className)}>
      <div className="settingRowCopy">
        <h4>{title}</h4>
        {description ? <p>{description}</p> : null}
        {children ? <div className="settingRowBody">{children}</div> : null}
      </div>
      {control ? <div className="settingRowControl">{control}</div> : null}
    </div>
  );
}
