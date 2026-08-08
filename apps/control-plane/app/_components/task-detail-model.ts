import type { Task } from "@mystra/shared";

export type TaskDetailEditorState = {
  baselineTitle: string;
  baselineDescription: string;
  title: string;
  description: string;
  status: "idle" | "saving" | "error";
  error: string | null;
};

export function createTaskDetailEditor(task: Task): TaskDetailEditorState {
  return {
    baselineTitle: task.title,
    baselineDescription: task.description ?? "",
    title: task.title,
    description: task.description ?? "",
    status: "idle",
    error: null,
  };
}

export function taskDetailEditorDirty(state: TaskDetailEditorState): boolean {
  return state.title !== state.baselineTitle || state.description !== state.baselineDescription;
}

export function validateTaskDetailEditor(state: TaskDetailEditorState): string | null {
  if (!state.title.trim()) return "title-required";
  if (state.title.trim().length > 500) return "title-too-long";
  if (state.description.length > 100_000) return "description-too-long";
  return null;
}

export function taskDetailEditorSaved(task: Task): TaskDetailEditorState {
  return createTaskDetailEditor(task);
}
