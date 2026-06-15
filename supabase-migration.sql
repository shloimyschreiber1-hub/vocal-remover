-- Add new columns to jobs table for LALAL.AI task IDs
alter table jobs add column lalal_vocal_task_id text;
alter table jobs add column lalal_instrumental_task_id text;

-- Track how many credits a job consumed (1 credit per 6 minutes of audio).
-- Lets us refund the exact amount if a job later fails.
alter table jobs add column if not exists credits_used integer not null default 1;
