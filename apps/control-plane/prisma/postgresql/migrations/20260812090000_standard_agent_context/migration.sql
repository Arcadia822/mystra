ALTER TABLE "harnesses" ADD COLUMN "agent_name" TEXT;

UPDATE "harnesses" AS h
SET "agent_name" = a."name"
FROM "agents" AS a
WHERE a."id" = h."agent_id";

ALTER TABLE "harnesses"
  ALTER COLUMN "agent_id" DROP NOT NULL,
  ALTER COLUMN "agent_revision" DROP NOT NULL,
  ALTER COLUMN "agent_system_prompt" DROP NOT NULL,
  ADD CONSTRAINT "harnesses_agent_context_check" CHECK (
    ("agent_id" IS NULL AND "agent_name" IS NULL AND "agent_revision" IS NULL AND "agent_system_prompt" IS NULL)
    OR
    ("agent_id" IS NOT NULL AND "agent_name" IS NOT NULL AND "agent_revision" IS NOT NULL AND "agent_system_prompt" IS NOT NULL)
  );

ALTER TABLE "sessions"
  ALTER COLUMN "agent_id" DROP NOT NULL,
  ALTER COLUMN "agent_revision" DROP NOT NULL,
  ADD CONSTRAINT "sessions_agent_context_check" CHECK (
    ("agent_id" IS NULL AND "agent_revision" IS NULL)
    OR ("agent_id" IS NOT NULL AND "agent_revision" IS NOT NULL)
  );
