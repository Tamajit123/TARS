-- Add server-owned execution leases and atomic completion to the existing
-- project. No customer rows are deleted, rewritten, or moved to another table.
begin;
set local lock_timeout = '5s';

alter table public.chat_threads validate constraint chat_threads_type_allowed;
alter table public.chat_threads validate constraint chat_threads_owner_auth_fk;
alter table public.chat_messages validate constraint chat_messages_thread_user_fk;
alter table public.chat_messages add constraint chat_messages_content_size
  check (char_length(content) between 1 and 20000) not valid;
alter table public.chat_messages validate constraint chat_messages_content_size;

alter table public.scheduled_agent_tasks
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists retry_after timestamptz,
  add column if not exists consecutive_failures integer not null default 0;
alter table public.agent_tool_runs
  add column if not exists scheduled_task_id uuid references public.scheduled_agent_tasks(id) on delete set null,
  add column if not exists scheduled_for timestamptz,
  add column if not exists manual boolean not null default false,
  add column if not exists attempt integer not null default 1 check (attempt between 1 and 3),
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists lease_token uuid;
create index if not exists agent_tool_runs_task_created on public.agent_tool_runs(scheduled_task_id,created_at desc);
create unique index if not exists agent_tool_runs_one_scheduled_occurrence
  on public.agent_tool_runs(scheduled_task_id,scheduled_for) where not manual;

