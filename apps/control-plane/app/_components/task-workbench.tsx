"use client";

import type { TaskStatus, TaskWorkbenchItem, TaskWorkbenchPage } from "@mystra/shared";
import {
  ShellIcon,
  StackedList,
  StackedListField,
  StackedListHelperRow,
  StackedListRow,
  TASK_STATUS_LABELS,
  TaskStatusIcon,
  UiActionAnchor,
  UiButton,
  UiCheckbox,
  UiDropdown,
  UiIconButton,
  UiLabel,
  UiLabelOverflow,
  UiPopover,
  UiSegmented,
  UiSurface,
  type StackedListStandardFieldDefinition,
  type UiLabelOverflowItem,
} from "@mystra/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useResource } from "../_lib/use-resource";
import {
  getVisibleTaskProperties,
  TASK_PROPERTY_ROWS,
  TASK_STATUS_ORDER,
  taskPageUrl,
  type OptionalTaskProperty,
  type TaskProperty,
  type TaskWorkbenchLayout,
} from "./task-workbench-model";

const fields = [
  { key: "status", align: "left", renderType: "icon" },
  { key: "taskid", align: "left", equalWidth: true, renderType: "text" },
  { key: "name", align: "left", renderType: "text" },
  { key: "project", align: "right", renderType: "labels" },
  { key: "issue", align: "right", renderType: "labels" },
  { key: "metadata", align: "right", renderType: "labels" },
  { key: "updated", align: "right", equalWidth: true, renderType: "datetime" },
  { key: "created", align: "right", equalWidth: true, renderType: "datetime" },
] as const satisfies readonly StackedListStandardFieldDefinition[];

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function TaskDate({ value }: { value: string }) {
  return <time dateTime={value}>{dateFormatter.format(new Date(value))}</time>;
}

function metadataEntries(task: TaskWorkbenchItem): Array<[string, string]> {
  return Object.entries(task.metadata)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]);
}

function TaskPropertyLabels({ task, visible }: { task: TaskWorkbenchItem; visible: ReadonlySet<TaskProperty> }) {
  const items: UiLabelOverflowItem[] = [];
  if (visible.has("project") && task.projectReference) {
    items.push({ content: task.projectReference.repositoryExternalId, icon: "github", id: `project:${task.projectReference.repositoryExternalId}` });
  }
  if (visible.has("issue") && task.issue) {
    items.push({ content: task.issue.identifier, icon: task.issue.provider, id: `issue:${task.issue.externalId}` });
  }
  if (visible.has("metadata")) {
    items.push(...metadataEntries(task).map(([key, value]) => ({
      content: <><span className="taskLabelKey">{key}</span>{value}</>,
      id: `metadata:${key}`,
    })));
  }
  return <UiLabelOverflow aria-label={`Properties for ${task.title}`} items={items} />;
}

