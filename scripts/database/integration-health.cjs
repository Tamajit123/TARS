const fs = require('node:fs');
const config = require('node:util').parseEnv(fs.readFileSync('.env', 'utf8'));
(async()=>{
  if(config.COMPOSIO_API_KEY){
    const response=await fetch('https://backend.composio.dev/api/v3.1/auth_configs?limit=100',{headers:{'x-api-key':config.COMPOSIO_API_KEY},signal:AbortSignal.timeout(20_000)});
    const data=await response.json();
    const items=data.items||[];
    console.log(JSON.stringify({provider:'composio',httpStatus:response.status,authConfigs:items.map(item=>({id:item.id,toolkit:item.toolkit?.slug,enabled:item.is_enabled,managed:item.is_composio_managed}))}));
  }
  if(config.BROWSERBASE_API_KEY){
    const response=await fetch('https://api.browserbase.com/v1/projects',{headers:{'x-bb-api-key':config.BROWSERBASE_API_KEY},signal:AbortSignal.timeout(20_000)});
    const data=await response.json();
    console.log(JSON.stringify({provider:'browserbase',httpStatus:response.status,projectsCount:Array.isArray(data)?data.length:undefined}));
  }
})().catch(error=>{console.error(JSON.stringify({status:'FAIL',code:error.code||error.name,message:'Provider metadata request failed.'}));process.exitCode=1;});
