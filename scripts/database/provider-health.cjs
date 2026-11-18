const { withClient, readPublicConfig } = require('./connection.cjs');
withClient(async (client) => {
  const { url, publicKey } = readPublicConfig();
  const secret = (await client.query("select decrypted_secret from vault.decrypted_secrets where name='tars_scheduler_secret'")).rows[0]?.decrypted_secret;
  if (!secret) throw new Error('Scheduler authentication is not configured.');
  const response = await fetch(url+'/functions/v1/agent-run', { method:'POST',headers:{apikey:publicKey,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({diagnosticCase:process.argv.find(arg=>arg.startsWith('--case='))?.slice(7),mode:process.argv.includes('--diagnostics')?'provider_diagnostics':'provider_health',probe:process.argv.includes('--probe')||process.argv.includes('--stream-probe'),streamProbe:process.argv.includes('--stream-probe'),browserProbe:process.argv.includes('--browser-probe'),mapsProbe:process.argv.includes('--maps-probe'),ensureMapsConfig:process.argv.includes('--ensure-maps-config'),agentProbeUserId:process.argv.find(arg=>arg.startsWith('--agent-user='))?.slice(13),probeModel:process.argv.find(arg=>arg.startsWith('--model='))?.slice(8)}),signal:AbortSignal.timeout(115_000) });
  const data = await response.json();
  console.log(JSON.stringify({httpStatus:response.status,...data},null,2));
}).catch((error)=>{ console.error(JSON.stringify({status:'FAIL',code:error.code||error.name,message:'Provider health request failed.'}));process.exitCode=1; });
