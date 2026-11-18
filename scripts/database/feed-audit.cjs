const {withClient}=require('./connection.cjs');
withClient(async db=>{
  await db.query('begin isolation level repeatable read read only');
  try {
    const counts=await db.query(`select count(*)::int as total_runs,
      count(*) filter(where input_summary ~ '^\\s*[\\[{]')::int as json_argument_inputs,
      count(*) filter(where btrim(input_summary)='')::int as empty_inputs,
      count(*) filter(where metadata->>'request_id' is not null)::int as chat_linked_runs,
      count(*) filter(where scheduled_task_id is not null)::int as scheduled_runs,
      count(*) filter(where output_summary like '%Composio log%')::int as technical_output_summaries,
      count(*) filter(where action_name='maps_search_places' and metadata->>'provider'='open_maps' and metadata->>'request_id' is null and metadata->'activity'->>'title'='Place search')::int as intermediate_geocoding_projections
      from public.agent_tool_runs`);
    const requests=await db.query(`select status,count(*)::int as requests from public.ai_chat_requests group by status`);
    const threads=await db.query(`select type,count(*)::int as threads from public.chat_threads group by type`);
    const hasActivity=(await db.query("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='ai_chat_requests' and column_name='activity') as present")).rows[0].present;
    const feed=hasActivity?(await db.query("select activity->>'status' as status,count(*)::int as entries from public.ai_chat_requests where activity is not null group by activity->>'status'")).rows:[];
    console.log(JSON.stringify({project:'bdswodobwesadjedzhfg',feedSource:hasActivity?'validated request/scheduled activity projections':'agent_tool_runs',counts:counts.rows[0],requests:requests.rows,threadStorageTypes:threads.rows,feed,mutations:0}));
  } finally {await db.query('rollback');}
}).catch(e=>{console.error(e.code||e.name);process.exitCode=1;});
