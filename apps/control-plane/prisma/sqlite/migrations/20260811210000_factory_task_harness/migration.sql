ALTER TABLE "tasks" ADD COLUMN "production_status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "tasks" ADD COLUMN "status_revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "tasks" ADD COLUMN "status_note" TEXT;
ALTER TABLE "tasks" ADD COLUMN "status_updated_at" TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
ALTER TABLE "tasks" ADD COLUMN "status_actor" TEXT NOT NULL DEFAULT '{"kind":"system","actorId":null,"agentId":null,"harnessId":null,"sessionId":null}';

CREATE TABLE "harnesses" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "team_id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "agent_revision" INTEGER NOT NULL,
  "agent_system_prompt" TEXT NOT NULL,
  "task_title" TEXT NOT NULL,
  "task_description" TEXT,
  "task_issue" TEXT,
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
  CONSTRAINT "harnesses_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "harnesses_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "harnesses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "harnesses_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "harnesses_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "runtimes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "harnesses_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "task_workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "harnesses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "task_status_transitions" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  CONSTRAINT "task_status_transitions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "task_status_transitions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "session_dispatch_leases" ADD COLUMN "execution_code_hash" TEXT;
ALTER TABLE "session_dispatch_leases" ADD COLUMN "execution_code_expires_at" TEXT;

CREATE UNIQUE INDEX "harnesses_task_id_key" ON "harnesses"("task_id");
CREATE UNIQUE INDEX "harnesses_workspace_id_key" ON "harnesses"("workspace_id");
CREATE UNIQUE INDEX "harnesses_planned_session_id_key" ON "harnesses"("planned_session_id");
CREATE UNIQUE INDEX "harnesses_session_id_key" ON "harnesses"("session_id");
CREATE UNIQUE INDEX "harnesses_task_id_assign_idempotency_key_key" ON "harnesses"("task_id", "assign_idempotency_key");
CREATE INDEX "harnesses_team_id_created_at_idx" ON "harnesses"("team_id", "created_at");
CREATE INDEX "harnesses_agent_id_idx" ON "harnesses"("agent_id");
CREATE INDEX "harnesses_runtime_id_idx" ON "harnesses"("runtime_id");
CREATE UNIQUE INDEX "task_status_transitions_task_id_revision_key" ON "task_status_transitions"("task_id", "revision");
CREATE UNIQUE INDEX "task_status_transitions_task_id_idempotency_key_key" ON "task_status_transitions"("task_id", "idempotency_key");
CREATE INDEX "task_status_transitions_team_id_occurred_at_idx" ON "task_status_transitions"("team_id", "occurred_at");
CREATE INDEX "task_status_transitions_task_id_occurred_at_idx" ON "task_status_transitions"("task_id", "occurred_at");
CREATE UNIQUE INDEX "session_dispatch_leases_execution_code_hash_key" ON "session_dispatch_leases"("execution_code_hash");
