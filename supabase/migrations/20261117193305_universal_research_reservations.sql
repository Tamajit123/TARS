-- Research reuses existing owned execution records; no data backfill/removal.
create index if not exists agent_runs_research_cache on public.agent_tool_runs
  (user_id,action_name,((metadata->'research')->>'key'),created_at desc)
  where action_name in ('research_search','research_fetch');
create or replace function public.claim_tars_research_run(p_owner uuid,p_action text,p_input text,p_metadata jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare run_id uuid;
begin
  if p_owner is null or p_action not in ('research_search','research_fetch')
    or length(p_input)<1 or length(p_input)>2000 or jsonb_typeof(p_metadata)<>'object'
    or p_metadata->>'provider'<>'web_search' then
    raise exception 'Invalid research reservation' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(748293111);
  if (select count(*) from public.agent_tool_runs where action_name in ('research_search','research_fetch') and status='running' and created_at>now()-interval '2 minutes')>=6
    or (select count(*) from public.agent_tool_runs where user_id=p_owner and action_name in ('research_search','research_fetch') and status='running' and created_at>now()-interval '2 minutes')>=2
    or (select count(*) from public.agent_tool_runs where user_id=p_owner and action_name in ('research_search','research_fetch') and created_at>now()-interval '1 minute')>=16 then return null; end if;
  insert into public.agent_tool_runs(user_id,action_name,input_summary,status,started_at,metadata)
    values(p_owner,p_action,p_input,'running',now(),p_metadata) returning id into run_id;
  return run_id;
end $$;
revoke all on function public.claim_tars_research_run(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_tars_research_run(uuid,text,text,jsonb) to service_role;
-- Rollback, if needed: drop only this new function/index, never execution rows.
