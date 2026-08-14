import { TaskDetailPrototype } from "../../../_components/task-detail-prototype";

export default async function TaskDetailPrototypePage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <TaskDetailPrototype taskId={taskId} />;
}
