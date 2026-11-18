// HTTP-level Metro check, not an authenticated UI or device acceptance test.
const assert=require('node:assert/strict');
(async()=>{
  for(const origin of ['http://localhost:8081','http://127.0.0.1:8081','http://[::1]:8081']){
    let status;try{status=await fetch(origin+'/status',{signal:AbortSignal.timeout(10000)});}catch(error){if(origin.includes('[::1]')){console.log(JSON.stringify({origin,status:'BLOCKED',reason:'Expo --host localhost binds IPv4 only in the installed CLI. Canonical localhost and IPv4 checks are separate.'}));continue;}throw error;}
    assert.equal(status.status,200,'Metro status must be reachable');
    assert.match(await status.text(),/packager-status:running/);
    console.log(JSON.stringify({origin,stage:'Metro status',status:'PASS'}));
    const response=await fetch(origin+'/chat',{signal:AbortSignal.timeout(60000)});
    const html=await response.text();assert.equal(response.status,200,'Chat HTML must compile');
    const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&'));
    const entry=scripts.find(src=>src.includes('.bundle'));
    assert.ok(entry,'Development HTML must include a Metro entry bundle');
    const url=new URL(entry,origin);assert.equal(url.origin,origin,'Only fetch the local Metro bundle');
    const bundle=await fetch(url,{signal:AbortSignal.timeout(90000)});
    const content=await bundle.text();
    assert.equal(bundle.status,200,content.includes('expo-file-system')?'Metro failed to resolve expo-file-system':'Metro bundle compilation failed');
    assert.ok(content.length>1000,'The development bundle must contain compiled application code');
    const routes=['/feed','/ideas','/tasks','/settings','/tools','/auth/callback','/chat','/chat'];
    for(const route of routes){const page=await fetch(origin+route,{signal:AbortSignal.timeout(15000)});await page.body?.cancel();assert.equal(page.status,200,`${origin}${route} must survive repeated page requests`);}
    console.log(JSON.stringify({origin,status:'PASS',htmlStatus:response.status,bundleStatus:bundle.status,bundleBytes:Buffer.byteLength(content),repeatedRoutes:routes.length}));
  }
})().catch(error=>{console.error(JSON.stringify({status:'FAIL',name:error.name,message:error.message}));process.exitCode=1;});
