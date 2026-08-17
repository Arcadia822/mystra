PRAGMA foreign_keys=OFF;

DROP TABLE "tasks";

CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "team_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "project_id" TEXT,
    "runtime_id" TEXT,
    "idempotency_key" TEXT,
    "issue_provider" TEXT,
    "issue_connection_id" TEXT,
    "issue_scope_external_id" TEXT,
    "issue_external_id" TEXT,
    "issue_identifier" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "tasks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "runtimes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_issue_connection_id_fkey" FOREIGN KEY ("issue_connection_id") REFERENCES "integration_connections" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_title_length_check" CHECK (length(trim("title")) BETWEEN 1 AND 500),
    CONSTRAINT "tasks_description_length_check" CHECK ("description" IS NULL OR length("description") <= 100000),
    CONSTRAINT "tasks_issue_all_or_none_check" CHECK (
      ("issue_provider" IS NULL AND "issue_connection_id" IS NULL AND "issue_scope_external_id" IS NULL AND "issue_external_id" IS NULL AND "issue_identifier" IS NULL)
      OR
      ("project_id" IS NOT NULL AND "issue_provider" IN ('github', 'linear') AND "issue_connection_id" IS NOT NULL AND "issue_scope_external_id" IS NOT NULL AND "issue_external_id" IS NOT NULL AND "issue_identifier" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "tasks_team_id_idempotency_key_key" ON "tasks"("team_id", "idempotency_key");
CREATE UNIQUE INDEX "tasks_issue_fingerprint_key" ON "tasks"("issue_provider", "issue_connection_id", "issue_scope_external_id", "issue_external_id");
CREATE INDEX "tasks_team_id_idx" ON "tasks"("team_id");
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");
CREATE INDEX "tasks_runtime_id_idx" ON "tasks"("runtime_id");
CREATE INDEX "tasks_issue_connection_id_idx" ON "tasks"("issue_connection_id");
CREATE INDEX "tasks_created_at_id_idx" ON "tasks"("created_at", "id");

PRAGMA foreign_keys=ON;
