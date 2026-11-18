const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {withClient}=require('./connection.cjs');
withClient(async db=>{
  await db.query('begin');
  try {
    if(process.argv.includes('--pending'))await db.query(fs.readFileSync('supabase/migrations/20261103193856_recents_feed_activity.sql','utf8'));
    const users=(await db.query('select id from auth.users order by created_at limit 2')).rows;
    const owner=users[0].id,other=users[1].id,request=crypto.randomUUID();
    const thread=(await db.query("insert into public.chat_threads(user_id,title) values($1,'New conversation') returning id",[owner])).rows[0].id;
    await db.query("insert into public.chat_messages(user_id,thread_id,role,content,request_id) values($1,$2,'user','Search Reddit for native motion',$3)",[owner,thread,request]);
    await db.query("insert into public.chat_messages(user_id,thread_id,role,content) values($1,$2,'user','Follow-up should not replace first title')",[owner,thread]);
    assert.equal((await db.query('select title from public.chat_threads where id=$1',[thread])).rows[0].title,'Search Reddit for native motion');
    await db.query("update public.chat_threads set title='Explicit release verification name' where id=$1",[thread]);
    await db.query("insert into public.chat_messages(user_id,thread_id,role,content) values($1,$2,'user','Follow-up after rename')",[owner,thread]);
    assert.equal((await db.query('select title from public.chat_threads where id=$1',[thread])).rows[0].title,'Explicit release verification name');
    await db.query("insert into public.ai_chat_requests(user_id,conversation_id,request_id) values($1,$2,$3)",[owner,thread,request]);
    for(const toolkit of ['reddit','twitter'])await db.query("insert into public.agent_tool_runs(user_id,action_name,status,input_summary,output_summary,metadata) values($1,'INTERNAL_TOOL','completed','raw args','Composio log must never become Feed',$2)",[owner,{toolkit,request_id:request,conversation_id:thread}]);
    await db.query("update public.ai_chat_requests set status='completed',response_text='Two actual matching discussions were returned.' where request_id=$1",[request]);
    let row=(await db.query('select activity from public.ai_chat_requests where request_id=$1',[request])).rows[0].activity;
    assert.equal(row.query,'Search Reddit for native motion');assert.equal(row.status,'completed');assert.equal(row.sources.length,2);assert.doesNotMatch(JSON.stringify(row),/INTERNAL_TOOL|raw args|Composio log/);
    await db.query("update public.ai_chat_requests set status='provider_failed',error_code='provider_cancelled' where request_id=$1",[request]);
    row=(await db.query('select activity from public.ai_chat_requests where request_id=$1',[request])).rows[0].activity;assert.equal(row.status,'cancelled');
    await db.query("update public.ai_chat_requests set error_code='provider_unavailable',status='provider_failed' where request_id=$1",[request]);
    row=(await db.query('select activity from public.ai_chat_requests where request_id=$1',[request])).rows[0].activity;assert.equal(row.status,'failed');assert.doesNotMatch(row.summary,/Two actual/);
    assert.equal((await db.query("select private.tars_activity('{\"debug\":1}','raw','completed',array['Web'],null) as activity")).rows[0].activity,null);
    await db.query("select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true)",[JSON.stringify({sub:other,role:'authenticated'}),other]);
    await db.query('set local role authenticated');assert.equal((await db.query('select activity from public.ai_chat_requests where user_id=$1',[owner])).rowCount,0);
    if((await db.query("select to_regprocedure('public.get_tars_recents()') is not null as present")).rows[0].present){
      assert.equal((await db.query('select id from public.get_tars_recents() where id=$1',[thread])).rowCount,0);
      await db.query('reset role');await db.query("select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true)",[JSON.stringify({sub:owner,role:'authenticated'}),owner]);await db.query('set local role authenticated');
      const recent=(await db.query('select title from public.get_tars_recents() where id=$1',[thread])).rows[0];assert.equal(recent.title,'Explicit release verification name');
    }
    await db.query('reset role');
    console.log(JSON.stringify({status:'PASS',checks:['first-query title retained','one activity per request across multiple tools','actual sources and final response','debug inputs excluded','cancelled and failed never successful','invalid JSON activity excluded','cross-user Feed denied'],transaction:'ROLLBACK; fixtures and pending migration not retained'}));
  } finally {await db.query('rollback');}
}).catch(e=>{console.error(JSON.stringify({status:'FAIL',code:e.code||e.name,message:e.message}));process.exitCode=1;});
