"use client";

import { useState } from "react";

import { relativeTime, taskLabel } from "../_lib/format";
import type { TaskListItem } from "../_lib/types";
import { ShellIcon } from "./shell-icons";
import { StatusBadge } from "./status-badge";
import { UiActionAnchor, UiActionLink, UiButton, UiIconButton } from "./ui-actions";
import { UiInput } from "./ui-fields";
import { UiSurface, UiSurfaceBody, UiSurfaceHeader } from "./ui-surfaces";

interface InboxMasterDetailProps {
  isLoading: boolean;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  query: string;
  rows: TaskListItem[];
}

function InboxEmpty() {
  return (
    <UiSurface className="inboxEmpty" role="status" variant="ghost">
      <span className="inboxEmptyIcon"><ShellIcon name="inbox" /></span>
      <strong>Inbox is clear</strong>
      <p>Tasks appear here when their latest Session is waiting for review.</p>
    </UiSurface>
  );
}

function InboxLoading() {
  return (
    <div aria-busy="true" aria-label="Loading Inbox" className="inboxLoading">
      {Array.from({ length: 4 }, (_, index) => (
        <UiSurface className="inboxLoadingCard" key={index} variant="outline">
          <span className="loadingBar short" />
          <span className="loadingBar" />
        </UiSurface>
      ))}
    </div>
  );
}

function InboxDetail({ task }: { task: TaskListItem }) {
  const label = taskLabel(task.id, task.issue?.reference.identifier);
  return (
    <UiSurface aria-label={`${label} detail`} as="article" className="inboxDetail" variant="ghost">
      <UiSurfaceHeader className="inboxDetailHeader">
        <div>
          <span className="inboxEyebrow">Review task</span>
          <h1>{label}</h1>
        </div>
        <div className="inboxDetailActions">
          {task.latestSession ? <StatusBadge state={task.latestSession.state} /> : null}
          <UiActionLink className="inboxOpenTask" href={`/tasks/${task.id}`} size="compact" tone="soft">Open Task</UiActionLink>
        </div>
      </UiSurfaceHeader>

      <UiSurfaceBody className="inboxDetailBody">
        <section className="inboxDetailLead">
          <h2>{task.issue?.title ?? task.objective}</h2>
          <p>{task.issue?.description ?? task.objective}</p>
          {task.issue ? (
            <UiActionAnchor href={task.issue.reference.url} rel="noreferrer" size="compact" target="_blank">
              Open source issue ↗
            </UiActionAnchor>
          ) : null}
        </section>

        <dl className="inboxFacts">
          <div><dt>Repository</dt><dd className="mono">{task.repository.fullName}</dd></div>
          <div><dt>Sessions</dt><dd>{task.sessionCount} total · {task.activeSessionCount} active</dd></div>
          <div><dt>Latest branch</dt><dd className="mono">{task.latestSession?.branch ?? "No Session branch"}</dd></div>
          <div><dt>Agent</dt><dd>{task.latestSession?.agent ?? "Unassigned"}</dd></div>
          <div><dt>Updated</dt><dd><time dateTime={task.updatedAt}>{relativeTime(task.updatedAt)}</time></dd></div>
          <div><dt>Task ID</dt><dd className="mono">{task.id}</dd></div>
        </dl>

        <section className="inboxObjective">
          <span className="inboxEyebrow">Objective</span>
          <p>{task.objective}</p>
        </section>
      </UiSurfaceBody>
    </UiSurface>
  );
}

export function InboxMasterDetail({ isLoading, onQueryChange, onRefresh, query, rows }: InboxMasterDetailProps) {
  const [selectedId, setSelectedId] = useState<string>();
  const selectedTask = rows.find((task) => task.id === selectedId) ?? rows[0];

  return (
    <section aria-label="Inbox review queue" className="inboxMasterDetail">
      <aside className="inboxListPane">
        <header className="inboxPaneHeader">
          <div><strong>Review queue</strong><span aria-live="polite">{isLoading ? "Loading…" : `${rows.length} open`}</span></div>
          <UiButton className="castrelTableAction" size="compact" tone="soft" onClick={onRefresh}>Refresh</UiButton>
        </header>
        <label className="inboxSearch">
          <span className="srOnly">Search Inbox tasks</span>
          <ShellIcon name="search" />
          <UiInput fieldSize="header" placeholder="Search Inbox" type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} />
          {query ? <UiIconButton aria-label="Clear Inbox search" size="compact" onClick={() => onQueryChange("")}>×</UiIconButton> : null}
        </label>

        <div className="inboxCardList">
          {isLoading ? <InboxLoading /> : null}
          {!isLoading && rows.length === 0 ? <InboxEmpty /> : null}
          {!isLoading ? rows.map((task) => {
            const selected = task.id === selectedTask?.id;
            return (
              <UiButton
                active={selected}
                aria-pressed={selected}
                block
                className="inboxCard"
                key={task.id}
                onClick={() => setSelectedId(task.id)}
              >
                <span className="inboxCardTopline">
                  <strong>{taskLabel(task.id, task.issue?.reference.identifier)}</strong>
                  <time dateTime={task.updatedAt}>{relativeTime(task.updatedAt)}</time>
                </span>
                <span className="inboxCardTitle">{task.issue?.title ?? task.objective}</span>
                <span className="inboxCardMeta"><ShellIcon name="repository" />{task.repository.fullName}</span>
                <span className="inboxCardFooter"><StatusBadge state={task.latestSession?.state ?? "unknown"} /><span>{task.sessionCount} sessions</span></span>
              </UiButton>
            );
          }) : null}
        </div>
      </aside>

      <div aria-live="polite" className="inboxDetailPane">
        {isLoading ? <div className="inboxDetailLoading"><InboxLoading /></div> : null}
        {!isLoading && selectedTask ? <InboxDetail task={selectedTask} /> : null}
        {!isLoading && !selectedTask ? <InboxEmpty /> : null}
      </div>
    </section>
  );
}
