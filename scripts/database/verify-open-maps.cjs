const assert=require('node:assert/strict');
const {withClient}=require('./connection.cjs');
withClient(async db=>{
  await db.query('begin');
  try{
    const fn="public.claim_tars_map_run(uuid,text,text,jsonb)";
    const acl=(await db.query('select has_function_privilege($1,$4,$5) as anon,has_function_privilege($2,$4,$5) as authenticated,has_function_privilege($3,$4,$5) as server',['anon','authenticated','service_role',fn,'execute'])).rows[0];
    assert.equal(acl.anon,false);assert.equal(acl.authenticated,false);assert.equal(acl.server,true);
    const owner=(await db.query('select id from public.profiles order by created_at limit 1')).rows[0].id;
    await db.query('set local role service_role');
    const args=[owner,'maps_search_places','Rollback-only verification',{provider:'open_maps'}];
    const first=(await db.query('select public.claim_tars_map_run($1,$2,$3,$4) as id',args)).rows[0].id;
    assert.ok(first,'No request should be running immediately before this verification');
    assert.equal((await db.query('select public.claim_tars_map_run($1,$2,$3,$4) as id',args)).rows[0].id,null);
    assert.equal((await db.query('select user_id from public.agent_tool_runs where id=$1',[first])).rows[0].user_id,owner);
    console.log(JSON.stringify({status:'PASS',checks:['anon/authenticated execution denied','service-role gate creates owned execution','immediate duplicate is throttled'],transaction:'ROLLBACK; no fixture retained'}));
  }finally{await db.query('rollback');}
}).catch(e=>{console.error(JSON.stringify({status:'FAIL',code:e.code||e.name,message:e.message}));process.exitCode=1;});
