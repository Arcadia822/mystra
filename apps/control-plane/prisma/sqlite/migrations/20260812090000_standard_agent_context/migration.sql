PRAGMA foreign_keys=OFF;

CREATE TABLE "new_harnesses" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  CONSTRAINT "harnesses_agent_context_check" CHECK (
    ("agent_id" IS NULL AND "agent_name" IS NULL AND "agent_revision" IS NULL AND "agent_system_prompt" IS NULL)
    OR
    ("agent_id" IS NOT NULL AND "agent_name" IS NOT NULL AND "agent_revision" IS NOT NULL AND "agent_system_prompt" IS NOT NULL)
  ),
  CONSTRAINT "harnesses_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "harnesses_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "harnesses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "harnesses_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "harnesses_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "runtimes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "harnesses_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "task_workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "harnesses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_harnesses" (
  "id", "team_id", "task_id", "project_id", "agent_id", "agent_name", "agent_revision", "agent_system_prompt",
  "task_title", "task_description", "task_issue", "runtime_id", "provider_key", "workspace_id", "planned_session_id",
  "session_id", "first_message_id", "assign_idempotency_key", "assign_request_fingerprint", "capability_revoked_at",
  "setup_failure_code", "setup_failure_message", "created_at", "updated_at"
)
SELECT
  h."id", h."team_id", h."task_id", h."project_id", h."agent_id", a."name", h."agent_revision", h."agent_system_prompt",
  h."task_title", h."task_description", h."task_issue", h."runtime_id", h."provider_key", h."workspace_id", h."planned_session_id",
  h."session_id", h."first_message_id", h."assign_idempotency_key", h."assign_request_fingerprint", h."capability_revoked_at",
  h."setup_failure_code", h."setup_failure_message", h."created_at", h."updated_at"
FROM "harnesses" h
JOIN "agents" a ON a."id" = h."agent_id";

DROP TABLE "harnesses";
ALTER TABLE "new_harnesses" RENAME TO "harnesses";

CREATE UNIQUE INDEX "harnesses_task_id_key" ON "harnesses"("task_id");
CREATE UNIQUE INDEX "harnesses_workspace_id_key" ON "harnesses"("workspace_id");
CREATE UNIQUE INDEX "harnesses_planned_session_id_key" ON "harnesses"("planned_session_id");
CREATE UNIQUE INDEX "harnesses_session_id_key" ON "harnesses"("session_id");
CREATE UNIQUE INDEX "harnesses_task_id_assign_idempotency_key_key" ON "harnesses"("task_id", "assign_idempotency_key");
CREATE INDEX "harnesses_team_id_created_at_idx" ON "harnesses"("team_id", "created_at");
CREATE INDEX "harnesses_agent_id_idx" ON "harnesses"("agent_id");
CREATE INDEX "harnesses_runtime_id_idx" ON "harnesses"("runtime_id");

CREATE TABLE "new_sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "team_id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "project_id" TEXT,
  "runtime_id" TEXT NOT NULL,
  "provider_key" TEXT NOT NULL,
  "agent_id" TEXT,
  "agent_revision" INTEGER,
  "state" TEXT NOT NULL,
  "active_message_id" TEXT,
  "last_message_id" TEXT,
  "interrupt_kind" TEXT,
  "continuation_mode" TEXT,
  "failure_code" TEXT,
  "metadata" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  CONSTRAINT "sessions_agent_context_check" CHECK (
    ("agent_id" IS NULL AND "agent_revision" IS NULL)
    OR ("agent_id" IS NOT NULL AND "agent_revision" IS NOT NULL)
  ),
  CONSTRAINT "sessions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sessions_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "runtimes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sessions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_sessions" SELECT * FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "new_sessions" RENAME TO "sessions";

CREATE INDEX "sessions_team_id_updated_at_id_idx" ON "sessions"("team_id", "updated_at", "id");
CREATE INDEX "sessions_task_id_updated_at_id_idx" ON "sessions"("task_id", "updated_at", "id");
CREATE INDEX "sessions_runtime_id_state_created_at_id_idx" ON "sessions"("runtime_id", "state", "created_at", "id");

PRAGMA foreign_keys=ON;
