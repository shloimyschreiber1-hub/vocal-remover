-- Add new columns to jobs table for LALAL.AI task IDs
alter table jobs add column lalal_vocal_task_id text;
alter table jobs add column lalal_instrumental_task_id text;
