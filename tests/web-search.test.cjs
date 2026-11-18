const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),test=require('node:test'),assert=require('node:assert/strict');
function load(env,fetch){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('supabase/functions/_shared/webSearch.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,AbortSignal,Date,Deno:{env:{get:n=>env[n]}},fetch});return exports;}
test('API research deduplicates actual sources without creating browser sessions or exposing keys',async()=>{
  const search=load({WEB_SEARCH_PROVIDER:'brave',BRAVE_SEARCH_API_KEY:'test-server-key'},async(url,init)=>{assert.equal(init.headers['X-Subscription-Token'],'test-server-key');assert.doesNotMatch(String(url),/test-server-key/);assert.equal(init.redirect,'error');return new Response(JSON.stringify({web:{results:[{title:'Actual source',url:'https://example.com/#section',description:'Actual returned description'},{title:'Duplicate',url:'https://example.com/'},{title:'Unsafe',url:'http://127.0.0.1/'}]}}));});
  const result=await search.searchAPI('Example');assert.equal(result.links.length,1);assert.match(result.text,/Actual returned description/);assert.equal(result.previewExpiresAt,undefined);assert.doesNotMatch(JSON.stringify(result),/test-server-key/);
});
test('search provider errors and missing configuration do not silently fall back to a browser',async()=>{
  const missing=load({WEB_SEARCH_PROVIDER:'searxng'},()=>{throw new Error('Must not fetch');});await assert.rejects(missing.searchAPI('Example'),/SEARXNG_BASE_URL/);
  const denied=load({WEB_SEARCH_PROVIDER:'searxng',SEARXNG_BASE_URL:'https://search.example.org/'},async()=>new Response('{}',{status:403}));await assert.rejects(denied.searchAPI('Example'),/HTTP 403/);
  const empty=load({WEB_SEARCH_PROVIDER:'searxng',SEARXNG_BASE_URL:'https://search.example.org/'},async()=>new Response('{}'));await assert.rejects(empty.searchAPI('Example'),/verified results array/);
});
