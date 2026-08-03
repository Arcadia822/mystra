"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { EmptyState, ErrorState, LoadingState } from "../../_components/states";
import { StatusBadge } from "../../_components/status-badge";
import { relativeTime } from "../../_lib/format";
import type { Runner } from "../../_lib/types";
import { useResource } from "../../_lib/use-resource";

export default function RunnerDetailPage() {
  const id = useParams<{ id: string }>().id;
  const resource = useResource<{ runner: Runner }>(`/api/runners/${encodeURIComponent(id)}`, 5_000);
  if (resource.isLoading) return <div className="pageContent"><LoadingState label="Loading Runner detail" /></div>;
  if (resource.error || !resource.data) return <div className="pageContent"><ErrorState message={resource.error ?? "Runner response missing"} onRetry={() => void resource.refresh()} /></div>;
  const { runner } = resource.data;

  return (
    <div className="pageContent">
      <div className="pageToolbar"><div className="pageIdentity"><Link className="backLink" href="/runners">← Runners</Link><strong>{runner.name}</strong><StatusBadge state={runner.health} tone={runner.health === "healthy" ? "good" : "bad"} /></div><button className="secondaryButton" type="button" onClick={() => void resource.refresh()}>Refresh</button></div>
      <div className="detailGrid">
        <section className="panel">
          <div className="panelHeader"><h2>Runner</h2><span className="mono">{runner.id}</span></div>
          <dl className="definitionList"><div><dt>Last heartbeat</dt><dd>{relativeTime(runner.lastHeartbeatAt)} · {runner.lastHeartbeatAt}</dd></div><div><dt>Concurrency</dt><dd>{runner.activeSessionCount} active / {runner.maxConcurrency} max</dd></div><div><dt>Executor</dt><dd>{runner.capabilities.executor}</dd></div><div><dt>Agents</dt><dd>{runner.capabilities.agents.join(", ") || "none"}</dd></div><div><dt>Image</dt><dd className="mono">{runner.capabilities.image ?? "not reported"}</dd></div><div><dt>Stale threshold</dt><dd>{runner.staleAfterSeconds}s</dd></div></dl>
        </section>
        <section className="panel">
          <div className="panelHeader"><h2>Current assignments</h2><span>{runner.currentAssignments.length}</span></div>
          {runner.currentAssignments.length === 0 ? <EmptyState title="No assignments" description="This Runner currently owns no active Session." /> : <div className="dataList">{runner.currentAssignments.map((assignment) => <Link className="dataRow compactRow" href={`/sessions/${assignment.sessionId}`} key={assignment.sessionId}><span className="primaryCell"><strong>{assignment.sessionId}</strong><small>Task {assignment.taskId}</small></span><StatusBadge state="active" /></Link>)}</div>}
        </section>
      </div>
    </div>
  );
}