export function TaskWorkbench() {
  const router = useRouter();
  const [layout, setLayout] = useState<TaskWorkbenchLayout>("table");
  const [query, setQuery] = useState("");
  const [settledQuery, setSettledQuery] = useState("");
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [sort, setSort] = useState<"updatedAt" | "createdAt" | "title" | "status">("updatedAt");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [optional, setOptional] = useState<Record<OptionalTaskProperty, boolean>>({ taskid: false, issue: true, updated: false });
  const requestUrl = taskPageUrl({ query: settledQuery, statuses, sort, direction });
  const page = useResource<TaskWorkbenchPage>(requestUrl, 0);
  const [items, setItems] = useState<TaskWorkbenchItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [appendError, setAppendError] = useState<string | null>(null);
  const visible = useMemo(() => new Set(getVisibleTaskProperties(optional)), [optional]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettledQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!page.data) return;
    setItems(page.data.items);
    setNextCursor(page.data.nextCursor);
    setAppendError(null);
  }, [page.data]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setAppendError(null);
    try {
      const response = await fetch(taskPageUrl({ query: settledQuery, statuses, sort, direction, cursor: nextCursor }), { cache: "no-store" });
      const payload = await response.json() as TaskWorkbenchPage & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? `Task page failed (${response.status})`);
      setItems((current) => [...current, ...payload.items.filter((candidate) => !current.some((item) => item.id === candidate.id))]);
      setNextCursor(payload.nextCursor);
    } catch (caught) {
      setAppendError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoadingMore(false);
    }
  }

  function toggleStatus(status: TaskStatus) {
    setStatuses((current) => current.includes(status) ? current.filter((item) => item !== status) : [...current, status]);
  }

  return (
    <section className="taskWorkbench" aria-label="Tasks workbench">
      <div aria-label="Task list controls" className="taskToolbar">
        <label className="taskSearch"><ShellIcon name="search" /><input aria-label="Search tasks" onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search tasks…" type="search" value={query} /></label>
        <div className="taskToolbarActions">
          <UiPopover aria-label="Filter tasks" icon="filter" popupClassName="taskDisplayPopup">
            <div className="displayMenuSection">
              <div className="displayMenuLabel"><ShellIcon name="filter" />Status</div>
              {TASK_STATUS_ORDER.map((status) => (
                <label className="displayPropertyRow" key={status}>
                  <UiCheckbox checked={statuses.includes(status)} onChange={() => toggleStatus(status)} />
                  <TaskStatusIcon status={status} /><span>{TASK_STATUS_LABELS[status]}</span>
                </label>
              ))}
            </div>
          </UiPopover>
          <UiDropdown
            aria-label="Sort tasks"
            onValueChange={(value) => setSort(value as typeof sort)}
            options={[
              { value: "updatedAt", label: "Updated" },
              { value: "createdAt", label: "Created" },
              { value: "title", label: "Name" },
              { value: "status", label: "Status" },
            ]}
            placeholder="Updated"
            size="inline"
            value={sort}
            variant="ghost"
          />
          <UiIconButton aria-label={`Sort ${direction === "asc" ? "descending" : "ascending"}`} onClick={() => setDirection((value) => value === "asc" ? "desc" : "asc")} title="Reverse sort"><ShellIcon className={direction === "desc" ? "sortDirectionIcon isDescending" : "sortDirectionIcon"} name="arrow-up" /></UiIconButton>
          <UiPopover aria-label="Display options" className="taskDisplayPopover" icon="display" popupClassName="taskDisplayPopup">
            <div className="displayMenuSection">
              <div className="displayMenuLabel"><ShellIcon name="display" />Layout</div>
              <UiSegmented aria-label="Task layout" onValueChange={setLayout} options={[{ value: "table", label: "Table", icon: <ShellIcon name="list" /> }, { value: "kanban", label: "Kanban", icon: <ShellIcon name="kanban" /> }]} value={layout} />
            </div>
            <div className="displayMenuSection">
              <div className="displayMenuLabel"><ShellIcon name="review" />Properties</div>
              {TASK_PROPERTY_ROWS.map((property) => (
                <label className="displayPropertyRow" data-disabled={property.locked || undefined} key={property.key}>
                  <UiCheckbox checked={visible.has(property.key)} disabled={property.locked} onChange={() => setOptional((current) => ({ ...current, [property.key]: !current[property.key as OptionalTaskProperty] }))} />
                  <span>{property.label}</span>
                </label>
              ))}
            </div>
          </UiPopover>
          <UiIconButton aria-label="Refresh tasks" disabled={page.isLoading} onClick={() => void page.refresh()} title="Refresh tasks"><ShellIcon className={page.isLoading ? "refreshIcon isLoading" : "refreshIcon"} name="refresh" /></UiIconButton>
        </div>
      </div>

      {page.error ? <div className="workbenchState" role="alert"><span>{page.error}</span><UiButton onClick={() => void page.refresh()}>Retry</UiButton></div> : null}
      {!page.error && page.isLoading && items.length === 0 ? <div className="workbenchState" role="status">Loading tasks…</div> : null}
      {!page.error && !page.isLoading && items.length === 0 ? <div className="workbenchState" role="status">No matching tasks</div> : null}

      {!page.error && items.length > 0 && layout === "table" ? (
        <div className="taskListViewport">
          <StackedListHelperRow>{items.length} tasks</StackedListHelperRow>
          <StackedList fields={fields}>
            {items.map((task) => <StackedListRow key={task.id} left={<>
              <StackedListField field={fields[0]}><TaskStatusIcon status={task.status} /></StackedListField>
              {visible.has("taskid") ? <StackedListField field={fields[1]}>{task.id}</StackedListField> : null}
            </>} name={task.title} onClick={() => router.push(`/tasks/${encodeURIComponent(task.id)}`)} right={<>
              {task.projectReference ? <StackedListField field={fields[3]}><UiLabel icon="github">{task.projectReference.repositoryExternalId}</UiLabel></StackedListField> : null}
              {visible.has("issue") && task.issue ? <StackedListField field={fields[4]}><UiLabel icon={task.issue.provider}>{task.issue.identifier}</UiLabel></StackedListField> : null}
              <StackedListField field={fields[5]}>{metadataEntries(task).map(([key, value]) => <UiLabel key={key}><span className="taskLabelKey">{key}</span>{value}</UiLabel>)}</StackedListField>
              {visible.has("updated") ? <StackedListField field={fields[6]}><TaskDate value={task.updatedAt} /></StackedListField> : null}
              <StackedListField field={fields[7]}><TaskDate value={task.createdAt} /></StackedListField>
            </>} />)}
          </StackedList>
        </div>
      ) : null}

      {!page.error && items.length > 0 && layout === "kanban" ? (
        <div className="boardViewport"><div className="taskBoard">
          {TASK_STATUS_ORDER.map((status) => <section className="boardColumn" key={status}>
            <header><TaskStatusIcon status={status} /><strong>{TASK_STATUS_LABELS[status]}</strong><span>{items.filter((task) => task.status === status).length}</span></header>
            <div className="boardCards">{items.filter((task) => task.status === status).map((task) => <UiSurface as="article" className="boardCard" key={task.id}>
              <div className="boardCardStatus"><TaskStatusIcon status={task.status} />{visible.has("taskid") ? <span className="boardCardTaskId">{task.id}</span> : null}</div>
              <UiActionAnchor className="boardCardPrimaryLink" href={`/tasks/${encodeURIComponent(task.id)}`} size="compact">{task.title}</UiActionAnchor>
              <div className="boardCardLabels"><TaskPropertyLabels task={task} visible={visible} /></div>
              <div className="boardCardDates">{visible.has("updated") ? <span><small>Updated</small><TaskDate value={task.updatedAt} /></span> : null}<span><small>Created</small><TaskDate value={task.createdAt} /></span></div>
            </UiSurface>)}</div>
          </section>)}
        </div></div>
      ) : null}

      {appendError ? <div className="workbenchState" role="alert">{appendError}</div> : null}
      {nextCursor ? <div className="workbenchPager"><UiButton disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Loading…" : "Load more"}</UiButton></div> : null}
    </section>
  );
}
