CREATE TABLE "skills" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "team_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active_name" TEXT,
  "status" TEXT NOT NULL,
  "current_revision_id" TEXT,
  "resource_revision" INTEGER NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "archived_by_user_id" TEXT,
  "archived_at" TEXT,
  CONSTRAINT "skills_lifecycle_check" CHECK (
    ("status" = 'active' AND "active_name" = "name" AND "archived_by_user_id" IS NULL AND "archived_at" IS NULL)
    OR ("status" = 'archived' AND "active_name" IS NULL AND "archived_by_user_id" IS NOT NULL AND "archived_at" IS NOT NULL)
  ),
  CONSTRAINT "skills_visibility_revision_check" CHECK (
    ("current_revision_id" IS NULL AND "resource_revision" = 0)
    OR ("current_revision_id" IS NOT NULL AND "resource_revision" >= 1)
  ),
  CONSTRAINT "skills_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "skills_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "skills_archived_by_user_id_fkey" FOREIGN KEY ("archived_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "skills_current_revision_id_fkey" FOREIGN KEY ("current_revision_id") REFERENCES "skill_revisions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "skill_revisions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "skill_id" TEXT NOT NULL,
  "base_revision_id" TEXT,
  "sequence" INTEGER,
  "publication_status" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "manifest_json" TEXT NOT NULL,
  "compressed_size_bytes" INTEGER NOT NULL,
  "uncompressed_size_bytes" INTEGER NOT NULL,
  "zip_sha256" TEXT NOT NULL,
  "content_sha256" TEXT NOT NULL,
  "object_key" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "ready_at" TEXT,
  "failed_at" TEXT,
  "failure_code" TEXT,
  CONSTRAINT "skill_revisions_state_check" CHECK (
    ("publication_status" = 'uploading' AND "sequence" IS NULL AND "ready_at" IS NULL AND "failed_at" IS NULL AND "failure_code" IS NULL)
    OR ("publication_status" = 'ready' AND "sequence" > 0 AND "ready_at" IS NOT NULL AND "failed_at" IS NULL AND "failure_code" IS NULL)
    OR ("publication_status" = 'failed' AND "sequence" IS NULL AND "ready_at" IS NULL AND "failed_at" IS NOT NULL AND "failure_code" IS NOT NULL)
  ),
  CONSTRAINT "skill_revisions_size_check" CHECK (
    "compressed_size_bytes" > 0 AND "compressed_size_bytes" <= 20971520
    AND "uncompressed_size_bytes" > 0 AND "uncompressed_size_bytes" <= 104857600
  ),
  CONSTRAINT "skill_revisions_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "skill_revisions_base_revision_id_fkey" FOREIGN KEY ("base_revision_id") REFERENCES "skill_revisions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "skill_revisions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "skills_team_id_active_name_key" ON "skills"("team_id", "active_name");
CREATE INDEX "skills_team_id_status_updated_at_id_idx" ON "skills"("team_id", "status", "updated_at", "id");
CREATE INDEX "skills_team_id_name_archived_at_idx" ON "skills"("team_id", "name", "archived_at");
CREATE UNIQUE INDEX "skill_revisions_skill_id_sequence_key" ON "skill_revisions"("skill_id", "sequence");
CREATE UNIQUE INDEX "skill_revisions_skill_id_base_revision_id_zip_sha256_key" ON "skill_revisions"("skill_id", "base_revision_id", "zip_sha256");
CREATE INDEX "skill_revisions_skill_id_sequence_idx" ON "skill_revisions"("skill_id", "sequence");
CREATE INDEX "skill_revisions_skill_id_publication_status_created_at_idx" ON "skill_revisions"("skill_id", "publication_status", "created_at");
