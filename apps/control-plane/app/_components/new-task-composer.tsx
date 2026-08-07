"use client";

import type { Project } from "@mystra/shared";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useResource } from "../_lib/use-resource";
import { MystraLogo } from "./mystra-logo";
import { ShellIcon } from "./shell-icons";
import { UiIconButton } from "./ui-actions";
import { UiDropdown } from "./ui-dropdown";
import { UiTextarea } from "./ui-fields";

interface TaskCreateResponse {
  task?: { id?: string };
  error?: { message?: string };
}

export function NewTaskComposer() {
  const router = useRouter();
  const projectsResource = useResource<{ projects: Project[] }>("/api/projects", 10_000);
  const projects = projectsResource.data?.projects ?? [];
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId),
    [projectId, projects],
  );
  const canSubmit = Boolean(selectedProject && title.trim() && !isSubmitting);

  async function createTask() {
    if (!selectedProject || !title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject.id,
          metadata: { title: title.trim() },
        }),
      });
      const payload = await response.json() as TaskCreateResponse;
      if (!response.ok || !payload.task?.id) {
        throw new Error(payload.error?.message ?? `Task creation failed with status ${response.status}`);
      }
      router.push(`/tasks/${payload.task.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="new-task-heading" className="newTaskSurface">
      <div className="newTaskLogo">
        <MystraLogo className="newTaskLogoMark" title="Mystra" />
      </div>
      <h1 className="srOnly" id="new-task-heading">Create a new Task</h1>

      <form
        className="newTaskComposer"
        onSubmit={(event) => {
          event.preventDefault();
          void createTask();
        }}
      >
        <label className="newTaskInputLabel" htmlFor="new-task-title">Task label</label>
        <UiTextarea
          autoFocus
          id="new-task-title"
          placeholder="Name this Task"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && canSubmit) {
              event.preventDefault();
              void createTask();
            }
          }}
        />

        <footer className="newTaskComposerFooter">
          <div className="composerTools">
            <UiIconButton aria-label="Attach file" className="composerIconButton" disabled size="header" title="Attachments are not available">
              <ShellIcon name="attachment" />
            </UiIconButton>
            <UiDropdown
              aria-label="Project"
              className="composerProjectDropdown"
              disabled={projectsResource.isLoading || projects.length === 0}
              icon={<ShellIcon name="project" />}
              onValueChange={setProjectId}
              options={projects.map((project) => ({
                value: project.id,
                label: project.name,
                description: project.repositoryExternalId,
              }))}
              placeholder="Project"
              value={projectId}
            />
          </div>

          <div className="composerActions">
            <UiIconButton aria-label="Voice input" className="composerIconButton" disabled size="header" title="Voice input is not available">
              <ShellIcon name="microphone" />
            </UiIconButton>
            <UiIconButton aria-label="Create Task" className="composerSendButton" data-loading={isSubmitting || undefined} disabled={!canSubmit} size="default" tone="solid" type="submit">
              <ShellIcon name={isSubmitting ? "spinner" : "send"} />
            </UiIconButton>
          </div>
        </footer>
      </form>

      {projectsResource.error ? <p className="newTaskNotice error" role="alert">{projectsResource.error}</p> : null}
      {error ? <p className="newTaskNotice error" role="alert">{error}</p> : null}
    </section>
  );
}
