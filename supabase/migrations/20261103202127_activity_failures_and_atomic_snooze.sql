-- A request that fails before a provider call still has a meaningful user-visible
-- failure. Attribute it to TARS; never imply that an external service was read.
create or replace function private.tars_activity(p_query text,p_result text,p_status text,p_sources text[],p_conversation text,p_url text default null)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare q text; summary text;
begin
  if p_status in ('failed','cancelled') and coalesce(cardinality(p_sources),0)=0 then p_sources:=array['TARS']; end if;
  q:=btrim(regexp_replace(coalesce(p_query,''),'[[:space:]]+',' ','g'));
  if length(q)<3 or q ~ '^[\[{]' or q ~ '^[A-Z][A-Z0-9]+(_[A-Z0-9]+)+$'
    or q ~* '^[0-9a-f]{8}-[0-9a-f-]{27,}$' or coalesce(cardinality(p_sources),0)=0
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
revoke all on function private.tars_activity(text,text,text,text[],text,text) from public,anon,authenticated;
grant execute on function private.tars_activity(text,text,text,text[],text,text) to service_role;
do $$ declare r record; begin
  for r in select user_id,request_id from public.ai_chat_requests where status='provider_failed' loop
    perform private.refresh_tars_chat_activity(r.user_id,r.request_id);
  end loop;
end $$;

-- Cloud snooze must be one transaction: never complete the original first and
-- lose the replacement when an insert fails. A parent revision identifies one
-- action across retries and concurrent devices.
alter table public.task_reminders add column source_reminder_id uuid;
alter table public.task_reminders add column snooze_revision integer;
alter table public.task_reminders add constraint reminder_snooze_owner_fk
  foreign key(source_reminder_id,user_id) references public.task_reminders(id,user_id) on delete cascade;
alter table public.task_reminders add constraint reminder_snooze_pair
  check ((source_reminder_id is null)=(snooze_revision is null) and (snooze_revision is null or snooze_revision>0));
create unique index reminder_snooze_once_per_revision on public.task_reminders(source_reminder_id,snooze_revision)
  where source_reminder_id is not null;
create or replace function public.snooze_tars_reminder(p_id uuid,p_revision integer)
returns uuid language plpgsql security invoker set search_path='' as $$
declare parent public.task_reminders%rowtype; child uuid; owner uuid:=(select auth.uid());
begin
  if owner is null then raise exception 'Sign in to snooze a reminder' using errcode='42501'; end if;
  select * into parent from public.task_reminders where id=p_id and user_id=owner for update;
  if not found then raise exception 'Reminder unavailable' using errcode='42501'; end if;
  select id into child from public.task_reminders where source_reminder_id=p_id and snooze_revision=p_revision and user_id=owner;
  if child is not null then return child; end if;
  if parent.status<>'active' or parent.revision<>p_revision or p_revision is null then
    raise exception 'The reminder changed. Refresh and try again.' using errcode='40001';
  end if;
  insert into public.task_reminders(user_id,title,due_at,repeat,timezone,sound,source_reminder_id,snooze_revision)
    values(owner,left(parent.title,145)||' (snoozed)',now()+interval '5 minutes','once',parent.timezone,parent.sound,p_id,p_revision)
    returning id into child;
  update public.task_reminders set status=case when repeat='once' then 'completed' else status end,
    revision=revision+1,updated_at=now() where id=p_id and user_id=owner;
  return child;
end $$;
revoke all on function public.snooze_tars_reminder(uuid,integer) from public,anon;
grant execute on function public.snooze_tars_reminder(uuid,integer) to authenticated;
