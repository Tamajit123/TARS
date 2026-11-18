const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),test=require('node:test'),assert=require('node:assert/strict');
function load(globals={},name='openMaps'){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(`supabase/functions/_shared/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,Date,AbortSignal,Deno:{env:{get:n=>n==='MAPS_DEMO_MODE'?'true':undefined}},Response,...globals,require:id=>load(globals,id.slice(2,-3))});return exports;}
test('open maps retains actual road metrics and geometry, rejects unavailable routes and unsupported modes',async()=>{
  const urls=[],maps=load({fetch:async(url,init)=>{urls.push(String(url));assert.equal(init.redirect,'error');return new Response(JSON.stringify({code:'Ok',routes:[{distance:1234,duration:345,geometry:'_p~iF~ps|U_ulLnnqC_mqNvxq`@',legs:[{summary:'Real returned road'}]}]}));}});
  const route=await maps.computeOpenRoute('12.9,77.6','12.95,77.7');assert.equal(route.options[0].distanceMeters,1234);assert.equal(route.options[0].durationSeconds,345);assert.equal(route.source,'osrm');assert.equal(route.trafficAware,false);assert.match(urls[0],/77.6,12.9;77.7,12.95/);
  assert.throws(()=>maps.osrmRoute({code:'NoRoute'},'A','B'),/No driving route/);assert.throws(()=>maps.osrmRoute({code:'Ok',routes:[{distance:1,duration:1}]},'A','B'),/geometry/);await assert.rejects(maps.computeOpenRoute('A','B','WALK'),/driving only/);
});
test('place search projects actual valid coordinates; ambiguous addresses require a user choice',async()=>{
  const features=[{properties:{osm_id:1,name:'Silk Board',city:'Bengaluru'},geometry:{coordinates:[77.62,12.91]}},{properties:{osm_id:2,name:'Another Silk Board',city:'Other City'},geometry:{coordinates:[78,13]}}];
  const maps=load({fetch:async()=>new Response(JSON.stringify({features}))});
  assert.equal(maps.photonPlaces({features}).items.length,2);assert.equal(maps.photonPlaces({features:[{properties:{name:'Bad'},geometry:{coordinates:[999,999]}}]}).items.length,0);
  await assert.rejects(maps.computeOpenRoute('Silk Board','12,77'),/ambiguous/);assert.throws(()=>maps.coordinate('91,0'),/valid range/);
});
test('public demo use is explicit and provider throttling is reported honestly',async()=>{
  const disabled=load({Deno:{env:{get:()=>undefined}}});await assert.rejects(disabled.searchOpenPlaces('Bengaluru'),/PHOTON_BASE_URL/);
  const throttled=load({fetch:async()=>new Response('{}',{status:429})});await assert.rejects(throttled.searchOpenPlaces('Bengaluru'),/rate limit/);
});
