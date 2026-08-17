import { NextResponse } from "next/server";
import { effectiveSystemPromptEvidenceSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { createTaskWorkspaceService } from "@/lib/task-workspaces/task-workspace-service-factory";
import { TaskProductionFailure } from "@/lib/tasks/task-production-errors";
import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../../../_auth";
import { noStore, taskProductionErrorResponse } from "../../../_task-production-http";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id: taskId } = await context.params;
    const db = await getDb();
    const subject = await requireHumanSession(db, request, "task-production-read");
    const active = await requireTeamPermission(db, subject, "team.resource.access");
    const task = await db.getTask(taskId, { teamId: active.team.id });
    if (!task) throw new TaskProductionFailure("task_not_found", "Task was not found");
    const [attempt, transitions, workspace, sessions] = await Promise.all([
      db.getExecutionAttemptByTaskId(task.id, { teamId: active.team.id }),
      db.listTaskStatusTransitions({ taskId: task.id, teamId: active.team.id, limit: 100 }),
      createTaskWorkspaceService(db).get({ actor: { teamId: active.team.id }, taskId: task.id }),
      db.listSessions({ teamId: active.team.id, taskId: task.id, limit: 1 }),
    ]);
    const promptEvent = sessions[0]
      ? (await db.listSessionEvents({ sessionId: sessions[0].id, teamId: active.team.id, afterSequence: 0, limit: 10 }))
          .events.find((event) => event.kind === "session.system_prompt_configured")
      : undefined;
    const prompt = promptEvent ? effectiveSystemPromptEvidenceSchema.safeParse(promptEvent.payload) : undefined;
    return noStore(NextResponse.json({
      task,
      attempt: attempt ?? null,
      transitions,
      workspace: workspace ?? null,
      latestSession: sessions[0] ?? null,
      promptEvidence: prompt?.success ? {
        standardPrompt: { version: prompt.data.standardPrompt.version },
        agentContext: prompt.data.agentContext ? {
          agentId: prompt.data.agentContext.agentId,
          name: prompt.data.agentContext.name,
          revision: prompt.data.agentContext.revision,
        } : null,
      } : null,
      agentReport: task.statusActor.kind === "agent" && task.statusNote
        ? { text: task.statusNote, verified: false, label: "Agent reported / not verified by Mystra" }
        : null,
    }));
  } catch (error) {
    try { return noStore(authorizationErrorResponse(error)); } catch { return taskProductionErrorResponse(error); }
  }
}
