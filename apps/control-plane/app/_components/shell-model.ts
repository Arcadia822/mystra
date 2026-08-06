import type { TaskListItem } from "../_lib/types";

export function filterTasks(tasks: TaskListItem[], query: string): TaskListItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return tasks;

  return tasks.filter((task) => [
    task.id,
    task.objective,
    task.issue?.reference.identifier,
    task.issue?.title,
    task.repository.fullName,
    task.latestSession?.branch,
  ].some((value) => value?.toLowerCase().includes(normalized)));
}

export function inboxTasks(tasks: TaskListItem[]): TaskListItem[] {
  return tasks.filter((task) => task.latestSession?.state === "waiting_for_review");
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
    const projectTasks = groups.get(task.projectId) ?? [];
    projectTasks.push(task);
    groups.set(task.projectId, projectTasks);
  }

  return [...groups.entries()].map(([projectId, projectTasks]) => ({
    projectId,
    tasks: projectTasks.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  }));
}
