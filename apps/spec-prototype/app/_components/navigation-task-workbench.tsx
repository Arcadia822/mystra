"use client";

import {
  ShellIcon,
  StackedList,
  StackedListField,
  StackedListRow,
  TASK_STATUS_LABELS,
  TaskStatusIcon,
  UiActionAnchor,
  UiButton,
  UiCheckbox,
  UiDialogCloseButton,
  UiDialogSurface,
  UiDialogTitleInput,
  UiDropdown,
  UiIconButton,
  UiInput,
  UiLabel,
  UiLabelOverflow,
  UiPopover,
  UiSegmented,
  UiSurface,
  UiSurfaceBody,
  UiSurfaceFooter,
  UiSurfaceHeader,
  UiTextarea,
  type StackedListStandardFieldDefinition as StackedField,
  type UiLabelOverflowItem,
  type TaskStatus,
} from "@mystra/ui";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PrototypeDialog, PrototypeShell } from "./prototype-shell";
import {
  getVisibleTaskProperties,
  TASK_PROPERTY_ROWS,
  type OptionalTaskProperty,
  type TaskProperty,
} from "./task-workbench-model";

type Layout = "table" | "kanban";

interface PrototypeTask {
  id: string;
  title: string;
  project?: string;
  projectProvider?: "github";
  issue?: string;
  issueProvider?: "github" | "linear";
  labels: Array<{ key?: string; value: string }>;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

const tasks: PrototypeTask[] = [
  { id: "MYS-118", title: "Navigation task workbench", project: "Mystra", projectProvider: "github", issue: "MYS-118", issueProvider: "linear", labels: [{ value: "frontend" }, { key: "priority", value: "high" }], status: "in_progress", createdAt: "2026-08-13T08:10:00Z", updatedAt: "2026-08-13T09:12:00Z" },
  { id: "MYS-114", title: "Overview review and product metric handoff", project: "Mystra", projectProvider: "github", issue: "#214", issueProvider: "github", labels: [{ value: "design" }], status: "blocked", createdAt: "2026-08-12T10:00:00Z", updatedAt: "2026-08-13T06:20:00Z" },
  { id: "CAS-62", title: "Repair provider health diagnostics", project: "Castrel AI", projectProvider: "github", labels: [{ value: "backend" }, { key: "owner", value: "platform" }], status: "blocked", createdAt: "2026-08-10T11:00:00Z", updatedAt: "2026-08-12T18:00:00Z" },
  { id: "MYS-109", title: "Draft release notes", labels: [{ value: "docs" }], status: "pending", createdAt: "2026-08-09T05:00:00Z", updatedAt: "2026-08-09T05:00:00Z" },
  { id: "MYS-101", title: "Unify task status icon family across every list surface", project: "Mystra", projectProvider: "github", issue: "MYS-101", issueProvider: "linear", labels: [{ value: "ui" }], status: "done", createdAt: "2026-08-06T02:00:00Z", updatedAt: "2026-08-08T08:00:00Z" },
  { id: "CAS-55", title: "Remove obsolete integration cache spike", project: "Castrel AI", projectProvider: "github", issue: "#188", issueProvider: "github", labels: [{ value: "cleanup" }], status: "canceled", createdAt: "2026-08-04T07:30:00Z", updatedAt: "2026-08-05T13:00:00Z" },
];

const stackedFields: readonly StackedField[] = [
  { key: "status", align: "left", renderType: "icon" },
  { key: "taskid", align: "left", equalWidth: true, renderType: "text" },
  { key: "name", align: "left", renderType: "text" },
  { key: "project", align: "right", renderType: "labels" },
  { key: "issue", align: "right", renderType: "labels" },
  { key: "metadata", align: "right", renderType: "labels" },
  { key: "updated", align: "right", equalWidth: true, renderType: "datetime" },
  { key: "created", align: "right", equalWidth: true, renderType: "datetime" },
];

const statusOrder: TaskStatus[] = ["pending", "in_progress", "blocked", "done", "canceled"];
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function TaskDate({ value }: { value: string }) {
  return <time dateTime={value}>{dateFormatter.format(new Date(value))}</time>;
}

function TaskLabels({ task, visibleProperties }: { task: PrototypeTask; visibleProperties: ReadonlySet<TaskProperty> }) {
  const items: UiLabelOverflowItem[] = [];
  if (visibleProperties.has("project") && task.project) {
    items.push({ content: task.project, icon: task.projectProvider ?? "github", id: `project:${task.project}` });
  }
  if (visibleProperties.has("issue") && task.issue) {
    items.push({ content: task.issue, icon: task.issueProvider ?? "issue", id: `issue:${task.issue}` });
  }
  if (visibleProperties.has("metadata")) {
    items.push(...task.labels.map((label) => ({
      content: <>{label.key ? <span className="taskLabelKey">{label.key}</span> : null}{label.value}</>,
      id: `label:${label.key ?? ""}:${label.value}`,
    })));
  }
  return <UiLabelOverflow aria-label={`Labels for ${task.title}`} items={items} />;
}

export function TaskComposer({ onClose }: { onClose: () => void }) {
  const [project, setProject] = useState("");
  const [title, setTitle] = useState("");
  return (
    <PrototypeDialog onClose={onClose} title="Create task">
      <UiDialogSurface className="taskComposer" layout="rows">
        <UiSurfaceHeader className="taskComposerHeader">
          <UiDialogTitleInput aria-label="Task name" onChange={(event) => setTitle(event.currentTarget.value)} placeholder="Task name" value={title} />
          <UiDialogCloseButton aria-label="Close" onClick={onClose} />
        </UiSurfaceHeader>
        <UiSurfaceBody><UiTextarea aria-label="Task description" className="taskDescription" placeholder="Add a description…" rows={3} /></UiSurfaceBody>
        <UiSurfaceFooter className="taskComposerFooter">
          <UiDropdown aria-label="Project" icon={<ShellIcon name="project" />} onValueChange={setProject} options={[{ value: "", label: "No project" }, { value: "mystra", label: "Mystra" }, { value: "castrel", label: "Castrel AI" }]} placeholder="No project" size="inline" value={project} variant="ghost" />
          <UiButton disabled={!title.trim()} onClick={onClose} size="inline" tone="solid">Create</UiButton>
        </UiSurfaceFooter>
      </UiDialogSurface>
    </PrototypeDialog>
  );
}

export function SearchDialog({ onClose }: { onClose: () => void }) {
  return (
    <PrototypeDialog onClose={onClose} title="Search">
      <UiDialogSurface className="searchPrototype">
        <UiSurfaceHeader><ShellIcon name="search" /><UiInput autoFocus aria-label="Search tasks" className="searchPrototypeInput" placeholder="Search tasks…" /><UiDialogCloseButton aria-label="Close" onClick={onClose} /></UiSurfaceHeader>
        <UiSurfaceBody>
          {tasks.slice(0, 4).map((task) => <button className="searchPrototypeResult" key={task.id} onClick={onClose}><TaskStatusIcon status={task.status} /><span><strong>{task.title}</strong><small>{task.id}</small></span></button>)}
        </UiSurfaceBody>
      </UiDialogSurface>
    </PrototypeDialog>
  );
}

export function NavigationTaskWorkbench() {
  const router = useRouter();
  const [layout, setLayout] = useState<Layout>("table");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [optional, setOptional] = useState<Record<OptionalTaskProperty, boolean>>({ taskid: false, issue: true, updated: false });
  const visibleTasks = useMemo(() => tasks.filter((task) => task.title.toLowerCase().includes(query.toLowerCase())), [query]);
  const visibleProperties = useMemo(() => new Set(getVisibleTaskProperties(optional)), [optional]);

  function refresh() {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 900);
  }

