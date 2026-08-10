CREATE TABLE "task_workspaces" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "runtime_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "sharing_mode" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "repository_external_id" TEXT NOT NULL,
    "configured_base_branch" TEXT NOT NULL,
    "issue_provider" TEXT,
    "issue_connection_id" TEXT,
    "issue_scope_external_id" TEXT,
    "issue_external_id" TEXT,
    "base_ref" TEXT NOT NULL,
    "base_commit" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "branch_strategy" TEXT NOT NULL,
    "workspace_ref" TEXT,
    "active_attempt_sequence" INTEGER NOT NULL,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    "ready_at" TEXT,
    CONSTRAINT "task_workspaces_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "task_workspaces_state_check" CHECK ("state" IN ('queued', 'preparing', 'ready', 'failed', 'unavailable')),
    CONSTRAINT "task_workspaces_sharing_mode_check" CHECK ("sharing_mode" = 'shared-mutable'),
    CONSTRAINT "task_workspaces_ready_ref_check" CHECK (
      ("state" = 'ready' AND "workspace_ref" IS NOT NULL AND "ready_at" IS NOT NULL)
      OR
      ("state" <> 'ready' AND "workspace_ref" IS NULL AND "ready_at" IS NULL)
    ),
    CONSTRAINT "task_workspaces_issue_all_or_none_check" CHECK (
      ("issue_provider" IS NULL AND "issue_connection_id" IS NULL AND "issue_scope_external_id" IS NULL AND "issue_external_id" IS NULL)
      OR
      ("issue_provider" IN ('github', 'linear') AND "issue_connection_id" IS NOT NULL AND "issue_scope_external_id" IS NOT NULL AND "issue_external_id" IS NOT NULL)
    ),
    CONSTRAINT "task_workspaces_failure_check" CHECK (
      ("state" IN ('failed', 'unavailable') AND "failure_code" IS NOT NULL)
      OR
      ("state" NOT IN ('failed', 'unavailable') AND "failure_code" IS NULL AND "failure_message" IS NULL)
    ),
    CONSTRAINT "task_workspaces_attempt_sequence_check" CHECK ("active_attempt_sequence" > 0)
);

CREATE UNIQUE INDEX "task_workspaces_task_id_key" ON "task_workspaces"("task_id");
CREATE INDEX "task_workspaces_team_id_state_created_at_idx" ON "task_workspaces"("team_id", "state", "created_at");
CREATE INDEX "task_workspaces_runtime_id_state_created_at_idx" ON "task_workspaces"("runtime_id", "state", "created_at");
CREATE INDEX "task_workspaces_connection_id_idx" ON "task_workspaces"("connection_id");
CREATE INDEX "task_workspaces_issue_connection_id_idx" ON "task_workspaces"("issue_connection_id");

CREATE TABLE "workspace_preparation_attempts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "runner_id" TEXT,
    "lease_expires_at" TEXT,
    "claimed_at" TEXT,
    "completed_at" TEXT,
    "failure_code" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "workspace_preparation_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "workspace_preparation_attempts_sequence_check" CHECK ("sequence" > 0),
    CONSTRAINT "workspace_preparation_attempts_state_check" CHECK ("state" IN ('queued', 'claimed', 'succeeded', 'failed', 'expired'))
);

CREATE UNIQUE INDEX "workspace_preparation_attempts_workspace_id_sequence_key" ON "workspace_preparation_attempts"("workspace_id", "sequence");
CREATE INDEX "workspace_preparation_attempts_state_created_at_idx" ON "workspace_preparation_attempts"("state", "created_at");
CREATE INDEX "workspace_preparation_attempts_workspace_id_state_idx" ON "workspace_preparation_attempts"("workspace_id", "state");

ALTER TABLE "task_workspaces" ADD CONSTRAINT "task_workspaces_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_workspaces" ADD CONSTRAINT "task_workspaces_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_workspaces" ADD CONSTRAINT "task_workspaces_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_workspaces" ADD CONSTRAINT "task_workspaces_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_workspaces" ADD CONSTRAINT "task_workspaces_issue_connection_id_fkey" FOREIGN KEY ("issue_connection_id") REFERENCES "integration_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_workspaces" ADD CONSTRAINT "task_workspaces_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workspace_preparation_attempts" ADD CONSTRAINT "workspace_preparation_attempts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "task_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
