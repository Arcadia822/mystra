"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { taskLabel } from "../_lib/format";
import { taskTitle } from "../_lib/task-view";
import type { TaskListItem } from "../_lib/types";
import { filterTasks, selectedSearchTask } from "./shell-model";
import { ShellIcon } from "./shell-icons";
import { UiActionLink, UiButton, UiIconButton } from "./ui-actions";
import { UiInput } from "./ui-fields";
import { UiDialogSurface, UiSurface, UiSurfaceBody, UiSurfaceHeader } from "./ui-surfaces";

interface ShellSearchDialogProps {
  actionsLabel: string;
  closeLabel: string;
  emptyLabel: string;
  locale: "en" | "zh-CN";
  newTaskLabel: string;
  noTasksLabel: string;
  open: boolean;
  openTaskLabel: string;
  onClose: () => void;
  placeholder: string;
  previewEmptyLabel: string;
  repositoryLabel: string;
  issueLabel: string;
  showAllLabel: string;
  tasks: TaskListItem[];
  tasksLabel: string;
  title: string;
  updatedLabel: string;
}

function formatSearchDate(value: string, locale: ShellSearchDialogProps["locale"]): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

export function ShellSearchDialog({
  actionsLabel,
  closeLabel,
  emptyLabel,
  locale,
  newTaskLabel,
  noTasksLabel,
  open,
  openTaskLabel,
  onClose,
  placeholder,
  previewEmptyLabel,
  repositoryLabel,
  issueLabel,
  showAllLabel,
  tasks,
  tasksLabel,
  title,
  updatedLabel,
}: ShellSearchDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const results = useMemo(() => filterTasks(tasks, query), [query, tasks]);
  const selectedTask = selectedSearchTask(results, selectedId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedId(undefined);
    }
  }, [open]);

  return (
    <dialog
      aria-labelledby="shell-search-title"
      className="searchDialog"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onClose();
      }}
    >
      <UiDialogSurface className="searchDialogPanel">
        <UiSurfaceHeader className="searchDialogHeader">
          <h2 className="srOnly" id="shell-search-title">{title}</h2>
          <label className="searchDialogInput">
            <span className="srOnly">{placeholder}</span>
            <UiInput autoFocus placeholder={placeholder} type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <ShellIcon name="search" />
          <UiIconButton aria-label={closeLabel} className="compactIconButton" onClick={onClose}><ShellIcon name="close" /></UiIconButton>
        </UiSurfaceHeader>

        <div className="searchDialogWorkspace">
          <aside className="searchListPane">
            <section aria-labelledby="search-actions-title" className="searchActions">
              <header className="searchSectionHeader">
                <h3 id="search-actions-title">{actionsLabel}</h3>
                <UiActionLink href="/tasks" size="compact" onClick={onClose}>{showAllLabel}</UiActionLink>
              </header>
              <UiActionLink block className="searchAction" href="/new" onClick={onClose}>
                <span className="searchResultIcon"><ShellIcon name="new" /></span>
                <span>{newTaskLabel}</span>
              </UiActionLink>
            </section>

            <section aria-labelledby="search-results-title" className="searchResultsSection">
              <header className="searchSectionHeader">
                <h3 id="search-results-title">{tasksLabel}</h3>
              </header>
              {results.length > 0 ? (
                <ul className="searchResults">
                  {results.map((task) => {
                    const selected = task.id === selectedTask?.id;
                    return (
                      <li key={task.id}>
                        <UiButton
                          active={selected}
                          aria-pressed={selected}
                          block
                          className="searchResult"
                          onClick={() => setSelectedId(task.id)}
                        >
                          <span className="searchResultCopy">
                            <strong>{taskTitle(task)}</strong>
                            <small>{taskLabel(task.id, task.issue?.identifier)} · {task.projectId ?? "No project"}</small>
                          </span>
                          <time dateTime={task.updatedAt}>{formatSearchDate(task.updatedAt, locale)}</time>
                        </UiButton>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="searchEmpty" role="status">{query.trim() ? emptyLabel : noTasksLabel}</p>
              )}
            </section>
          </aside>

          <section aria-live="polite" className="searchPreview">
            {selectedTask ? (
              <UiSurface as="article" className="searchPreviewCard" variant="ghost">
                <UiSurfaceHeader className="searchPreviewHeader">
                  <div>
                    <span className="searchPreviewEyebrow">{tasksLabel}</span>
                    <h3>{taskTitle(selectedTask)}</h3>
                  </div>
                  <div className="searchPreviewActions">
                    <UiActionLink href={`/tasks/${selectedTask.id}`} size="compact" tone="soft" onClick={onClose}>{openTaskLabel}</UiActionLink>
                  </div>
                </UiSurfaceHeader>
                <UiSurfaceBody className="searchPreviewBody">
                  <p>{selectedTask.description ?? selectedTask.title}</p>
                  <dl className="searchPreviewFacts">
                    <div><dt>{repositoryLabel}</dt><dd>{selectedTask.projectId ?? "No project"}</dd></div>
                    <div><dt>{issueLabel}</dt><dd>{selectedTask.issue?.identifier ?? "No Issue"}</dd></div>
                    <div><dt>{updatedLabel}</dt><dd><time dateTime={selectedTask.updatedAt}>{formatSearchDate(selectedTask.updatedAt, locale)}</time></dd></div>
                    <div><dt>Task ID</dt><dd>{taskLabel(selectedTask.id, selectedTask.issue?.identifier)}</dd></div>
                  </dl>
                </UiSurfaceBody>
              </UiSurface>
            ) : (
              <p className="searchPreviewEmpty">{previewEmptyLabel}</p>
            )}
          </section>
        </div>
      </UiDialogSurface>
    </dialog>
  );
}
