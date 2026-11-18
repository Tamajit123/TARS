const {withClient}=require('./connection.cjs');
withClient(async client=>{
const requests=await client.query("select request_id,status,error_code,created_at from public.ai_chat_requests where user_id=$1 order by created_at desc limit 3",['8951a060-b880-4e55-80a4-6b61b390eceb']);
const runs=await client.query("select action_name,status,error_message,metadata->>'logId' as log_id, created_at from public.agent_tool_runs where user_id=$1 order by created_at desc limit 6",['8951a060-b880-4e55-80a4-6b61b390eceb']);
console.log(JSON.stringify({requests:requests.rows,runs:runs.rows}));
}).catch(e=>{console.error(e.code||e.name);process.exitCode=1;});
