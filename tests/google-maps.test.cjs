const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),test=require('node:test'),assert=require('node:assert/strict');
function load(name,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(`supabase/functions/_shared/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,URLSearchParams,Date,AbortSignal,Deno:{env:{get:n=>n==='MAPS_PROVIDER'?'google':undefined}},...globals,require:id=>load(id.slice(2,-3),globals)});return exports;}
function database(){
  const updates=[];
  return {updates,from(){
    return {
      insert(){return {select(){return {single:async()=>({data:{id:'test-run'},error:null})};}};},
      update(value){updates.push(value);return {eq(){return this;},then(resolve){resolve({error:null});}};},
    };
  }};
}
test('Routes and Places projection uses only actual fields and bounded valid geometry',()=>{
  const maps=load('googleMaps'),pure=load('maps');
  assert.equal(maps.projectGoogleRoute({routes:[{distanceMeters:12}]},'A','B','DRIVE','now'),null);
  const route=maps.projectGoogleRoute({routes:[{distanceMeters:1200,duration:'123s',staticDuration:'100s',polyline:{encodedPolyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'}}]},'A','B','DRIVE','now');assert.equal(route.options[0].durationSeconds,123);assert.equal(route.trafficAware,true);
  const points=pure.decodeRoutePolyline(route.options[0].encodedPolyline);assert.equal(points.length,3);assert.equal(points[0].latitude,38.5);assert.equal(points[2].longitude,-126.453);assert.equal(pure.decodeRoutePolyline('broken!').length,0);
  const fallback=maps.projectGoogleRoute({routes:[{distanceMeters:1,duration:'1s'}],fallbackInfo:{}},'A','B','DRIVE','now');assert.equal(fallback.trafficAware,false);
  const places=maps.projectPlaces({places:[{id:'real',displayName:{text:'Actual place'},formattedAddress:'Actual address',location:{latitude:12.9,longitude:77.6},googleMapsUri:'https://www.google.com/maps/place/actual',access_token:'secret'},{id:'bad',displayName:{text:'Invalid'},location:{latitude:999,longitude:0}}]},'now');assert.equal(places.items.length,1);assert.doesNotMatch(JSON.stringify(places),/secret|access_token/);
});
test('direct Maps keeps keys in headers, records real completion and reports missing or denied setup honestly',async()=>{
  const key='server-only-test-key',db=database();let calls=0;
  const maps=load('googleMaps',{Deno:{env:{get:n=>n==='GOOGLE_MAPS_API_KEY'?key:n==='MAPS_PROVIDER'?'google':undefined}},fetch:async(url,init)=>{calls++;assert.equal(url,'https://routes.googleapis.com/directions/v2:computeRoutes');assert.equal(init.headers['X-Goog-Api-Key'],key);assert.doesNotMatch(url+init.body,/server-only-test-key/);assert.equal(JSON.parse(init.body).routingPreference,'TRAFFIC_AWARE');return new Response(JSON.stringify({routes:[{distanceMeters:1200,duration:'123s',polyline:{encodedPolyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'}}]}));}});
  const result=await maps.executeGoogleMaps(db,'owner','maps_compute_route',{origin:'Silk Board, Bengaluru',destination:'Marathahalli, Bengaluru'},'thread','request');assert.equal(result.ok,true);assert.equal(calls,1);assert.equal(db.updates.at(-1).status,'completed');assert.doesNotMatch(JSON.stringify(result),/server-only-test-key|encodedPolyline/);assert.doesNotMatch(JSON.stringify(db.updates),/server-only-test-key/);assert.ok(db.updates.at(-1).metadata.execution.result.route.options[0].encodedPolyline);
  const missingDb=database(),missing=await load('googleMaps').executeGoogleMaps(missingDb,'owner','maps_search_places',{query:'Bengaluru'});assert.equal(missing.ok,false);assert.match(missing.error,/GOOGLE_MAPS_API_KEY/);assert.equal(missingDb.updates.at(-1).status,'failed');
  const deniedDb=database(),denied=await load('googleMaps',{Deno:{env:{get:n=>n==='GOOGLE_MAPS_API_KEY'?key:n==='MAPS_PROVIDER'?'google':undefined}},fetch:async()=>new Response(JSON.stringify({error:key}),{status:403})}).executeGoogleMaps(deniedDb,'owner','maps_search_places',{query:'Bengaluru'});assert.equal(denied.ok,false);assert.match(denied.error,/billing/);assert.doesNotMatch(JSON.stringify(deniedDb.updates),/server-only-test-key/);
});
