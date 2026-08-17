"use client";

import type { Project } from "@mystra/shared";
import {
  ShellIcon,
  UiButton,
  UiDialogCloseButton,
  UiDialogSurface,
  UiDialogTitleInput,
  UiDropdown,
  UiSurfaceBody,
  UiSurfaceFooter,
  UiSurfaceHeader,
  UiTextarea,
} from "@mystra/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";

import { useResource } from "../_lib/use-resource";

function responseError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error as { message?: unknown };
    if (typeof error?.message === "string") return error.message;
  }
  return `Task creation failed (${status})`;
}

export function NewTaskDialog({ locale, onClose, onCreated, triggerRef }: {
  locale: "en" | "zh-CN";
  onClose: () => void;
  onCreated: () => Promise<void>;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const zh = locale === "zh-CN";
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const projects = useResource<{ projects: Project[] }>("/api/projects", 10_000);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function close() {
    onClose();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  async function createTask() {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          projectId: projectId || null,
          metadata: {},
          idempotencyKey,
        }),
      });
      const payload = await response.json() as { task?: { id: string }; error?: unknown };
      if (!response.ok || !payload.task) throw new Error(responseError(payload, response.status));
      await onCreated();
      onClose();
      router.push(`/tasks/${encodeURIComponent(payload.task.id)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setSubmitting(false);
    }
  }

  return (
    <dialog
      aria-labelledby="new-task-dialog-title"
      className="featureDialog"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      onClose={close}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
      ref={dialogRef}
    >
      <UiDialogSurface className="taskComposer" layout="rows">
        <UiSurfaceHeader className="taskComposerHeader">
          <UiDialogTitleInput
            autoFocus
            aria-label={zh ? "Task 名称" : "Task name"}
            id="new-task-dialog-title"
            maxLength={500}
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder={zh ? "Task 名称" : "Task name"}
            value={title}
          />
          <UiDialogCloseButton aria-label={zh ? "关闭" : "Close"} onClick={close} />
        </UiSurfaceHeader>
        <UiSurfaceBody>
          <UiTextarea
            aria-label={zh ? "Task 描述" : "Task description"}
            className="taskDescription"
            maxLength={100_000}
            onChange={(event) => setDescription(event.currentTarget.value)}
            placeholder={zh ? "添加描述…" : "Add a description…"}
            rows={3}
            value={description}
          />
          {error || projects.error ? <p className="formError" role="alert">{error ?? projects.error}</p> : null}
        </UiSurfaceBody>
        <UiSurfaceFooter className="taskComposerFooter">
          <UiDropdown
            aria-label="Project"
            disabled={projects.isLoading || submitting}
            icon={<ShellIcon name="project" />}
            onValueChange={setProjectId}
            options={[
              { value: "", label: zh ? "无 Project" : "No project" },
              ...(projects.data?.projects ?? []).map((project) => ({
                value: project.id,
                label: project.repositoryExternalId,
              })),
            ]}
            placeholder={zh ? "无 Project" : "No project"}
            size="inline"
            value={projectId}
            variant="ghost"
          />
          <UiButton disabled={!title.trim() || submitting} onClick={() => void createTask()} size="inline" tone="solid">
            {submitting ? (zh ? "创建中…" : "Creating…") : (zh ? "创建" : "Create")}
          </UiButton>
        </UiSurfaceFooter>
      </UiDialogSurface>
    </dialog>
  );
}
