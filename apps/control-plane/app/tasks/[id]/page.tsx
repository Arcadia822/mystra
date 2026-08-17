"use client";

import type { Project, TaskDetailResponse } from "@mystra/shared";
import { ShellIcon, UiButton } from "@mystra/ui";
import { useParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { CreateSessionDialog } from "../../_components/create-session-dialog";
import { ShellMainHeader } from "../../_components/shell-main-header";
import { ErrorState, LoadingState } from "../../_components/states";
import { TaskDetailPanel } from "../../_components/task-detail-panel";
import { TaskSessionsPanel } from "../../_components/task-sessions-panel";
import { useResource } from "../../_lib/use-resource";

export default function TaskDetailPage() {
  const id = useParams<{ id: string }>().id;
  const detail = useResource<TaskDetailResponse>(`/api/tasks/${encodeURIComponent(id)}`, 0);
  const projects = useResource<{ projects: Project[] }>("/api/projects", 10_000);
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const newSessionRef = useRef<HTMLButtonElement>(null);
  const task = detail.data?.task;
  const projectExternalId = task?.projectId
    ? projects.data?.projects.find((project) => project.id === task.projectId)?.repositoryExternalId ?? null
    : null;
  const breadcrumbItems = useMemo(() => task ? [{ href: "/tasks", label: "Tasks" }, { label: task.title }] : [{ href: "/tasks", label: "Tasks" }, { label: "Task" }], [task]);
  const headerActions = useMemo(() => (
    <UiButton
      aria-expanded={createSessionOpen}
      aria-haspopup="dialog"
      aria-label="New Session"
      onClick={() => setCreateSessionOpen(true)}
      ref={newSessionRef}
      size="header"
    >
      <ShellIcon name="plus" />
      <span className="newSessionActionLabel">New Session</span>
    </UiButton>
  ), [createSessionOpen]);

  if (detail.isLoading) return <div className="pageContent"><LoadingState label="Loading task detail" /></div>;
  if (detail.error || !task) return <div className="pageContent"><ErrorState message={detail.error ?? "Task response missing"} onRetry={() => void detail.refresh()} /></div>;

  return (
    <>
      <ShellMainHeader actions={headerActions} breadcrumbItems={breadcrumbItems} />
      <TaskDetailPanel projectExternalId={projectExternalId} task={task} />
      <div className="taskDetailPrototype">
        <main className="taskDetailMain">
          <TaskSessionsPanel task={task} />
        </main>
      </div>
      {createSessionOpen ? (
        <CreateSessionDialog
          onClose={() => setCreateSessionOpen(false)}
          task={task}
          triggerRef={newSessionRef}
        />
      ) : null}
    </>
  );
}
