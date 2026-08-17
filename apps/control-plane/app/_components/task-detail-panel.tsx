"use client";

import type { Task, TaskStatus, TaskStatusActor } from "@mystra/shared";
import { TASK_STATUS_LABELS, TaskStatusIcon, UiLabel } from "@mystra/ui";

import { useResource } from "../_lib/use-resource";
import { ShellRightPanel } from "./shell-right-panel";

interface ProductionView {
  task: Task;
  transitions: Array<{
    id: string;
    fromStatus: TaskStatus;
    toStatus: TaskStatus;
    revision: number;
    actor: TaskStatusActor;
    note: string | null;
    occurredAt: string;
  }>;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function actorLabel(actor: TaskStatusActor): string {
  return actor.actorId ?? actor.agentId ?? actor.kind;
}

export function TaskDetailPanel({ projectExternalId, task }: { projectExternalId: string | null; task: Task }) {
  const production = useResource<ProductionView>(`/api/tasks/${encodeURIComponent(task.id)}/production`, 3_000);
  const current = production.data?.task ?? task;
  const metadata = Object.entries(current.metadata).sort(([left], [right]) => left.localeCompare(right));

  return (
    <ShellRightPanel ariaLabel="Task details" header="Properties">
      <div className="taskDetailRightPanel">
        <dl className="taskPropertyList">
          <div><dt>Status</dt><dd><span className="taskPropertyStatus"><TaskStatusIcon status={current.status} />{TASK_STATUS_LABELS[current.status]}</span></dd></div>
          <div><dt>Task ID</dt><dd className="mono">{current.id}</dd></div>
          <div><dt>Runtime</dt><dd className="mono">{current.runtimeId ?? "—"}</dd></div>
          <div><dt>Project</dt><dd>{projectExternalId ? <UiLabel icon="github">{projectExternalId}</UiLabel> : "—"}</dd></div>
          <div><dt>Issue</dt><dd>{current.issue ? <UiLabel icon={current.issue.provider}>{current.issue.identifier}</UiLabel> : "—"}</dd></div>
          <div><dt>Metadata</dt><dd className="taskPropertyLabels">{metadata.length > 0 ? metadata.map(([key, value]) => <UiLabel key={key}><span className="taskLabelKey">{key}</span>{typeof value === "string" ? value : JSON.stringify(value)}</UiLabel>) : "—"}</dd></div>
          <div><dt>Created</dt><dd><time dateTime={current.createdAt}>{dateFormatter.format(new Date(current.createdAt))}</time></dd></div>
          <div><dt>Updated</dt><dd><time dateTime={current.updatedAt}>{dateFormatter.format(new Date(current.updatedAt))}</time></dd></div>
        </dl>

        <section aria-labelledby="task-status-history-title" className="taskStatusHistorySection">
          <h2 id="task-status-history-title">Status history</h2>
          {production.error ? <p className="formError" role="alert">{production.error}</p> : null}
          <ol className="taskStatusHistory">
            {(production.data?.transitions ?? []).map((transition) => <li key={transition.id}>
              <TaskStatusIcon status={transition.toStatus} />
              <span>
                <strong>{TASK_STATUS_LABELS[transition.toStatus]}</strong>
                <small>{actorLabel(transition.actor)} · <time dateTime={transition.occurredAt}>{dateFormatter.format(new Date(transition.occurredAt))}</time></small>
                {transition.note ? <small>{transition.note}</small> : null}
              </span>
            </li>)}
            <li>
              <TaskStatusIcon status="pending" />
              <span><strong>Task created</strong><small><time dateTime={current.createdAt}>{dateFormatter.format(new Date(current.createdAt))}</time></small></span>
            </li>
          </ol>
        </section>
      </div>
    </ShellRightPanel>
  );
}
