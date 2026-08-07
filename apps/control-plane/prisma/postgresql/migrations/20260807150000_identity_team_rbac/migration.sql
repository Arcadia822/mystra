DROP TABLE "tasks";
DROP TABLE "projects";
DROP TABLE "integration_connections";

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "require_password_change" BOOLEAN NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "archived_at" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_salt" TEXT NOT NULL,
    "password_params" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "active_team_id" TEXT,
    "expires_at" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_memberships" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_connections" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "integration" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "auth_method" TEXT NOT NULL,
    "provider_external_id" TEXT NOT NULL,
    "display_name" TEXT,
    "provider_subject" TEXT NOT NULL,
    "connection_config" TEXT NOT NULL,
    "capabilities" TEXT NOT NULL,
    "credential_ref" TEXT,
    "credential_state" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "repository_connection_id" TEXT NOT NULL,
    "repository_external_id" TEXT NOT NULL,
    "repository_base_branch" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "archived_at" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "issue_dispatch_key" TEXT,
    "metadata" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE INDEX "users_created_at_id_idx" ON "users"("created_at", "id");
CREATE UNIQUE INDEX "auth_accounts_user_id_key" ON "auth_accounts"("user_id");
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE INDEX "auth_sessions_expires_at_id_idx" ON "auth_sessions"("expires_at", "id");
CREATE INDEX "teams_status_idx" ON "teams"("status");
CREATE INDEX "teams_created_at_id_idx" ON "teams"("created_at", "id");
CREATE UNIQUE INDEX "team_memberships_team_id_user_id_key" ON "team_memberships"("team_id", "user_id");
CREATE INDEX "team_memberships_user_id_idx" ON "team_memberships"("user_id");
CREATE INDEX "team_memberships_team_id_status_idx" ON "team_memberships"("team_id", "status");
CREATE INDEX "team_memberships_team_id_role_idx" ON "team_memberships"("team_id", "role");
CREATE UNIQUE INDEX "integration_connections_team_id_integration_provider_provider_exter_key" ON "integration_connections"("team_id", "integration", "provider", "provider_external_id");
CREATE INDEX "integration_connections_team_id_idx" ON "integration_connections"("team_id");
CREATE INDEX "integration_connections_integration_status_idx" ON "integration_connections"("integration", "status");
CREATE INDEX "integration_connections_created_at_id_idx" ON "integration_connections"("created_at", "id");
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");
CREATE INDEX "projects_team_id_idx" ON "projects"("team_id");
CREATE INDEX "projects_repository_connection_id_idx" ON "projects"("repository_connection_id");
CREATE INDEX "projects_created_at_id_idx" ON "projects"("created_at", "id");
CREATE UNIQUE INDEX "tasks_issue_dispatch_key_key" ON "tasks"("issue_dispatch_key");
CREATE INDEX "tasks_team_id_idx" ON "tasks"("team_id");
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");
CREATE INDEX "tasks_created_at_id_idx" ON "tasks"("created_at", "id");

ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_active_team_id_fkey" FOREIGN KEY ("active_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_repository_connection_id_fkey" FOREIGN KEY ("repository_connection_id") REFERENCES "integration_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
