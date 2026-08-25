CREATE TABLE "task_workflow_states" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "team_id" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "task_id" TEXT NOT NULL REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "workflow_id" TEXT NOT NULL,
  "stage_id" TEXT NOT NULL,
  "state_version" INTEGER NOT NULL,
  "active_key" TEXT,
  "enabled_by_user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "enable_command_id" TEXT NOT NULL,
  "enabled_at" TEXT NOT NULL,
  "disabled_by_user_id" TEXT REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "disable_command_id" TEXT,
  "disabled_at" TEXT,
  "updated_at" TEXT NOT NULL,
  CHECK ("workflow_id" = 'mystra.workflow' AND ("active_key" IS NULL OR "active_key" = 'mystra.workflow') AND "stage_id" IN ('understand', 'implement', 'verify', 'completed') AND "state_version" > 0),
  CHECK (("active_key" IS NOT NULL AND "disabled_by_user_id" IS NULL AND "disable_command_id" IS NULL AND "disabled_at" IS NULL) OR ("active_key" IS NULL AND "disabled_by_user_id" IS NOT NULL AND "disable_command_id" IS NOT NULL AND "disabled_at" IS NOT NULL))
);

CREATE TABLE "task_workflow_transitions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workflow_state_id" TEXT NOT NULL REFERENCES "task_workflow_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "team_id" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "task_id" TEXT NOT NULL REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "session_id" TEXT NOT NULL REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "command_id" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "action_id" TEXT NOT NULL,
  "from_stage_id" TEXT NOT NULL,
  "to_stage_id" TEXT NOT NULL,
  "from_state_version" INTEGER NOT NULL,
  "to_state_version" INTEGER NOT NULL,
  "occurred_at" TEXT NOT NULL,
  CHECK ("to_state_version" = "from_state_version" + 1)
);

CREATE TABLE "session_workflow_capabilities" (
  "session_id" TEXT NOT NULL PRIMARY KEY REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "workflow_state_id" TEXT NOT NULL REFERENCES "task_workflow_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "team_id" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "task_id" TEXT NOT NULL REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "issued_at" TEXT NOT NULL,
  "revoked_at" TEXT
);

CREATE TABLE "workspace_skill_sources" (
  "workspace_id" TEXT NOT NULL REFERENCES "task_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "source_key" TEXT NOT NULL,
  "skill_id" TEXT NOT NULL REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "skill_revision_id" TEXT NOT NULL REFERENCES "skill_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "relative_path" TEXT NOT NULL,
  "desired_generation" INTEGER NOT NULL CHECK ("desired_generation" > 0),
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  PRIMARY KEY ("workspace_id", "source_key", "skill_id")
);

CREATE TABLE "workspace_skill_projections" (
  "workspace_id" TEXT NOT NULL REFERENCES "task_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "skill_id" TEXT NOT NULL REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "skill_revision_id" TEXT NOT NULL REFERENCES "skill_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "relative_path" TEXT NOT NULL,
  "desired_generation" INTEGER NOT NULL,
  "applied_generation" INTEGER,
  "status" TEXT NOT NULL,
  "failure_code" TEXT,
  "updated_at" TEXT NOT NULL,
  PRIMARY KEY ("workspace_id", "skill_id"),
  CHECK ("desired_generation" > 0 AND ("applied_generation" IS NULL OR "applied_generation" > 0)),
  CHECK (("status" = 'failed' AND "failure_code" IS NOT NULL) OR ("status" IN ('pending', 'ready') AND "failure_code" IS NULL))
);

CREATE UNIQUE INDEX "task_workflow_states_task_id_active_key_key" ON "task_workflow_states"("task_id", "active_key");
CREATE UNIQUE INDEX "task_workflow_states_task_id_enable_command_id_key" ON "task_workflow_states"("task_id", "enable_command_id");
CREATE INDEX "task_workflow_states_team_id_updated_at_idx" ON "task_workflow_states"("team_id", "updated_at");
CREATE UNIQUE INDEX "task_workflow_transitions_workflow_state_id_command_id_key" ON "task_workflow_transitions"("workflow_state_id", "command_id");
CREATE UNIQUE INDEX "task_workflow_transitions_workflow_state_id_to_state_version_key" ON "task_workflow_transitions"("workflow_state_id", "to_state_version");
CREATE INDEX "task_workflow_transitions_team_id_occurred_at_idx" ON "task_workflow_transitions"("team_id", "occurred_at");
CREATE INDEX "task_workflow_transitions_task_id_occurred_at_idx" ON "task_workflow_transitions"("task_id", "occurred_at");
CREATE INDEX "session_workflow_capabilities_workflow_state_id_revoked_at_idx" ON "session_workflow_capabilities"("workflow_state_id", "revoked_at");
CREATE INDEX "session_workflow_capabilities_team_id_task_id_idx" ON "session_workflow_capabilities"("team_id", "task_id");
CREATE INDEX "workspace_skill_sources_workspace_id_skill_id_idx" ON "workspace_skill_sources"("workspace_id", "skill_id");
CREATE INDEX "workspace_skill_sources_skill_revision_id_idx" ON "workspace_skill_sources"("skill_revision_id");
CREATE INDEX "workspace_skill_projections_workspace_id_desired_generation_idx" ON "workspace_skill_projections"("workspace_id", "desired_generation");
CREATE INDEX "workspace_skill_projections_skill_revision_id_idx" ON "workspace_skill_projections"("skill_revision_id");
