"use client";

import Link from "next/link";

import { ErrorState, LoadingState } from "./_components/states";
import { StatusBadge } from "./_components/status-badge";
import { relativeTime, taskLabel } from "./_lib/format";
import type { ControlPlanePayload } from "./_lib/types";
import { useResource } from "./_lib/use-resource";

export default function Page() {
  const resource = useResource<ControlPlanePayload>("/api/control-plane", 5_000);

  if (resource.isLoading) return <div className="pageContent"><LoadingState label="Loading control plane" /></div>;
  if (resource.error || !resource.data) {
    return <div className="pageContent"><ErrorState message={resource.error ?? "Missing response"} onRetry={() => void resource.refresh()} /></div>;
  }

  const { controlPlane } = resource.data;
  return (
    <div className="pageContent">
      <div className="pageToolbar">
        <div className="pageIdentity">
          <StatusBadge state={controlPlane.status} tone={controlPlane.status === "ready" ? "good" : "warning"} />
          <span>Checked {relativeTime(controlPlane.checkedAt)}</span>
        </div>
        <button className="secondaryButton" type="button" onClick={() => void resource.refresh()}>Refresh</button>
      </div>

      <section aria-label="Control plane summary" className="metricGrid">
        <article className="metric"><span>Tasks</span><strong>{controlPlane.tasks.total}</strong><small>{controlPlane.tasks.withoutSessions} without Sessions</small></article>
        <article className="metric"><span>Active Sessions</span><strong>{controlPlane.sessions.active}</strong><small>{controlPlane.sessions.queued} queued</small></article>
        <article className="metric"><span>Runner capacity</span><strong>{controlPlane.runners.availableCapacity}</strong><small>{controlPlane.runners.activeSessions} / {controlPlane.runners.maxConcurrency} active</small></article>
        <article className="metric"><span>Review / failed</span><strong>{controlPlane.sessions.waitingForReview}</strong><small>{controlPlane.sessions.failed} failed</small></article>
      </section>

      <div className="dashboardGrid">
        <section className="panel">
          <div className="panelHeader"><h2>Recent tasks</h2><Link href="/tasks">View all</Link></div>
          {controlPlane.recentTasks.length === 0 ? (
            <div className="panelEmpty">No tasks have been submitted.</div>
          ) : (
            <div className="dataList">
              {controlPlane.recentTasks.map((task) => (
                <Link className="dataRow taskRow" href={`/tasks/${task.id}`} key={task.id}>
                  <span className="primaryCell">
                    <strong>{taskLabel(task.id, task.issue?.reference.identifier)}</strong>
                    <small>{task.issue?.title ?? task.objective}</small>
                  </span>
                  {task.latestSession ? <StatusBadge state={task.latestSession.state} /> : <span>No Sessions</span>}
                  <span className="quietCell">{task.sessionCount} Sessions</span>
                  <time>{relativeTime(task.updatedAt)}</time>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="panel capacityPanel">
          <div className="panelHeader"><h2>Runner health</h2><Link href="/runners">Inspect</Link></div>
          <dl className="definitionList">
            <div><dt>Online</dt><dd>{controlPlane.runners.online}</dd></div>
            <div><dt>Stale</dt><dd>{controlPlane.runners.stale}</dd></div>
            <div><dt>Active Sessions</dt><dd>{controlPlane.runners.activeSessions}</dd></div>
            <div><dt>Max concurrency</dt><dd>{controlPlane.runners.maxConcurrency}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}
