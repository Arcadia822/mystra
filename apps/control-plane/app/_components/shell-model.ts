import type { TaskListItem } from "../_lib/types";
import { taskTitle } from "../_lib/task-view";

export function filterTasks(tasks: TaskListItem[], query: string): TaskListItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return tasks;

  return tasks.filter((task) => [
    task.id,
    task.projectId,
    task.description,
    task.issue?.identifier,
    task.issue?.externalId,
    taskTitle(task),
  ].some((value) => value?.toLowerCase().includes(normalized)));
}

export function inboxTasks(tasks: TaskListItem[]): TaskListItem[] {
  void tasks;
  return [];
}

export function selectedSearchTask(
  tasks: TaskListItem[],
  selectedId?: string,
): TaskListItem | undefined {
  if (!selectedId) return undefined;
  return tasks.find((task) => task.id === selectedId);
}

export function groupTasksByProject(tasks: TaskListItem[]) {
  const groups = new Map<string, TaskListItem[]>();

  for (const task of tasks) {
    const projectTasks = groups.get(task.projectId ?? "") ?? [];
    projectTasks.push(task);
    groups.set(task.projectId ?? "", projectTasks);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left === "" ? 1 : right === "" ? -1 : left.localeCompare(right))
    .map(([projectId, projectTasks]) => ({
      projectId: projectId || null,
      tasks: projectTasks.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    }));
}
