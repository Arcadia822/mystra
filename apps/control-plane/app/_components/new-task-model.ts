export const NEW_TASK_DRAFT_VERSION = 1;

export type NewTaskDraft = {
  version: 1;
  title: string;
  description: string;
  projectId: string;
  idempotencyKey: string;
};

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function newTaskDraftStorageKey(userId: string, teamId: string): string {
  return `mystra:new-task-draft:v1:${userId}:${teamId}`;
}

export function createEmptyNewTaskDraft(newId: () => string = () => crypto.randomUUID()): NewTaskDraft {
  return { version: NEW_TASK_DRAFT_VERSION, title: "", description: "", projectId: "", idempotencyKey: newId() };
}

export function loadNewTaskDraft(
  storage: DraftStorage,
  userId: string,
  teamId: string,
  availableProjectIds: ReadonlySet<string>,
  newId: () => string = () => crypto.randomUUID(),
): NewTaskDraft {
  try {
    const parsed = JSON.parse(storage.getItem(newTaskDraftStorageKey(userId, teamId)) ?? "null") as Partial<NewTaskDraft> | null;
    if (
      parsed?.version !== NEW_TASK_DRAFT_VERSION
      || typeof parsed.title !== "string"
      || typeof parsed.description !== "string"
      || typeof parsed.projectId !== "string"
      || typeof parsed.idempotencyKey !== "string"
    ) return createEmptyNewTaskDraft(newId);
    return {
      version: NEW_TASK_DRAFT_VERSION,
      title: parsed.title,
      description: parsed.description,
      projectId: availableProjectIds.has(parsed.projectId) ? parsed.projectId : "",
      idempotencyKey: parsed.idempotencyKey,
    };
  } catch {
    return createEmptyNewTaskDraft(newId);
  }
}

export function saveNewTaskDraft(storage: DraftStorage, userId: string, teamId: string, draft: NewTaskDraft): void {
  storage.setItem(newTaskDraftStorageKey(userId, teamId), JSON.stringify(draft));
}

export function clearNewTaskDraft(storage: DraftStorage, userId: string, teamId: string): void {
  storage.removeItem(newTaskDraftStorageKey(userId, teamId));
}
