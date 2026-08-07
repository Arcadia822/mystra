import type { SVGProps } from "react";

export type ShellIconName =
  | "arrow-up"
  | "attachment"
  | "alert"
  | "automation"
  | "check"
  | "circle"
  | "close"
  | "collapse"
  | "expand"
  | "inbox"
  | "issue"
  | "microphone"
  | "new"
  | "plus"
  | "project"
  | "repository"
  | "review"
  | "search"
  | "send"
  | "settings"
  | "spinner";

export function ShellIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: ShellIconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7,
  };

  return (
    <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16" {...props} {...common}>
      {name === "new" ? <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></> : null}
      {name === "plus" ? <><path d="M12 5v14" /><path d="M5 12h14" /></> : null}
      {name === "search" ? <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></> : null}
      {name === "inbox" ? <><path d="M4 4h16v14H4z" /><path d="M4 13h4l2 3h4l2-3h4" /></> : null}
      {name === "issue" ? <><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></> : null}
      {name === "automation" ? <><path d="m13 2-8 12h7l-1 8 8-12h-7z" /></> : null}
      {name === "settings" ? <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4a1.7 1.7 0 0 0 1-1.6v-.2h4v.2A1.7 1.7 0 0 0 15 4a1.7 1.7 0 0 0 1.9.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></> : null}
      {name === "collapse" ? <><path d="M4 4h16v16H4z" /><path d="M9 4v16" /><path d="m15 9-3 3 3 3" /></> : null}
      {name === "expand" ? <><path d="M4 4h16v16H4z" /><path d="M9 4v16" /><path d="m13 9 3 3-3 3" /></> : null}
      {name === "project" ? <><path d="M3.5 6.5h6l2 2h9v10h-17z" /><path d="M3.5 6.5v-2h6l2 2" /></> : null}
      {name === "repository" ? <><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" /><path d="M8 8h7" /><path d="M8 12h7" /></> : null}
      {name === "arrow-up" ? <><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></> : null}
      {name === "attachment" ? <path d="m8.5 12.5 6.9-6.9a3 3 0 0 1 4.2 4.2l-8.5 8.5a5 5 0 0 1-7.1-7.1l8.1-8.1" /> : null}
      {name === "microphone" ? <><rect height="11" rx="3" width="6" x="9" y="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" /><path d="M12 17.5V21" /></> : null}
      {name === "send" ? <><path d="m4 12 16-8-6 16-2.5-6.5z" /><path d="m11.5 13.5 4-4" /></> : null}
      {name === "circle" ? <circle cx="12" cy="12" r="7" strokeDasharray="2.5 2.5" /> : null}
      {name === "spinner" ? <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v6h-6" /></> : null}
      {name === "review" ? <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.5" /></> : null}
      {name === "check" ? <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></> : null}
      {name === "alert" ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 17h.01" /></> : null}
      {name === "close" ? <path d="m6 6 12 12M18 6 6 18" /> : null}
    </svg>
  );
}
