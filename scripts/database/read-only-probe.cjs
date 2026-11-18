// Explicit administrative test of the deployed, reviewed read-only pipeline.
// No sessions, user contents or secrets are copied from a browser.
const {withClient,readPublicConfig}=require('./connection.cjs');
const fs=require('node:fs');
withClient(async db=>{
  const {url,publicKey}=readPublicConfig();
  const secret=(await db.query("select decrypted_secret from vault.decrypted_secrets where name='tars_scheduler_secret'")).rows[0]?.decrypted_secret;
  const owner=process.argv.find(v=>v.startsWith('--owner='))?.slice(8);
  if(!secret||!owner)throw new Error('Pass --owner with the existing TARS owner ID.');
  const logId=process.argv.find(v=>v.startsWith('--log='))?.slice(6);
  const tools=logId?['log']:process.argv.includes('--maps')?['maps']:process.argv.includes('--extra')?['SLACK_LIST_ALL_CHANNELS','NOTION_SEARCH_NOTION_PAGE','INSTAGRAM_GET_USER_INFO']:['GITHUB_GET_THE_AUTHENTICATED_USER','GMAIL_LIST_LABELS','GOOGLECALENDAR_LIST_CALENDARS','REDDIT_GET_ME_PREFS','TWITTER_USER_LOOKUP_ME','TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER','JIRA_SEARCH_ISSUES'];
  const selected=process.argv.find(v=>v.startsWith('--tool='))?.slice(7);
  if(selected&&!tools.includes(selected))throw new Error('Choose a reviewed read-only tool from the selected probe group.');
  const results=[];
  for(const tool of selected?[selected]:tools){
    const response=await fetch(url+'/functions/v1/agent-run',{method:'POST',headers:{apikey:publicKey,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({mode:'read_only_diagnostic',owner,tool,logId,probe:logId?'log':tool==='maps'?'maps':undefined}),signal:AbortSignal.timeout(65000)});
    const result=await response.json();
    const row={tool,httpStatus:response.status,...result,status:result.ok?'PASS':result.needsConnection?'BLOCKED':'FAIL'};
    results.push(row);console.log(JSON.stringify(row));
  }
  const date=new Date().toISOString().slice(0,10).replaceAll('-','');
  fs.writeFileSync(`.database-audit/live-${logId?'log':process.argv.includes('--maps')?'maps':process.argv.includes('--extra')?'extra-reads':'reads'}${selected?'-'+selected.toLowerCase():''}-${date}.json`,JSON.stringify(results,null,2));
  if(results.some(r=>r.status!=='PASS'))process.exitCode=1;
}).catch(e=>{console.error(JSON.stringify({status:'FAIL',code:e.code||e.name,message:'Deployed read-only probe failed; no credentials logged.'}));process.exitCode=1;});
