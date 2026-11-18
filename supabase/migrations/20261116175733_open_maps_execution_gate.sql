-- Additive demo-provider gate. No existing row or table is removed or rewritten.
create index if not exists agent_runs_open_maps_recent on public.agent_tool_runs(created_at desc,user_id) where metadata->>'provider'='open_maps';
create or replace function public.claim_tars_map_run(p_owner uuid,p_action text,p_summary text,p_metadata jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare run_id uuid;
begin
  if p_action not in ('maps_search_places','maps_compute_route') or length(p_summary)>1000
    or jsonb_typeof(p_metadata)<>'object' or p_metadata->>'provider'<>'open_maps' then
    raise exception 'Invalid map request' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(748293110);
  if exists(select 1 from public.agent_tool_runs where metadata->>'provider'='open_maps' and created_at>now()-interval '1100 milliseconds')
    or (select count(*) from public.agent_tool_runs where user_id=p_owner and metadata->>'provider'='open_maps' and created_at>now()-interval '1 minute')>=8 then return null; end if;
  insert into public.agent_tool_runs(user_id,action_name,input_summary,status,started_at,metadata)
    values(p_owner,p_action,p_summary,'running',now(),p_metadata) returning id into run_id;
  return run_id;
end $$;
revoke all on function public.claim_tars_map_run(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_tars_map_run(uuid,text,text,jsonb) to service_role;

-- Retain the current projection implementation; add only the new provider name.
do $$ declare definition text; begin
  select pg_get_functiondef('private.refresh_tars_chat_activity(uuid,text)'::regprocedure) into definition;
  if position('when ''open_maps''' in definition)=0 then
    definition:=replace(definition,'when ''google_maps'' then ''Google Maps''','when ''open_maps'' then ''OpenStreetMap'' when ''google_maps'' then ''Google Maps''');
    if position('when ''open_maps''' in definition)=0 then raise exception 'Existing Feed source mapping was not found'; end if;
    execute definition;
  end if;
end $$;
