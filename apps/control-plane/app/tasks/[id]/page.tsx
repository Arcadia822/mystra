"use client";

import type { TaskDetailResponse } from "@mystra/shared";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ErrorState, LoadingState } from "../../_components/states";
import { relativeTime, taskLabel } from "../../_lib/format";
import { taskTitle } from "../../_lib/task-view";
import { useResource } from "../../_lib/use-resource";

export default function TaskDetailPage() {
  const id = useParams<{ id: string }>().id;
  const detail = useResource<TaskDetailResponse>(`/api/tasks/${encodeURIComponent(id)}`, 5_000);

  if (detail.isLoading) return <div className="pageContent"><LoadingState label="Loading task detail" /></div>;
  if (detail.error || !detail.data) {
    return <div className="pageContent"><ErrorState message={detail.error ?? "Task response missing"} onRetry={() => void detail.refresh()} /></div>;
  }
  const { task } = detail.data;

  return (
    <div className="pageContent">
      <div className="pageToolbar">
        <div className="pageIdentity"><Link className="backLink" href="/tasks">← Tasks</Link><strong>{taskLabel(task.id, task.issueDispatchKey)}</strong></div>
        <button className="secondaryButton" type="button" onClick={() => void detail.refresh()}>Refresh</button>
      </div>
      <div className="detailGrid">
        <section className="panel">
          <div className="panelHeader"><h2>{taskTitle(task)}</h2><span className="mono">{task.id}</span></div>
          <dl className="definitionList">
            <div><dt>Project</dt><dd className="mono">{task.projectId}</dd></div>
            <div><dt>Issue dispatch key</dt><dd className="mono">{task.issueDispatchKey ?? "none"}</dd></div>
            <div><dt>Metadata keys</dt><dd>{Object.keys(task.metadata).sort().join(", ") || "none"}</dd></div>
            <div><dt>Updated</dt><dd>{relativeTime(task.updatedAt)} · {task.updatedAt}</dd></div>
          </dl>
        </section>
        <section className="panel" role="status">
          <div className="panelHeader"><h2>Sessions</h2><span>Temporarily unavailable</span></div>
          <p className="pageDescription">Session creation and execution are paused while Session persistence is outside the active Prisma schema.</p>
        </section>
      </div>
    </div>
  );
}
