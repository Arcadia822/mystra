"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "../_components/states";
import { StatusBadge } from "../_components/status-badge";
import { relativeTime, taskLabel } from "../_lib/format";
import type { JobSnapshot } from "../_lib/types";
import { useResource } from "../_lib/use-resource";
import { IssueDispatchPanel } from "./issue-dispatch-panel";

export default function TasksPage() {
  const resource = useResource<{ jobs: JobSnapshot[] }>("/api/jobs", 3_000);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (resource.data?.jobs ?? []).filter((snapshot) => {
      if (status !== "all" && snapshot.run.state !== status) return false;
      if (!normalized) return true;
      return [
        snapshot.job.id,
        snapshot.job.spec.taskId,
        snapshot.job.spec.issue?.reference.identifier,
        snapshot.job.spec.issue?.title,
        snapshot.job.spec.branchName,
        snapshot.project?.slug,
      ].some((value) => value?.toLowerCase().includes(normalized));
    });
  }, [query, resource.data?.jobs, status]);

  return (
    <div className="pageContent">
      <div className="pageToolbar">
        <div className="filterBar">
          <label><span className="srOnly">Search tasks</span><input placeholder="Search tasks" type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label><span className="srOnly">Filter by status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All states</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="waiting_for_review">Waiting review</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
              <option value="canceled">Canceled</option>
              <option value="timed_out">Timed out</option>
            </select>
          </label>
        </div>
        <button className="secondaryButton" type="button" onClick={() => void resource.refresh()}>Refresh</button>
      </div>
      <IssueDispatchPanel onDispatched={() => void resource.refresh()} />
      {resource.isLoading ? <LoadingState label="Loading tasks" /> : null}
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.refresh()} /> : null}
      {!resource.isLoading && !resource.error && filtered.length === 0 ? (
        <EmptyState title="No matching tasks" description="Change the filter or dispatch an Issue when a Project is configured." />
      ) : null}
      {filtered.length ? (
        <section className="panel">
          <div className="tableHeader taskColumns"><span>Task</span><span>Status</span><span>Project</span><span>Branch</span><span>Updated</span></div>
          <div className="dataList">
            {filtered.map((snapshot) => (
              <Link className="dataRow taskColumns" href={`/tasks/${snapshot.job.id}`} key={snapshot.job.id}>
                <span className="primaryCell">
                  <strong>{taskLabel(snapshot.job.spec.taskId, snapshot.job.spec.issue?.reference.identifier)}</strong>
                  <small>{snapshot.job.spec.issue?.title ?? snapshot.run.result?.summary ?? snapshot.job.id}</small>
                </span>
                <StatusBadge state={snapshot.run.state} />
                <span>{snapshot.project?.slug ?? snapshot.lane?.projectSlug ?? "unassigned"}</span>
                <span className="mono">{snapshot.job.spec.branchName}</span>
                <time>{relativeTime(snapshot.run.updatedAt)}</time>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
