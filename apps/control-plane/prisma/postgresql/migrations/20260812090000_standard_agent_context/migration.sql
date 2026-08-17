ALTER TABLE "sessions"
  ALTER COLUMN "agent_id" DROP NOT NULL,
  ALTER COLUMN "agent_revision" DROP NOT NULL,
  ADD CONSTRAINT "sessions_agent_context_check" CHECK (
    ("agent_id" IS NULL AND "agent_revision" IS NULL)
    OR ("agent_id" IS NOT NULL AND "agent_revision" IS NOT NULL)
  );
