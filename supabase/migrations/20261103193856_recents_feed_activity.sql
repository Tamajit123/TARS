-- Add a user-facing projection to existing requests; execution audit records stay intact.
alter table public.ai_chat_requests add column if not exists activity jsonb;
alter table public.ai_chat_requests add constraint ai_chat_activity_object
  check (activity is null or (jsonb_typeof(activity)='object' and activity->>'version'='1'));
create index if not exists ai_chat_activity_owner_recent
  on public.ai_chat_requests(user_id,created_at desc) where activity is not null;
-- Expose only the derived Feed fields, not request recovery state or response caches.
grant select(id,user_id,activity,created_at) on public.ai_chat_requests to authenticated;
create policy tars_feed_owner_read on public.ai_chat_requests for select to authenticated
  using ((select auth.uid())=user_id and activity is not null);

create or replace function private.tars_activity(p_query text,p_result text,p_status text,p_sources text[],p_conversation text,p_url text default null)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare q text; summary text;
begin
  q:=btrim(regexp_replace(coalesce(p_query,''),'[[:space:]]+',' ','g'));
  if length(q)<3 or q ~ '^[\[{]' or q ~ '^[A-Z][A-Z0-9]+(_[A-Z0-9]+)+$'
    or q ~* '^[0-9a-f]{8}-[0-9a-f-]{27,}$' or cardinality(p_sources)=0
    or p_status not in ('completed','failed','cancelled') then return null; end if;
  if p_status='completed' then
    summary:=regexp_replace(coalesce(p_result,''),'\[([^]]+)\]\([^)]+\)','\1','g');
    summary:=btrim(regexp_replace(regexp_replace(summary,'[`#*]','','g'),'[[:space:]]+',' ','g'));
    if summary='' or summary ~ '^[\[{]' or summary like '%Composio log%' then
      summary:='The connected service returned a result. Open the conversation to review it.';
    end if;
  elsif p_status='cancelled' then summary:='This request was stopped before completion. No successful result is claimed.';
  else summary:='This request did not finish successfully. Open the conversation or task to review the result and retry.';
  end if;
  return jsonb_build_object('version',1,'query',left(q,12000),'title',left(q,120),
    'summary',left(summary,900),'sources',to_jsonb(p_sources),'status',p_status,
    'conversationId',p_conversation,'sourceUrl',case when p_url ~ '^https://' then p_url else null end);
end $$;
revoke all on function private.tars_activity(text,text,text,text[],text,text) from public,anon;
grant execute on function private.tars_activity(text,text,text,text[],text,text) to authenticated,service_role;

create or replace function private.refresh_tars_chat_activity(p_owner uuid,p_request text)
returns void language plpgsql security invoker set search_path='' as $$
declare r public.ai_chat_requests%rowtype; q text; sources text[]; state text; result jsonb; bad boolean;
begin
  select * into r from public.ai_chat_requests where user_id=p_owner and request_id=p_request;
  if not found or r.status not in ('completed','provider_failed') then return; end if;
  select content into q from public.chat_messages where user_id=p_owner and thread_id=r.conversation_id
    and request_id=p_request and role='user' order by created_at,id limit 1;
  select array_agg(distinct case coalesce(metadata->>'toolkit',metadata->>'provider')
    when 'twitter' then 'X' when 'googlecalendar' then 'Google Calendar'
    when 'google_maps' then 'Google Maps' when 'gmail' then 'Gmail'
    when 'github' then 'GitHub' when 'browserbase' then 'Web'
    when 'reddit' then 'Reddit' when 'slack' then 'Slack' when 'notion' then 'Notion'
    when 'jira' then 'Jira' when 'trello' then 'Trello' when 'instagram' then 'Instagram'
    else 'Connected service' end),bool_or(status<>'completed') into sources,bad
    from public.agent_tool_runs where user_id=p_owner and metadata->>'request_id'=p_request
      and metadata->>'conversation_id'=r.conversation_id::text;
  state:=case when r.error_code in ('cancelled','aborted','provider_cancelled') then 'cancelled'
    when r.status='provider_failed' or coalesce(bad,false) then 'failed' else 'completed' end;
  result:=private.tars_activity(q,r.response_text,state,coalesce(sources,'{}'),r.conversation_id::text);
  update public.ai_chat_requests set activity=result where id=r.id and activity is distinct from result;
end $$;
revoke all on function private.refresh_tars_chat_activity(uuid,text) from public,anon,authenticated;
grant execute on function private.refresh_tars_chat_activity(uuid,text) to service_role;

create or replace function private.on_tars_request_activity()
returns trigger language plpgsql security invoker set search_path='' as $$
begin perform private.refresh_tars_chat_activity(new.user_id,new.request_id); return new; end $$;
revoke all on function private.on_tars_request_activity() from public,anon,authenticated;
create trigger tars_request_activity after update of status,response_text on public.ai_chat_requests
  for each row execute function private.on_tars_request_activity();

