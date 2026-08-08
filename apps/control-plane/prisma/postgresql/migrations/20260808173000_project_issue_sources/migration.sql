CREATE TABLE "project_issue_sources" (
  "id" TEXT NOT NULL,
  "team_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "integration" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "scope_type" TEXT NOT NULL,
  "scope_external_id" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  CONSTRAINT "project_issue_sources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_issue_sources_project_id_integration_key" ON "project_issue_sources"("project_id", "integration");
CREATE INDEX "project_issue_sources_team_id_idx" ON "project_issue_sources"("team_id");
CREATE INDEX "project_issue_sources_connection_id_idx" ON "project_issue_sources"("connection_id");

ALTER TABLE "project_issue_sources" ADD CONSTRAINT "project_issue_sources_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_issue_sources" ADD CONSTRAINT "project_issue_sources_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_issue_sources" ADD CONSTRAINT "project_issue_sources_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
