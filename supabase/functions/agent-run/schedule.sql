-- Production cron dispatcher for `agent-run`.
--
-- Run this in Supabase SQL Editor after deploying `agent-run`.
-- This creates one global cron job that asks the Edge Function to run all due
-- rows from `public.scheduled_agent_tasks`.
--
-- Important:
-- - Do not put a hardcoded userId or task here.
-- - User-created schedules should be saved in `public.scheduled_agent_tasks`.
-- - The Edge Function should handle `mode = "run_due_schedules"`.
-- - Replace all three vault secret values before running this file.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;

select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'tars_agent_project_url'
);

select vault.create_secret(
  'YOUR_SUPABASE_ANON_KEY',
  'tars_supabase_anon_key'
);

select vault.create_secret(
  'YOUR_SCHEDULER_SECRET',
  'tars_scheduler_secret'
);

-- Keep this cron setup re-runnable by removing the previous job if it exists.
do $$
begin
  perform cron.unschedule('tars-agent-run-due-schedules');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'tars-agent-run-due-schedules',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'tars_agent_project_url'
    )
      || '/functions/v1/agent-run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'tars_supabase_anon_key'
      ),
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'tars_scheduler_secret'
      )
    ),
    body := jsonb_build_object(
      'mode', 'run_due_schedules',
      'source', 'pg_cron',
      'triggeredAt', now()
    )
  );
  $$
);
