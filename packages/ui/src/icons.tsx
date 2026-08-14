import type { SVGProps } from "react";

export type ShellIconName =
  | "arrow-up" | "attachment" | "alert" | "automation" | "check" | "circle"
  | "chevron-left" | "chevron-right" | "close" | "collapse" | "dismiss" | "display" | "expand" | "filter" | "github" | "inbox"
  | "issue" | "kanban" | "linear" | "list" | "microphone" | "new" | "overview"
  | "plus" | "project" | "refresh" | "repository" | "review" | "runtime" | "search" | "send"
  | "settings" | "spinner";

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
      {name === "automation" ? <path d="m13 2-8 12h7l-1 8 8-12h-7z" /> : null}
      {name === "settings" ? <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3A1.7 1.7 0 0 0 14 21v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4a1.7 1.7 0 0 0 1-1.6v-.2h4v.2A1.7 1.7 0 0 0 15 4a1.7 1.7 0 0 0 1.9.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></> : null}
      {name === "collapse" ? <><path d="M4 4h16v16H4z" /><path d="M9 4v16" /><path d="m15 9-3 3 3 3" /></> : null}
      {name === "expand" ? <><path d="M4 4h16v16H4z" /><path d="M9 4v16" /><path d="m13 9 3 3-3 3" /></> : null}
      {name === "project" ? <><path d="M3.5 6.5h6l2 2h9v10h-17z" /><path d="M3.5 6.5v-2h6l2 2" /></> : null}
      {name === "repository" ? <><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" /><path d="M8 8h7" /><path d="M8 12h7" /></> : null}
      {name === "runtime" ? <><rect height="14" rx="2" width="16" x="4" y="5" /><path d="m8 10 2 2-2 2" /><path d="M13 14h3" /></> : null}
      {name === "overview" ? <path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z" /> : null}
      {name === "list" ? <><path d="M6 6h14M6 12h14M6 18h14" /><circle cx="3" cy="6" fill="currentColor" r=".6" /><circle cx="3" cy="12" fill="currentColor" r=".6" /><circle cx="3" cy="18" fill="currentColor" r=".6" /></> : null}
      {name === "kanban" ? <><rect height="14" rx="1" width="7" x="4" y="5" /><rect height="9" rx="1" width="6" x="14" y="5" /></> : null}
      {name === "filter" ? <><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></> : null}
      {name === "display" ? <><rect height="14" rx="2" width="16" x="4" y="5" /><path d="M4 10h16" /><path d="M10 10v9" /></> : null}
      {name === "refresh" ? <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v6h-6" /></> : null}
      {name === "github" ? <><circle cx="12" cy="12" r="8" /><path d="M9 19c.5-1.4.4-2.4-.3-3M15 19c-.5-1.4-.4-2.4.3-3M8.7 16c-2.5-.8-3-3-3-4.7 0-1 .3-1.8.8-2.5-.2-.8 0-1.7.3-2.3 1.2-.1 2 .5 2.6.9a8 8 0 0 1 5.2 0c.6-.4 1.4-1 2.6-.9.3.6.5 1.5.3 2.3.5.7.8 1.5.8 2.5 0 1.7-.5 3.9-3 4.7" /></> : null}
      {name === "linear" ? <><circle cx="12" cy="12" r="8" /><path d="m7.1 7.1 9.8 9.8M5.2 10l8.8 8.8M10 5.2l8.8 8.8" /></> : null}
      {name === "arrow-up" ? <><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></> : null}
      {name === "chevron-left" ? <path d="m15 6-6 6 6 6" /> : null}
      {name === "chevron-right" ? <path d="m9 6 6 6-6 6" /> : null}
      {name === "attachment" ? <path d="m8.5 12.5 6.9-6.9a3 3 0 0 1 4.2 4.2l-8.5 8.5a5 5 0 0 1-7.1-7.1l8.1-8.1" /> : null}
      {name === "microphone" ? <><rect height="11" rx="3" width="6" x="9" y="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" /><path d="M12 17.5V21" /></> : null}
      {name === "send" ? <><path d="m4 12 16-8-6 16-2.5-6.5z" /><path d="m11.5 13.5 4-4" /></> : null}
      {name === "circle" ? <circle cx="12" cy="12" r="7" strokeDasharray="2.5 2.5" /> : null}
      {name === "spinner" ? <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v6h-6" /></> : null}
      {name === "review" ? <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.5" /></> : null}
      {name === "check" ? <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></> : null}
      {name === "alert" ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 17h.01" /></> : null}
      {name === "close" ? <path d="m6 6 12 12M18 6 6 18" /> : null}
      {name === "dismiss" ? <path d="m8 8 8 8m0-8-8 8" strokeWidth="1.5" /> : null}
    </svg>
  );
}

export type TaskStatus = "pending" | "in_progress" | "blocked" | "done" | "canceled";
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Not started",
  in_progress: "In progress",
  blocked: "Needs handoff",
  done: "Completed",
  canceled: "Canceled",
};

export function TaskStatusIcon({ status, ...props }: SVGProps<SVGSVGElement> & { status: TaskStatus }) {
  return (
    <svg aria-hidden="true" className="taskStatusIcon" data-status={status} height="16" viewBox="0 0 24 24" width="16" {...props}>
      <circle className="taskStatusBase" cx="12" cy="12" r="9" />
      {status === "in_progress" ? <path className="taskStatusProgress" d="M12 3a9 9 0 0 1 0 18Z" /> : null}
      {status === "blocked" ? <><path className="taskStatusFill" d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" /><path className="taskStatusMark taskStatusHandoffMark" d="M7.5 12h8M13 8.5l3.5 3.5-3.5 3.5" /></> : null}
      {status === "done" ? <><path className="taskStatusFill" d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" /><path className="taskStatusMark taskStatusDoneMark" d="m7.8 12 2.7 2.7 5.8-6" /></> : null}
      {status === "canceled" ? <><path className="taskStatusFill" d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" /><path className="taskStatusMark taskStatusCanceledMark" d="m8.5 8.5 7 7m0-7-7 7" /></> : null}
    </svg>
  );
}
