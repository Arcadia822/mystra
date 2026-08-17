ALTER TABLE "tasks" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "tasks" ADD COLUMN "metadata" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "tasks" ADD COLUMN "status_revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "tasks" ADD COLUMN "status_note" TEXT;
ALTER TABLE "tasks" ADD COLUMN "status_updated_at" TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
ALTER TABLE "tasks" ADD COLUMN "status_actor" TEXT NOT NULL DEFAULT '{"kind":"system","actorId":null,"agentId":null,"executionContextId":null,"sessionId":null}';

CREATE TABLE "task_execution_contexts" (
  "id" TEXT NOT NULL,
  "team_id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "agent_id" TEXT,
  "agent_name" TEXT,
  "agent_revision" INTEGER,
  "agent_system_prompt" TEXT,
  "task_title" TEXT NOT NULL,
  "task_description" TEXT,
  "task_issue" TEXT,
  "manual_context_text" TEXT,
  "runtime_id" TEXT NOT NULL,
  "provider_key" TEXT NOT NULL,
  "workspace_id" TEXT,
  "planned_session_id" TEXT NOT NULL,
  "session_id" TEXT,
  "first_message_id" TEXT NOT NULL,
  "assign_idempotency_key" TEXT NOT NULL,
  "assign_request_fingerprint" TEXT NOT NULL,
  "capability_revoked_at" TEXT,
  "setup_failure_code" TEXT,
  "setup_failure_message" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  CONSTRAINT "task_execution_contexts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_execution_contexts_agent_context_check" CHECK (
    ("agent_id" IS NULL AND "agent_name" IS NULL AND "agent_revision" IS NULL AND "agent_system_prompt" IS NULL)
    OR
    ("agent_id" IS NOT NULL AND "agent_name" IS NOT NULL AND "agent_revision" IS NOT NULL AND "agent_system_prompt" IS NOT NULL)
  )
);

CREATE TABLE "task_status_transitions" (
  "id" TEXT NOT NULL,
  "team_id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "from_status" TEXT NOT NULL,
  "to_status" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "actor" TEXT NOT NULL,
  "note" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "request_fingerprint" TEXT NOT NULL,
  "occurred_at" TEXT NOT NULL,
  CONSTRAINT "task_status_transitions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "session_dispatch_leases" ADD COLUMN "execution_code_hash" TEXT;
ALTER TABLE "session_dispatch_leases" ADD COLUMN "execution_code_expires_at" TEXT;

CREATE UNIQUE INDEX "task_execution_contexts_task_id_key" ON "task_execution_contexts"("task_id");
CREATE UNIQUE INDEX "task_execution_contexts_workspace_id_key" ON "task_execution_contexts"("workspace_id");
CREATE UNIQUE INDEX "task_execution_contexts_planned_session_id_key" ON "task_execution_contexts"("planned_session_id");
CREATE UNIQUE INDEX "task_execution_contexts_session_id_key" ON "task_execution_contexts"("session_id");
CREATE UNIQUE INDEX "task_execution_contexts_task_id_assign_idempotency_key_key" ON "task_execution_contexts"("task_id", "assign_idempotency_key");
CREATE INDEX "task_execution_contexts_team_id_created_at_idx" ON "task_execution_contexts"("team_id", "created_at");
CREATE INDEX "task_execution_contexts_agent_id_idx" ON "task_execution_contexts"("agent_id");
CREATE INDEX "task_execution_contexts_runtime_id_idx" ON "task_execution_contexts"("runtime_id");
CREATE UNIQUE INDEX "task_status_transitions_task_id_revision_key" ON "task_status_transitions"("task_id", "revision");
CREATE UNIQUE INDEX "task_status_transitions_task_id_idempotency_key_key" ON "task_status_transitions"("task_id", "idempotency_key");
CREATE INDEX "task_status_transitions_team_id_occurred_at_idx" ON "task_status_transitions"("team_id", "occurred_at");
CREATE INDEX "task_status_transitions_task_id_occurred_at_idx" ON "task_status_transitions"("task_id", "occurred_at");
CREATE UNIQUE INDEX "session_dispatch_leases_execution_code_hash_key" ON "session_dispatch_leases"("execution_code_hash");
CREATE INDEX "tasks_team_id_updated_at_id_idx" ON "tasks"("team_id", "updated_at", "id");
CREATE INDEX "tasks_team_id_status_updated_at_id_idx" ON "tasks"("team_id", "status", "updated_at", "id");
CREATE INDEX "tasks_team_id_title_id_idx" ON "tasks"("team_id", "title", "id");

ALTER TABLE "task_execution_contexts" ADD CONSTRAINT "task_execution_contexts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_execution_contexts" ADD CONSTRAINT "task_execution_contexts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_execution_contexts" ADD CONSTRAINT "task_execution_contexts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_execution_contexts" ADD CONSTRAINT "task_execution_contexts_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_execution_contexts" ADD CONSTRAINT "task_execution_contexts_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_execution_contexts" ADD CONSTRAINT "task_execution_contexts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "task_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_execution_contexts" ADD CONSTRAINT "task_execution_contexts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_status_transitions" ADD CONSTRAINT "task_status_transitions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_status_transitions" ADD CONSTRAINT "task_status_transitions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
