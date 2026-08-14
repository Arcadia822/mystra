export type OptionalTaskProperty = "taskid" | "issue" | "updated";
export type TaskProperty = "status" | OptionalTaskProperty | "name" | "project" | "metadata" | "created";

export type OptionalTaskPropertyState = Record<OptionalTaskProperty, boolean>;

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
