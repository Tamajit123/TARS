begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Secrets are read only inside this privileged, non-exposed function. Neither
-- the cron command nor migration history contains their values.
create or replace function private.dispatch_tars_schedules()
returns bigint language plpgsql security definer set search_path = '' as $$
declare project_url text; public_key text; scheduler_key text; request_id bigint;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name='tars_agent_project_url';
  select decrypted_secret into public_key from vault.decrypted_secrets where name='tars_supabase_anon_key';
  select decrypted_secret into scheduler_key from vault.decrypted_secrets where name='tars_scheduler_secret';
  if project_url is null or public_key is null or length(coalesce(scheduler_key,''))<32 then
    raise exception 'TARS dispatcher secrets are not configured' using errcode='55000';
  end if;
  if project_url !~ '^https://[a-z0-9]+\.supabase\.co$' then raise exception 'Invalid dispatcher project URL' using errcode='22023'; end if;
  select net.http_post(
    url:=project_url||'/functions/v1/agent-run',
    headers:=jsonb_build_object('Content-Type','application/json','apikey',public_key,'Authorization','Bearer '||scheduler_key),
    body:=jsonb_build_object('mode','run_due_schedules','source','pg_cron'),
    timeout_milliseconds:=60000
  ) into request_id;
  return request_id;
end;
$$;
revoke all on function private.dispatch_tars_schedules() from public,anon,authenticated,service_role;

create or replace function private.install_tars_dispatcher()
returns bigint language plpgsql set search_path = '' as $$
declare job_id bigint;
begin
  if (select count(distinct name) from vault.secrets where name in ('tars_agent_project_url','tars_supabase_anon_key','tars_scheduler_secret'))<>3 then
    raise exception 'Configure TARS dispatcher secrets before installing the job' using errcode='55000';
  end if;
  select cron.schedule('tars-agent-run-due-schedules','* * * * *','select private.dispatch_tars_schedules();') into job_id;
  return job_id;
end;
$$;
revoke all on function private.install_tars_dispatcher() from public,anon,authenticated,service_role;
do $$ begin
  if (select count(distinct name) from vault.secrets where name in ('tars_agent_project_url','tars_supabase_anon_key','tars_scheduler_secret'))=3 then
    perform private.install_tars_dispatcher();
  end if;
end $$;
commit;
