CREATE TABLE "sessions" (
  "id" TEXT NOT NULL,
  "team_id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "project_id" TEXT,
  "runtime_id" TEXT NOT NULL,
  "provider_key" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "agent_revision" INTEGER NOT NULL,
  "state" TEXT NOT NULL,
  "active_message_id" TEXT,
  "last_message_id" TEXT,
  "interrupt_kind" TEXT,
  "continuation_mode" TEXT,
  "failure_code" TEXT,
  "metadata" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "session_events" (
  "event_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "source_sequence" INTEGER NOT NULL,
  "global_sequence" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "message_id" TEXT,
  "payload" TEXT NOT NULL,
  "metadata" TEXT NOT NULL,
  "occurred_at" TEXT NOT NULL,
  "accepted_at" TEXT NOT NULL,
  CONSTRAINT "session_events_pkey" PRIMARY KEY ("event_id")
);

CREATE TABLE "session_event_heads" (
  "session_id" TEXT NOT NULL,
  "last_global_sequence" INTEGER NOT NULL,
  "launch_payload" TEXT NOT NULL,
  CONSTRAINT "session_event_heads_pkey" PRIMARY KEY ("session_id")
);

CREATE TABLE "session_event_streams" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "last_source_sequence" INTEGER NOT NULL,
  CONSTRAINT "session_event_streams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "session_dispatch_leases" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "runtime_id" TEXT NOT NULL,
  "runner_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "provider_session_id" TEXT,
  "lease_expires_at" TEXT NOT NULL,
  "claimed_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  CONSTRAINT "session_dispatch_leases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sessions_team_id_updated_at_id_idx" ON "sessions"("team_id", "updated_at", "id");
CREATE INDEX "sessions_task_id_updated_at_id_idx" ON "sessions"("task_id", "updated_at", "id");
CREATE INDEX "sessions_runtime_id_state_created_at_id_idx" ON "sessions"("runtime_id", "state", "created_at", "id");
CREATE UNIQUE INDEX "session_events_session_id_source_id_source_sequence_key" ON "session_events"("session_id", "source_id", "source_sequence");
CREATE UNIQUE INDEX "session_events_session_id_global_sequence_key" ON "session_events"("session_id", "global_sequence");
CREATE INDEX "session_events_session_id_message_id_global_sequence_idx" ON "session_events"("session_id", "message_id", "global_sequence");
CREATE UNIQUE INDEX "session_event_streams_session_id_source_id_key" ON "session_event_streams"("session_id", "source_id");
CREATE UNIQUE INDEX "session_dispatch_leases_session_id_key" ON "session_dispatch_leases"("session_id");
CREATE INDEX "session_dispatch_leases_runtime_id_lease_expires_at_idx" ON "session_dispatch_leases"("runtime_id", "lease_expires_at");

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_event_heads" ADD CONSTRAINT "session_event_heads_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_event_streams" ADD CONSTRAINT "session_event_streams_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_dispatch_leases" ADD CONSTRAINT "session_dispatch_leases_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_dispatch_leases" ADD CONSTRAINT "session_dispatch_leases_runtime_id_fkey" FOREIGN KEY ("runtime_id") REFERENCES "runtimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
