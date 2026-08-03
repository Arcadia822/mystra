"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "../_components/states";
import { StatusBadge } from "../_components/status-badge";
import { relativeTime, taskLabel } from "../_lib/format";
import type { TaskListItem } from "../_lib/types";
import { useResource } from "../_lib/use-resource";

export default function TasksPage() {
  const resource = useResource<{ tasks: TaskListItem[] }>("/api/tasks", 3_000);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return resource.data?.tasks ?? [];
    return (resource.data?.tasks ?? []).filter((task) => [
      task.id,
      task.objective,
      task.issue?.reference.identifier,
      task.issue?.title,
      task.repository.fullName,
      task.latestSession?.branch,
    ].some((value) => value?.toLowerCase().includes(normalized)));
  }, [query, resource.data?.tasks]);

  return (
    <div className="pageContent">
      <div className="pageToolbar">
        <label><span className="srOnly">Search tasks</span><input placeholder="Search tasks" type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <button className="secondaryButton" type="button" onClick={() => void resource.refresh()}>Refresh</button>
      </div>
      {resource.isLoading ? <LoadingState label="Loading tasks" /> : null}
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.refresh()} /> : null}
      {!resource.isLoading && !resource.error && filtered.length === 0 ? (
        <EmptyState title="No matching tasks" description="Create a Task through API, CLI, MCP, or Issue dispatch." />
      ) : null}
      {filtered.length ? (
        <section className="panel">
          <div className="tableHeader taskColumns"><span>Task</span><span>Sessions</span><span>Latest</span><span>Repository</span><span>Updated</span></div>
          <div className="dataList">
            {filtered.map((task) => (
              <Link className="dataRow taskColumns" href={`/tasks/${task.id}`} key={task.id}>
                <span className="primaryCell"><strong>{taskLabel(task.id, task.issue?.reference.identifier)}</strong><small>{task.issue?.title ?? task.objective}</small></span>
                <span>{task.sessionCount} total · {task.activeSessionCount} active</span>
                {task.latestSession ? <StatusBadge state={task.latestSession.state} /> : <span>none</span>}
                <span>{task.repository.fullName}</span>
                <time>{relativeTime(task.updatedAt)}</time>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
