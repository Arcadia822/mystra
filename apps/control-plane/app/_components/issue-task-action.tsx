"use client";

import { useEffect, useState } from "react";

import {
  issueTaskActionFailed,
  issueTaskActionInitial,
  issueTaskActionStarted,
  issueTaskActionSucceeded,
} from "./issue-task-action-model";
import { ISSUE_COPY, type ShellLocale } from "./shell-copy";
import { UiActionLink, UiButton } from "./ui-actions";

export function IssueTaskAction(props: {
  projectSlug: string;
  provider: "github" | "linear";
  externalId: string;
  identifier: string;
  taskId?: string;
  locale: ShellLocale;
  onLinked: (externalId: string, taskId: string) => void;
}) {
  const copy = ISSUE_COPY[props.locale];
  const [state, setState] = useState(() => issueTaskActionInitial(props.taskId));

  useEffect(() => {
    if (props.taskId) setState(issueTaskActionSucceeded(props.taskId));
  }, [props.taskId]);

  async function create() {
    if (state.status === "creating") return;
    setState(issueTaskActionStarted());
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(props.projectSlug)}/issues/${props.provider}/task`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ externalId: props.externalId, identifier: props.identifier }),
        },
      );
      const payload = await response.json() as { task?: { id?: string }; error?: { message?: string } };
      if (!response.ok || !payload.task?.id) throw new Error(payload.error?.message ?? copy.taskCreateFailed);
      setState(issueTaskActionSucceeded(payload.task.id));
      props.onLinked(props.externalId, payload.task.id);
    } catch (error) {
      setState(issueTaskActionFailed(error instanceof Error ? error.message : copy.taskCreateFailed));
    }
  }

  if (state.status === "linked") {
    return <UiActionLink className="issueTaskAction" href={`/tasks/${state.taskId}`} size="compact" tone="soft">{copy.openTask}</UiActionLink>;
  }
  return (
    <span className="issueTaskActionCell">
      <UiButton
        className="issueTaskAction"
        disabled={state.status === "creating"}
        onClick={() => void create()}
        size="compact"
        tone="soft"
      >
        {state.status === "creating" ? copy.creatingTask : state.status === "error" ? copy.retryTask : copy.createTask}
      </UiButton>
      <span aria-live="polite" className="issueTaskActionError" role={state.status === "error" ? "alert" : undefined}>
        {state.status === "error" ? state.message : ""}
      </span>
    </span>
  );
}
