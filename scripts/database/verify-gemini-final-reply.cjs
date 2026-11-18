// Read-only evidence for the two actual localhost UI tests. No model call,
// browser token extraction, credentials or private reply text is logged.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {withClient}=require('./connection.cjs');
withClient(async db=>{
  await db.query('begin isolation level repeatable read read only');
  try{
    const owner='8951a060-b880-4e55-80a4-6b61b390eceb',thread='424374ea-fe96-4008-b23e-13220f40f159';
    const messages=(await db.query('select role,content,request_id,metadata from public.chat_messages where user_id=$1 and thread_id=$2 order by created_at,id',[owner,thread])).rows;
    const replies=messages.filter(row=>row.role==='assistant');assert.equal(replies.length,2);
    assert.match(replies[0].content,/no Trello boards/i);
    for(const label of ['Reddit','Trello','Jira'])assert.ok(replies[1].content.includes(label));
    assert.match(replies[1].content,/429|rate.limit|too many requests/i);
    const evidence=[];
    for(const reply of replies){
      assert.equal(reply.metadata.provider,'gemini');assert.equal(reply.metadata.model,'gemini-3.5-flash-lite');
      assert.ok(reply.metadata.timings.firstTextMs>0);assert.ok(reply.metadata.timings.totalMs<135000);
      assert.equal(messages.filter(row=>row.role==='user'&&row.request_id===reply.request_id).length,1);
      const request=(await db.query('select status,error_code from public.ai_chat_requests where user_id=$1 and conversation_id=$2 and request_id=$3',[owner,thread,reply.request_id])).rows[0];
      assert.equal(request?.status,'completed');assert.equal(request.error_code,null);
      const runs=(await db.query("select action_name,status,metadata->>'toolkit' as toolkit,metadata->>'logId' as log_id from public.agent_tool_runs where user_id=$1 and metadata->>'conversation_id'=$2 and metadata->>'request_id'=$3 order by created_at",[owner,thread,reply.request_id])).rows;
      assert.ok(runs.length>0);for(const run of runs)assert.ok(run.log_id);
      if(evidence.length===0){assert.equal(runs.length,1);assert.equal(runs[0].toolkit,'trello');assert.equal(runs[0].status,'completed');}
      else{for(const toolkit of ['reddit','twitter','trello','jira'])assert.ok(runs.some(run=>run.toolkit===toolkit));for(const toolkit of ['twitter','trello','jira'])assert.ok(runs.some(run=>run.toolkit===toolkit&&run.status==='completed'));}
      evidence.push({requestId:reply.request_id,status:request.status,model:reply.metadata.model,responseCharacters:reply.content.length,timings:reply.metadata.timings,runs});
    }
    const result={status:'PASS',thread,checks:['two real Gemini final replies persisted after actual tool calls','single Trello and four-provider synthesis','provider error explained instead of invented data','same configured Gemini model','no duplicate user messages from retry','stream first-text and total timing recorded'],evidence,mutations:0};
    fs.writeFileSync('.database-audit/gemini-final-replies-20261117.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{await db.query('rollback');}
}).catch(error=>{console.error(JSON.stringify({status:'FAIL',code:error.code||error.name,message:error.message}));process.exitCode=1;});