create or replace function private.on_tars_scheduled_activity()
returns trigger language plpgsql security invoker set search_path='' as $$
declare q text; conversation text; result jsonb;
begin
  if new.scheduled_task_id is null or new.status not in ('completed','failed','cancelled') then return new; end if;
  select original_prompt into q from public.scheduled_agent_tasks where id=new.scheduled_task_id and user_id=new.user_id;
  select thread_id::text into conversation from public.chat_messages
    where user_id=new.user_id and id::text=new.metadata->>'chat_message_id';
  result:=private.tars_activity(q,new.output_summary,new.status,array['Scheduled task'],conversation);
  new.metadata:=new.metadata||jsonb_build_object('activity',result); return new;
end $$;
revoke all on function private.on_tars_scheduled_activity() from public,anon,authenticated;
create trigger tars_scheduled_activity before update of status,output_summary on public.agent_tool_runs
  for each row execute function private.on_tars_scheduled_activity();

-- Recents has one chronological collection. Legacy IDs, messages, attachments
-- and task references remain unchanged; the legacy column is retained for compatibility.
update public.chat_threads set type='side' where type='main';
create or replace function private.title_tars_conversation()
returns trigger language plpgsql security invoker set search_path='' as $$
declare first_query text;
begin
  if new.role<>'user' then return new; end if;
  select content into first_query from public.chat_messages where thread_id=new.thread_id
    and user_id=new.user_id and role='user' and length(btrim(content))>0 order by created_at,id limit 1;
  update public.chat_threads set title=left(regexp_replace(btrim(first_query),'[[:space:]]+',' ','g'),80),updated_at=now()
    where id=new.thread_id and user_id=new.user_id;
  return new;
end $$;
revoke all on function private.title_tars_conversation() from public,anon;
grant execute on function private.title_tars_conversation() to authenticated,service_role;
create trigger tars_conversation_title after insert on public.chat_messages
  for each row execute function private.title_tars_conversation();
update public.chat_threads t set title=left(regexp_replace(btrim(m.content),'[[:space:]]+',' ','g'),80)
  from (select distinct on(thread_id,user_id) thread_id,user_id,content from public.chat_messages
    where role='user' and length(btrim(content))>0 order by thread_id,user_id,created_at,id) m
  where t.id=m.thread_id and t.user_id=m.user_id
    and (t.title in ('New Chat','New conversation','Main chat','Main conversation')
      or exists(select 1 from public.chat_messages old where old.thread_id=t.id and old.user_id=t.user_id and old.role='user' and left(old.content,80)=t.title));

-- Backfill only the derived Feed projection. Never delete execution rows/messages.
do $$ declare r record; begin
  for r in select user_id,request_id from public.ai_chat_requests loop
    perform private.refresh_tars_chat_activity(r.user_id,r.request_id);
  end loop;
end $$;
update public.agent_tool_runs set status=status where scheduled_task_id is not null and status in ('completed','failed','cancelled');

-- Keep scheduler leases, idempotency and history. Only its fallback destination
-- changes: a normal conversation retained in the task payload, never a main chat.
create or replace function public.finish_tars_agent_run(p_run_id uuid,p_lease_token uuid,p_status text,p_output text default null,p_error text default null,p_message text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
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
    source_id:=coalesce(task.task_payload->>'sourceThreadId',task.task_payload->>'source_thread_id');
    if source_id ~ '^[0-9a-fA-F-]{36}$' then select id into thread_id from public.chat_threads where id=source_id::uuid and user_id=task.user_id; end if;
    if thread_id is null then
      insert into public.chat_threads(user_id,type,title) values(task.user_id,'side',left(task.original_prompt,80)) returning id into thread_id;
      update public.scheduled_agent_tasks set task_payload=coalesce(task_payload,'{}')||jsonb_build_object('sourceThreadId',thread_id) where id=task.id;
    end if;
    insert into public.chat_messages(user_id,thread_id,role,content,metadata)
      values(task.user_id,thread_id,'assistant',p_message,jsonb_build_object('type','scheduled_task_result','scheduledTaskId',task.id,'executionId',execution.id,'status','completed')) returning id into message_id;
    update public.chat_threads set has_unread_updates=true,updated_at=now() where id=thread_id;
  end if;
  if not execution.manual and p_status='completed' then next_run:=public.next_tars_run_at(task.schedule_rule,task.timezone); end if;
  update public.agent_tool_runs set status=p_status,output_summary=left(p_output,20000),error_message=left(p_error,1000),finished_at=now(),metadata=metadata||jsonb_build_object('chat_message_id',message_id) where id=execution.id;
  update public.scheduled_agent_tasks set lease_token=null,lease_expires_at=null,last_run_at=now(),last_run_status=p_status,
    last_run_summary=case when p_status='completed' then left(p_output,20000) else null end,last_run_error=left(p_error,1000),
    next_run_at=coalesce(next_run,next_run_at),consecutive_failures=case when p_status='completed' then 0 when execution.manual then consecutive_failures else consecutive_failures+1 end,
    retry_after=case when p_status='failed' and not execution.manual then now()+make_interval(mins=>5*execution.attempt) else null end,
    status=case when p_status='failed' and not execution.manual and execution.attempt>=3 then 'paused' else status end where id=task.id;
  return jsonb_build_object('id',task.id,'status',p_status,'runId',execution.id,'chatMessageId',message_id);
end $$;
revoke all on function public.finish_tars_agent_run(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_tars_agent_run(uuid,uuid,text,text,text,text) to service_role;
