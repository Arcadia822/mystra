"use client";

import type { TaskListItem } from "../_lib/types";
import { ShellIcon } from "./shell-icons";
import { UiSurface } from "./ui-surfaces";

interface InboxMasterDetailProps {
  isLoading: boolean;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  query: string;
  rows: TaskListItem[];
}

export function InboxMasterDetail(props: InboxMasterDetailProps) {
  void props;
  return (
    <section aria-label="Inbox unavailable" className="inboxMasterDetail">
      <UiSurface className="inboxEmpty" role="status" variant="ghost">
        <span className="inboxEmptyIcon"><ShellIcon name="inbox" /></span>
        <strong>Inbox is temporarily unavailable</strong>
        <p>Session review state is paused while Session persistence is outside the active Prisma schema.</p>
      </UiSurface>
    </section>
  );
}
