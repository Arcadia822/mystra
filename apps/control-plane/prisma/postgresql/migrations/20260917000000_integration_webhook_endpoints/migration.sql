CREATE TABLE "integration_webhook_endpoints" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "team_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  CONSTRAINT "integration_webhook_endpoints_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "integration_webhook_endpoints_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "integration_webhook_endpoints_connection_id_key" ON "integration_webhook_endpoints"("connection_id");
CREATE INDEX "integration_webhook_endpoints_team_id_idx" ON "integration_webhook_endpoints"("team_id");

CREATE UNIQUE INDEX "project_issue_sources_team_id_integration_scope_type_scope_external_id_key" ON "project_issue_sources"("team_id", "integration", "scope_type", "scope_external_id");
