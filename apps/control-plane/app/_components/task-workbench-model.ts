import type { TaskStatus } from "@mystra/shared";

export type TaskWorkbenchLayout = "table" | "kanban";
export type OptionalTaskProperty = "taskid" | "issue" | "updated";
export type TaskProperty = "status" | OptionalTaskProperty | "name" | "project" | "metadata" | "created";
export type OptionalTaskPropertyState = Record<OptionalTaskProperty, boolean>;

export const TASK_STATUS_ORDER: readonly TaskStatus[] = ["pending", "in_progress", "blocked", "done", "canceled"];

export const TASK_PROPERTY_ROWS: ReadonlyArray<{ key: TaskProperty; label: string; locked?: boolean }> = [
  { key: "status", label: "Status", locked: true },
  { key: "taskid", label: "Task ID" },
  { key: "name", label: "Name", locked: true },
  { key: "project", label: "Project", locked: true },
  { key: "issue", label: "Issue" },
  { key: "metadata", label: "Metadata", locked: true },
  { key: "updated", label: "Updated At" },
  { key: "created", label: "Created At", locked: true },
];

export function getVisibleTaskProperties(optional: OptionalTaskPropertyState): TaskProperty[] {
  return TASK_PROPERTY_ROWS
    .filter((property) => property.locked || optional[property.key as OptionalTaskProperty])
    .map((property) => property.key);
}

export function taskPageUrl(input: {
  query: string;
  statuses: readonly TaskStatus[];
  sort: "updatedAt" | "createdAt" | "title" | "status";
  direction: "asc" | "desc";
  cursor?: string;
}): string {
  const search = new URLSearchParams({ limit: "50", sort: input.sort, direction: input.direction });
  if (input.query.trim()) search.set("query", input.query.trim());
  for (const status of input.statuses) search.append("status", status);
  if (input.cursor) search.set("cursor", input.cursor);
  return `/api/tasks?${search}`;
}
