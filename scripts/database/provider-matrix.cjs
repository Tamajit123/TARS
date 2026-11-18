const {withClient,readPublicConfig}=require('./connection.cjs');
const fs=require('node:fs');
withClient(async db=>{
  const {url,publicKey}=readPublicConfig();const secret=(await db.query("select decrypted_secret from vault.decrypted_secrets where name='tars_scheduler_secret'")).rows[0]?.decrypted_secret;
  if(!secret)throw new Error('Scheduler authentication missing.');
  const rows=[];
  for(const name of ['text','stream','multi_turn','long','structured','function_call']){
    const response=await fetch(url+'/functions/v1/agent-run',{method:'POST',headers:{apikey:publicKey,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({mode:'provider_diagnostics',diagnosticCase:name}),signal:AbortSignal.timeout(80000)});
    const data=await response.json();const result=data.diagnostics?.gemini?.find(r=>r.name===name);
    const row={name,model:data.diagnostics?.model,httpStatus:response.status,...result,status:result?.httpStatus===200&&result?.contentValid?'PASS':'FAIL'};rows.push(row);console.log(JSON.stringify(row));
    fs.writeFileSync('.database-audit/gemini-matrix-20261116.json',JSON.stringify(rows,null,2));
  }
  if(rows.some(r=>r.status!=='PASS'))process.exitCode=1;
}).catch(e=>{console.error(JSON.stringify({status:'FAIL',code:e.code||e.name,message:'Provider matrix did not finish; partial redacted results retained.'}));process.exitCode=1;});
