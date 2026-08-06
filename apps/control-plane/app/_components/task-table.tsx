"use client";

import type { ReactNode } from "react";

import { relativeTime, taskLabel } from "../_lib/format";
import type { TaskListItem } from "../_lib/types";
import { StatusBadge } from "./status-badge";
import { ShellIcon } from "./shell-icons";
import { UiActionLink, UiButton, UiIconButton } from "./ui-actions";
import { UiInput } from "./ui-fields";
import { UiSurface } from "./ui-surfaces";

interface TaskTableProps {
  emptyDescription: string;
  emptyTitle: string;
  isLoading: boolean;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  query: string;
  rows: TaskListItem[];
}

function CellLink({ children, href }: { children: ReactNode; href: string }) {
  return <UiActionLink block className="castrelTableCellLink" href={href}>{children}</UiActionLink>;
}

export function TaskTable({
  emptyDescription,
  emptyTitle,
  isLoading,
  onQueryChange,
  onRefresh,
  query,
  rows,
}: TaskTableProps) {
  return (
    <UiSurface aria-label="Tasks" as="section" className="castrelTable" variant="outline">
      <div className="castrelTableToolbar">
        <span aria-live="polite" className="castrelTableCount">
          {isLoading ? "Loading…" : `${rows.length} ${rows.length === 1 ? "record" : "records"}`}
        </span>
        <label className="castrelTableSearch">
          <span className="srOnly">Search tasks</span>
          <ShellIcon name="search" />
          <UiInput fieldSize="header" placeholder="Search" type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} />
          {query ? <UiIconButton aria-label="Clear search" size="compact" onClick={() => onQueryChange("")}>×</UiIconButton> : null}
        </label>
        <UiButton className="castrelTableAction" size="compact" tone="soft" onClick={onRefresh}>Refresh</UiButton>
      </div>

      <div className="castrelTableViewport">
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Sessions</th>
              <th>Latest</th>
              <th>Repository</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => {
              const href = `/tasks/${task.id}`;
              return (
                <tr key={task.id}>
                  <td>
                    <CellLink href={href}>
                      <span className="primaryCell">
                        <strong>{taskLabel(task.id, task.issue?.reference.identifier)}</strong>
                        <small>{task.issue?.title ?? task.objective}</small>
                      </span>
                    </CellLink>
                  </td>
                  <td><CellLink href={href}>{task.sessionCount} total · {task.activeSessionCount} active</CellLink></td>
                  <td><CellLink href={href}>{task.latestSession ? <StatusBadge state={task.latestSession.state} /> : <span className="quietCell">none</span>}</CellLink></td>
                  <td><CellLink href={href}><span className="mono">{task.repository.fullName}</span></CellLink></td>
                  <td><CellLink href={href}><time dateTime={task.updatedAt}>{relativeTime(task.updatedAt)}</time></CellLink></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isLoading && rows.length === 0 ? (
          <div className="castrelTableEmpty" role="status">
            <strong>{emptyTitle}</strong>
            <p>{emptyDescription}</p>
          </div>
        ) : null}
      </div>

      <footer className="castrelTableFooter">
        <span>{rows.length} total</span>
        <span>Table view</span>
      </footer>
    </UiSurface>
  );
}
