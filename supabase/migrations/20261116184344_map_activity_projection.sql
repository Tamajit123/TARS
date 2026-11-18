-- API search uses the same single request-level Feed projection as browsing.
do $$ declare definition text; begin
  select pg_get_functiondef('private.refresh_tars_chat_activity(uuid,text)'::regprocedure) into definition;
  if position('when ''web_search''' in definition)=0 then
    definition:=replace(definition,'when ''browserbase'' then ''Web''','when ''web_search'' then ''Web'' when ''browserbase'' then ''Web''');
    if position('when ''web_search''' in definition)=0 then raise exception 'Existing Web Feed mapping was not found'; end if;
    execute definition;
  end if;
end $$;

-- Geocoder choices are intermediate steps of the manual route form, not
-- separate finished tasks. Remove only that derived projection, preserving
-- execution rows/results, messages, conversations and completed road routes.
update public.agent_tool_runs set metadata=metadata-'activity'
where action_name='maps_search_places' and metadata->>'provider'='open_maps'
  and metadata->>'request_id' is null
  and metadata->'activity'->>'title'='Place search';
