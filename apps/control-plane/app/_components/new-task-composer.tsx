"use client";

import type { Project } from "@mystra/shared";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useResource } from "../_lib/use-resource";
import { MystraLogo } from "./mystra-logo";
import { ShellIcon } from "./shell-icons";
import { UiIconButton } from "./ui-actions";
import { UiSelect, UiTextarea } from "./ui-fields";

interface TaskCreateResponse {
  task?: { id?: string };
  error?: { code?: string; message?: string };
}

export function NewTaskComposer() {
  const router = useRouter();
  const projectsResource = useResource<{ projects: Project[] }>("/api/projects", 10_000);
  const projects = projectsResource.data?.projects ?? [];
  const [objective, setObjective] = useState("");
  const [projectId, setProjectId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId),
    [projectId, projects],
  );
  const canSubmit = objective.trim().length > 0 && Boolean(selectedProject) && !isSubmitting;

  async function createTask() {
    if (!selectedProject || !objective.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "api",
          projectId: selectedProject.id,
          objective: objective.trim(),
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
      <div aria-label="Mystra" className="newTaskLogo">
        <MystraLogo className="newTaskLogoMark" />
        <strong>Mystra</strong>
      </div>
      <h1 className="srOnly" id="new-task-heading">Create a new Task</h1>

      <form
        className="newTaskComposer"
        onSubmit={(event) => {
          event.preventDefault();
          void createTask();
        }}
      >
        <label className="newTaskInputLabel" htmlFor="new-task-objective">Task objective</label>
        <UiTextarea
          autoFocus
          id="new-task-objective"
          placeholder="What should Mystra work on?"
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && canSubmit) {
              event.preventDefault();
              void createTask();
            }
          }}
        />

        <footer className="newTaskComposerFooter">
          <div className="composerTools">
            <UiIconButton aria-label="Attach file" className="composerIconButton" disabled size="header" title="Attachments are not connected to the Task API yet">
              <ShellIcon name="attachment" />
            </UiIconButton>
            <label className="composerSelect">
              <ShellIcon name="repository" />
              <span className="srOnly">Repository</span>
              <UiSelect aria-label="Repository" fieldSize="header" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">Repository</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.repository.fullName}</option>)}
              </UiSelect>
            </label>
            <label className="composerSelect muted" title="Issue dispatch selection is not connected in this slice">
              <ShellIcon name="issue" />
              <span className="srOnly">Issue</span>
              <UiSelect aria-label="Issue" disabled defaultValue="" fieldSize="header">
                <option value="">Issue</option>
              </UiSelect>
            </label>
          </div>

          <div className="composerActions">
            <UiIconButton aria-label="Voice input" className="composerIconButton" disabled size="header" title="Voice input is not available">
              <ShellIcon name="microphone" />
            </UiIconButton>
            <UiIconButton aria-label="Send Task" className="composerSendButton" data-loading={isSubmitting || undefined} disabled={!canSubmit} size="default" tone="solid" type="submit">
              <ShellIcon name={isSubmitting ? "spinner" : "send"} />
            </UiIconButton>
          </div>
        </footer>
      </form>

      {projectsResource.error ? <p className="newTaskNotice error" role="alert">{projectsResource.error}</p> : null}
      {!projectsResource.isLoading && projects.length === 0 ? <p className="newTaskNotice">Configure a Project before creating a Task.</p> : null}
      {error ? <p className="newTaskNotice error" role="alert">{error}</p> : null}
    </section>
  );
}
