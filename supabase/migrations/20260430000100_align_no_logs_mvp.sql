-- Align schema with the reviewed no-logs MVP contract.
-- The initial migration may already be applied on hosted Supabase, so this is a
-- forward migration instead of editing migration history.

alter table jobs
  add column if not exists branch_name text,
  add column if not exists mr_title text,
  add column if not exists mr_body text;

update jobs
set branch_name = coalesce(branch_name, task_id)
where branch_name is null;

alter table jobs
  alter column branch_name set not null,
  drop column if exists callback_url;

alter table run_events
  drop column if exists log_offset;

drop table if exists run_logs;

comment on column jobs.branch_name is 'Task-provided branch name. Mystra MVP does not sanitize or generate fallback names.';
comment on column jobs.mr_title is 'Optional task/repository-provided merge request title.';
comment on column jobs.mr_body is 'Optional task/repository-provided merge request body.';
comment on table run_events is 'Structured append-only run events. MVP does not store stdout/stderr logs.';
