PRAGMA foreign_keys=OFF;

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
