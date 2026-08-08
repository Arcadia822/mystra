import type { TaskListItem } from "@mystra/shared";

export function taskTitle(task: TaskListItem): string {
  return task.title;
}

export function taskIssueLabel(task: TaskListItem): string {
  return task.issue?.identifier ?? "none";
}