  function openTask(taskId: string) {
    router.push(`/054-navigation-task-workbench/tasks/${encodeURIComponent(taskId)}`);
  }

  return (
    <PrototypeShell onNewTask={() => { setSearchOpen(false); setNewTaskOpen(true); }} onSearch={() => { setNewTaskOpen(false); setSearchOpen(true); }} title="Tasks">
      <section className="taskWorkbench">
        <div aria-label="Task list controls" className="taskToolbar">
          <label className="taskSearch"><ShellIcon name="search" /><input aria-label="Search tasks" onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search tasks…" type="search" value={query} /></label>
          <div className="taskToolbarActions">
            <UiIconButton aria-label="Filter tasks" title="Filter tasks"><ShellIcon name="filter" /></UiIconButton>
            <UiPopover aria-label="Display options" className="taskDisplayPopover" icon="display" popupClassName="taskDisplayPopup">
              <div className="displayMenuSection">
                <div className="displayMenuLabel"><ShellIcon name="display" />Layout</div>
                <UiSegmented
                  aria-label="Task layout"
                  onValueChange={setLayout}
                  options={[
                    { value: "table", label: "Table", icon: <ShellIcon name="list" /> },
                    { value: "kanban", label: "Kanban", icon: <ShellIcon name="kanban" /> },
                  ]}
                  value={layout}
                />
              </div>
              <div className="displayMenuSection">
                <div className="displayMenuLabel"><ShellIcon name="review" />Properties</div>
                {TASK_PROPERTY_ROWS.map((property) => {
                  const active = visibleProperties.has(property.key);
                  return (
                    <label className="displayPropertyRow" data-disabled={property.locked || undefined} key={property.key}>
                      <UiCheckbox
                        checked={active}
                        disabled={property.locked}
                        onChange={() => setOptional((current) => ({
                          ...current,
                          [property.key]: !current[property.key as OptionalTaskProperty],
                        }))}
                      />
                      <span>{property.label}</span>
                    </label>
                  );
                })}
              </div>
            </UiPopover>
            <UiIconButton aria-label="Refresh tasks" disabled={refreshing} onClick={refresh} title="Refresh tasks"><ShellIcon className={refreshing ? "refreshIcon isLoading" : "refreshIcon"} name="refresh" /></UiIconButton>
          </div>
        </div>

        {layout === "table" ? (
          <div className="taskListViewport">
            <StackedList fields={stackedFields}>
              {visibleTasks.map((task) => (
                <StackedListRow
                  key={task.id}
                  left={<>
                    <StackedListField field={stackedFields[0]!}><TaskStatusIcon status={task.status} /></StackedListField>
                    {visibleProperties.has("taskid") ? <StackedListField field={stackedFields[1]!}>{task.id}</StackedListField> : null}
                  </>}
                  name={task.title}
                  onClick={() => openTask(task.id)}
                  right={<>
                    {task.project ? <StackedListField field={stackedFields[3]!}><UiLabel icon="github">{task.project}</UiLabel></StackedListField> : null}
                    {visibleProperties.has("issue") && task.issue ? <StackedListField field={stackedFields[4]!}><UiLabel icon={task.issueProvider ?? "issue"}>{task.issue}</UiLabel></StackedListField> : null}
                    <StackedListField field={stackedFields[5]!}>{task.labels.map((label) => <UiLabel key={`${label.key ?? ""}:${label.value}`}>{label.key ? <span className="taskLabelKey">{label.key}</span> : null}{label.value}</UiLabel>)}</StackedListField>
                    {visibleProperties.has("updated") ? <StackedListField field={stackedFields[6]!}><TaskDate value={task.updatedAt} /></StackedListField> : null}
                    <StackedListField field={stackedFields[7]!}><TaskDate value={task.createdAt} /></StackedListField>
                  </>}
                />
              ))}
            </StackedList>
          </div>
        ) : (
          <div className="boardViewport">
            <div className="taskBoard">
              {statusOrder.map((status) => (
                <section className="boardColumn" key={status}>
                  <header><TaskStatusIcon status={status} /><strong>{TASK_STATUS_LABELS[status]}</strong><span>{visibleTasks.filter((task) => task.status === status).length}</span></header>
                  <div className="boardCards">
                    {visibleTasks.filter((task) => task.status === status).map((task) => (
                      <UiSurface as="article" className="boardCard" key={task.id}>
                        <div className="boardCardStatus">
                          <TaskStatusIcon status={task.status} />
                          {visibleProperties.has("taskid") ? <span className="boardCardTaskId">{task.id}</span> : null}
                        </div>
                        <UiActionAnchor className="boardCardPrimaryLink" href={`/054-navigation-task-workbench/tasks/${encodeURIComponent(task.id)}`} size="compact">{task.title}</UiActionAnchor>
                        <div className="boardCardLabels"><TaskLabels task={task} visibleProperties={visibleProperties} /></div>
                        <div className="boardCardDates">
                          {visibleProperties.has("updated") ? <span><small>Updated</small><TaskDate value={task.updatedAt} /></span> : null}
                          <span><small>Created</small><TaskDate value={task.createdAt} /></span>
                        </div>
                      </UiSurface>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </section>
      {newTaskOpen ? <TaskComposer onClose={() => setNewTaskOpen(false)} /> : null}
      {searchOpen ? <SearchDialog onClose={() => setSearchOpen(false)} /> : null}
    </PrototypeShell>
  );
}
