const {withClient,readPublicConfig}=require('./connection.cjs');
const fs=require('node:fs');
withClient(async db=>{
  const {url,publicKey}=readPublicConfig();
  const secret=(await db.query("select decrypted_secret from vault.decrypted_secrets where name='tars_scheduler_secret'")).rows[0]?.decrypted_secret;
  if(!secret)throw new Error('Scheduler authentication is missing.');
  const response=await fetch(url+'/functions/v1/agent-run',{method:'POST',headers:{apikey:publicKey,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({mode:process.argv.includes('--classify')?'universal_health':'research_health',owner:process.argv.find(value=>value.startsWith('--owner='))?.slice(8),case:process.argv.find(value=>value.startsWith('--case='))?.slice(7)}),signal:AbortSignal.timeout(90000)});
  const result={httpStatus:response.status,...await response.json()};
  fs.writeFileSync(process.argv.includes('--classify')?'.database-audit/classification-20261118.json':'.database-audit/research-capabilities-20261118.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}).catch(e=>{console.error(JSON.stringify({status:'FAIL',code:e.code||e.name,message:'Research capability probe failed; credentials are not logged.'}));process.exitCode=1;});
