"use client";

import type { TaskDetailResponse, TaskWorkspaceView } from "@mystra/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ErrorState, LoadingState } from "../../_components/states";
import {
  createTaskDetailEditor,
  taskDetailEditorDirty,
  taskDetailEditorSaved,
  validateTaskDetailEditor,
  type TaskDetailEditorState,
} from "../../_components/task-detail-model";
import { TASK_DETAIL_COPY } from "../../_components/shell-copy";
import { useShellLocale } from "../../_components/shell-locale";
import { TaskWorkspacePanel } from "../../_components/task-workspace-panel";
import { TaskSessionsPanel } from "../../_components/task-sessions-panel";
import { UiActionAnchor, UiButton } from "../../_components/ui-actions";
import { UiInput, UiTextarea } from "../../_components/ui-fields";
import { relativeTime } from "../../_lib/format";
import { useResource } from "../../_lib/use-resource";

export default function TaskDetailPage() {
  const id = useParams<{ id: string }>().id;
  const locale = useShellLocale();
  const copy = TASK_DETAIL_COPY[locale];
  const detail = useResource<TaskDetailResponse>(`/api/tasks/${encodeURIComponent(id)}`, 0);
  const [editor, setEditor] = useState<TaskDetailEditorState | null>(null);
  const [workspace, setWorkspace] = useState<TaskWorkspaceView | null>(null);

  useEffect(() => {
    if (detail.data?.task) setEditor(createTaskDetailEditor(detail.data.task));
  }, [detail.data?.task]);

  if (detail.isLoading) return <div className="pageContent"><LoadingState label="Loading task detail" /></div>;
  if (detail.error || !detail.data || !editor) {
    return <div className="pageContent"><ErrorState message={detail.error ?? "Task response missing"} onRetry={() => void detail.refresh()} /></div>;
  }
  const { task, issueResolution } = detail.data;
  const currentEditor = editor;
  const validation = validateTaskDetailEditor(editor);

  async function save() {
    if (validation) {
      document.getElementById("task-detail-title")?.focus();
      setEditor((current) => current ? { ...current, status: "error", error: copy.invalidTitle } : current);
      return;
    }
    setEditor((current) => current ? { ...current, status: "saving", error: null } : current);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: currentEditor.title, description: currentEditor.description || null }),
      });
      const payload = await response.json() as { task?: typeof task; error?: { message?: string } };
      if (!response.ok || !payload.task) throw new Error(payload.error?.message ?? `Save failed with status ${response.status}`);
      setEditor(taskDetailEditorSaved(payload.task));
      await detail.refresh();
    } catch (error) {
      setEditor((current) => current ? { ...current, status: "error", error: error instanceof Error ? error.message : String(error) } : current);
    }
  }

  return (
    <div className="pageContent taskDetailPage">
      <div className="pageToolbar">
        <div className="pageIdentity"><Link className="backLink" href="/tasks">← {copy.back}</Link><strong>{task.title}</strong></div>
        <span className="mono">{task.id}</span>
      </div>
      <div className="detailStack">
        <section className="panel taskEditorPanel">
          <label htmlFor="task-detail-title">{copy.title}</label>
          <UiInput
            id="task-detail-title"
            maxLength={500}
            onChange={(event) => setEditor({ ...editor, title: event.target.value, error: null })}
            value={editor.title}
          />
          <label htmlFor="task-detail-description">{copy.description}</label>
          <UiTextarea
            className="taskDetailDescription"
            id="task-detail-description"
            maxLength={100_000}
            onChange={(event) => setEditor({ ...editor, description: event.target.value, error: null })}
            value={editor.description}
          />
          <div className="taskEditorActions">
            <span aria-live="polite" className={editor.error ? "formError" : "pageDescription"}>{editor.error ?? ""}</span>
            <UiButton disabled={!taskDetailEditorDirty(editor) || editor.status === "saving"} onClick={() => void save()} tone="solid">
              {editor.status === "saving" ? copy.saving : copy.save}
            </UiButton>
          </div>
        </section>
        <section className="panel">
          <dl className="definitionList">
            <div><dt>{copy.project}</dt><dd className="mono">{task.projectId ?? copy.noProject}</dd></div>
            <div><dt>{copy.issue}</dt><dd>{issueResolution?.status === "available" ? <UiActionAnchor href={issueResolution.url} rel="noreferrer" target="_blank">{issueResolution.identifier} · {issueResolution.title}</UiActionAnchor> : task.issue ? `${task.issue.identifier} · ${copy.issueUnavailable}` : copy.noIssue}</dd></div>
            <div><dt>{copy.updated}</dt><dd>{relativeTime(task.updatedAt)} · {task.updatedAt}</dd></div>
          </dl>
        </section>
        <TaskWorkspacePanel task={task} onWorkspaceChange={setWorkspace} />
        <TaskSessionsPanel task={task} workspace={workspace} />
      </div>
    </div>
  );
}