-- One database calculation is shared by mobile creation and server recurrence.
-- Local wall-clock times follow Postgres' IANA timezone/DST rules.
create or replace function public.next_tars_run_at(p_rule jsonb,p_timezone text,p_after timestamptz default now())
returns timestamptz language plpgsql stable set search_path = '' as $$
declare
  local_now timestamp;
  candidate timestamp;
  target_day integer;
  day_delta integer;
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
    raise exception 'Unknown schedule timezone' using errcode='22023';
  end if;
  if jsonb_typeof(p_rule) is distinct from 'object'
     or coalesce(p_rule->>'frequency','') not in ('daily','weekly')
     or coalesce(p_rule->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Invalid daily/weekly schedule rule' using errcode='22023';
  end if;
  local_now := p_after at time zone p_timezone;
  candidate := local_now::date + (p_rule->>'time')::time;
  if p_rule->>'frequency'='weekly' then
    target_day := case lower(p_rule->>'weekday') when 'sunday' then 0 when 'monday' then 1 when 'tuesday' then 2 when 'wednesday' then 3 when 'thursday' then 4 when 'friday' then 5 when 'saturday' then 6 else null end;
    if target_day is null then raise exception 'A weekly schedule needs a weekday' using errcode='22023'; end if;
    day_delta := (target_day-extract(dow from local_now)::integer+7)%7;
    candidate := candidate+make_interval(days=>day_delta);
    if candidate at time zone p_timezone <= p_after then candidate := candidate+interval '7 days'; end if;
  elsif candidate at time zone p_timezone <= p_after then
    candidate := candidate+interval '1 day';
  end if;
  return candidate at time zone p_timezone;
end;
$$;
revoke all on function public.next_tars_run_at(jsonb,text,timestamptz) from public,anon;
grant execute on function public.next_tars_run_at(jsonb,text,timestamptz) to authenticated,service_role;

create or replace function public.validate_tars_schedule()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='INSERT' or new.schedule_rule is distinct from old.schedule_rule or new.timezone is distinct from old.timezone then
    new.next_run_at := public.next_tars_run_at(new.schedule_rule,new.timezone);
    new.retry_after := null;
    new.consecutive_failures := 0;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_tars_schedule() from public,anon,authenticated;
create trigger tars_validate_schedule before insert or update on public.scheduled_agent_tasks
  for each row execute function public.validate_tars_schedule();

-- App users manage the task definition, while the server owns execution state.
revoke insert,update on public.scheduled_agent_tasks from authenticated;
grant insert(user_id,title,original_prompt,task_type,task_payload,schedule_rule,timezone,delivery,next_run_at,status)
  on public.scheduled_agent_tasks to authenticated;
grant update(title,original_prompt,task_payload,schedule_rule,timezone,delivery,status)
  on public.scheduled_agent_tasks to authenticated;

create or replace function public.claim_tars_agent_runs(p_task_id uuid default null,p_owner_id uuid default null,p_limit integer default 25)
returns setof jsonb language plpgsql set search_path = '' as $$
declare task public.scheduled_agent_tasks%rowtype; run_id uuid; token uuid; is_manual boolean := p_task_id is not null;
begin
  if is_manual and p_owner_id is null then raise exception 'Manual claims need a verified owner' using errcode='22023'; end if;
  for task in
    select t.* from public.scheduled_agent_tasks t
    where (case when is_manual then t.id=p_task_id and t.user_id=p_owner_id and t.status in ('active','paused')
      else t.status='active' and t.next_run_at<=now() and (t.retry_after is null or t.retry_after<=now()) end)
      and (t.lease_expires_at is null or t.lease_expires_at<now())
    order by t.next_run_at limit greatest(1,least(coalesce(p_limit,25),25)) for update skip locked
  loop
    if not is_manual and exists(select 1 from public.agent_tool_runs r where r.scheduled_task_id=task.id and r.scheduled_for=task.next_run_at and not r.manual and r.attempt>=3 and r.status<>'completed') then
      update public.scheduled_agent_tasks set status='paused',lease_token=null,lease_expires_at=null,last_run_status='failed',last_run_error='Execution stopped after three attempts. Review and resume this task.' where id=task.id;
      update public.agent_tool_runs set status='failed',finished_at=now(),error_message='Execution lease expired after three attempts.' where scheduled_task_id=task.id and status='running';
      continue;
    end if;
    token := gen_random_uuid();
    run_id := null;
    insert into public.agent_tool_runs(user_id,action_name,input_summary,status,metadata,scheduled_task_id,scheduled_for,manual,lease_token,started_at)
    values(task.user_id,'scheduled_'||task.task_type,left(task.original_prompt,500),'running',jsonb_build_object('scheduled_task_id',task.id,'delivery',task.delivery,'manual',is_manual),task.id,case when is_manual then now() else task.next_run_at end,is_manual,token,now())
    on conflict(scheduled_task_id,scheduled_for) where not manual do update set status='running',attempt=public.agent_tool_runs.attempt+1,lease_token=excluded.lease_token,started_at=now(),finished_at=null,error_message=null
      where public.agent_tool_runs.status<>'completed' and public.agent_tool_runs.attempt<3
    returning id into run_id;
    if run_id is null then continue; end if;
    update public.scheduled_agent_tasks set lease_token=token,lease_expires_at=now()+interval '5 minutes' where id=task.id returning * into task;
    return next jsonb_build_object('schedule',to_jsonb(task),'runId',run_id,'leaseToken',token);
  end loop;
end;
$$;
revoke all on function public.claim_tars_agent_runs(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_tars_agent_runs(uuid,uuid,integer) to service_role;

create or replace function public.finish_tars_agent_run(p_run_id uuid,p_lease_token uuid,p_status text,p_output text default null,p_error text default null,p_message text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare execution public.agent_tool_runs%rowtype; task public.scheduled_agent_tasks%rowtype; thread_id uuid; message_id uuid; source_id text; next_run timestamptz;
begin
  if p_status not in ('completed','failed') then raise exception 'Invalid completion status' using errcode='22023'; end if;
  select * into execution from public.agent_tool_runs where id=p_run_id for update;
  if not found or execution.lease_token is distinct from p_lease_token then raise exception 'Execution lease not found' using errcode='40001'; end if;
  if execution.status='completed' then return jsonb_build_object('id',execution.scheduled_task_id,'status','completed','runId',execution.id,'chatMessageId',execution.metadata->>'chat_message_id'); end if;
  select * into task from public.scheduled_agent_tasks where id=execution.scheduled_task_id for update;
  if not found or task.lease_token is distinct from p_lease_token then raise exception 'Execution lease replaced' using errcode='40001'; end if;
  if p_status='completed' and task.delivery='chat' then
    if coalesce(length(btrim(p_message)),0)=0 or length(p_message)>20000 then raise exception 'A completed chat task needs a persisted result' using errcode='22023'; end if;
    source_id := coalesce(task.task_payload->>'sourceThreadId',task.task_payload->>'source_thread_id');
    if source_id ~ '^[0-9a-fA-F-]{36}$' then select id into thread_id from public.chat_threads where id=source_id::uuid and user_id=task.user_id; end if;
    if thread_id is null then
      insert into public.chat_threads(user_id,type,title) values(task.user_id,'main','Main chat')
        on conflict(user_id) where type='main' do update set user_id=excluded.user_id returning id into thread_id;
    end if;
    insert into public.chat_messages(user_id,thread_id,role,content,metadata)
      values(task.user_id,thread_id,'assistant',p_message,jsonb_build_object('type','scheduled_task_result','scheduledTaskId',task.id,'executionId',execution.id,'status','completed')) returning id into message_id;
    update public.chat_threads set has_unread_updates=true,updated_at=now() where id=thread_id;
  end if;
  if not execution.manual and p_status='completed' then next_run := public.next_tars_run_at(task.schedule_rule,task.timezone); end if;
  update public.agent_tool_runs set status=p_status,output_summary=left(p_output,20000),error_message=left(p_error,1000),finished_at=now(),metadata=metadata||jsonb_build_object('chat_message_id',message_id) where id=execution.id;
  update public.scheduled_agent_tasks set
    lease_token=null,lease_expires_at=null,last_run_at=now(),last_run_status=p_status,last_run_summary=case when p_status='completed' then left(p_output,20000) else null end,last_run_error=left(p_error,1000),
    next_run_at=coalesce(next_run,next_run_at),
    consecutive_failures=case when p_status='completed' then 0 when execution.manual then consecutive_failures else consecutive_failures+1 end,
    retry_after=case when p_status='failed' and not execution.manual then now()+make_interval(mins=>5*execution.attempt) else null end,
    status=case when p_status='failed' and not execution.manual and execution.attempt>=3 then 'paused' else status end
    where id=task.id;
  return jsonb_build_object('id',task.id,'status',p_status,'runId',execution.id,'chatMessageId',message_id);
end;
$$;
revoke all on function public.finish_tars_agent_run(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_tars_agent_run(uuid,uuid,text,text,text,text) to service_role;
commit;
