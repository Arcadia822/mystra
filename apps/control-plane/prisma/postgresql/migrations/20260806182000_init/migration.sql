-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "issue_dispatch_key" TEXT,
    "metadata" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_connections_integration_status_idx" ON "integration_connections"("integration", "status");

-- CreateIndex
CREATE INDEX "integration_connections_created_at_id_idx" ON "integration_connections"("created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_integration_provider_provider_exter_key" ON "integration_connections"("integration", "provider", "provider_external_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "projects_repository_connection_id_idx" ON "projects"("repository_connection_id");

-- CreateIndex
CREATE INDEX "projects_created_at_id_idx" ON "projects"("created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_issue_dispatch_key_key" ON "tasks"("issue_dispatch_key");

-- CreateIndex
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");

-- CreateIndex
CREATE INDEX "tasks_created_at_id_idx" ON "tasks"("created_at", "id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_repository_connection_id_fkey" FOREIGN KEY ("repository_connection_id") REFERENCES "integration_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
