import type { TaskListItem } from "@mystra/shared";

function metadataString(task: TaskListItem, key: string): string | undefined {
  const value = task.metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function taskTitle(task: TaskListItem): string {
  return metadataString(task, "title")
    ?? task.issueDispatchKey
    ?? `Task ${task.id.slice(0, 8)}`;
}
