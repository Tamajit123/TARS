const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(name){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('supabase/functions/_shared/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,URLSearchParams});return exports;}
const rich=load('richResponse');
const source={id:'src1',title:'Official pricing',url:'https://example.com/price',provider:'browserbase_fetch',kind:'page',retrievedAt:'2026-11-18T00:00:00Z',excerpt:'Economy one-way fare INR 7640. Return fare INR 13282. Depart 06:00. Travel date 29 November 2026. Listed only.'};
const response=()=>({intent:'flights',status:'completed',title:'Cheapest flight',summary:'A listed fare was found; check availability.',limitations:[],blocks:[{type:'flight_list',items:[{title:'Flight option',sourceId:'src1',price:{value:'INR 7640',basis:'listed',quote:'Economy one-way fare INR 7640.'},fields:[{label:'Date',value:'29 November 2026',quote:'Travel date 29 November 2026.',sourceId:'src1'},{label:'Trip',value:'one-way',quote:'Economy one-way fare INR 7640.',sourceId:'src1'}]}]}]});
test('rich responses preserve actual source provenance and never certify cheapest/live availability',()=>{
 const value=rich.groundResponse(response(),[source]);assert.equal(value.title,'Flight options to check');assert.equal(value.blocks[0].items[0].actionLabel,'Check listed price');assert.equal(value.sources[0].url,source.url);assert.ok(rich.readRichResponse(value));
});
test('invented prices, source identifiers, images and bookable price claims fail validation',()=>{
 for(const mutate of [v=>v.blocks[0].items[0].price.value='INR 100',v=>v.blocks[0].items[0].sourceId='fake',v=>v.blocks[0].items[0].image='https://example.com/invented.jpg',v=>v.blocks[0].items[0].price.basis='bookable',v=>v.blocks[0].items[0].fields[0].quote='Return flight available now']){
   const value=response();mutate(value);assert.throws(()=>rich.groundResponse(value,[source]));
 }
});
test('source URLs reject credentials, local addresses, insecure protocols and secret query parameters',()=>{
 for(const url of ['http://example.com','https://127.0.0.1','https://localhost','https://example.internal','https://a:b@example.com','https://example.com:8443','https://example.com/?api_key=secret','javascript:alert(1)'])assert.equal(rich.safeResultUrl(url),null,url);
 assert.equal(rich.safeResultUrl('https://example.com/Price?q=flight'),'https://example.com/Price?q=flight');
});
test('unsupported schema versions, excessive result payloads and forged route geometry are rejected',()=>{
 const value=rich.groundResponse(response(),[source]);assert.equal(rich.readRichResponse({...value,version:2}),null);assert.equal(rich.readRichResponse({...value,blocks:[{type:'map',route:{origin:'A',destination:'B',options:[{distanceMeters:-1,durationSeconds:12}]}}]}),null);assert.equal(rich.readRichResponse({...value,summary:'x'.repeat(20001)}),null);
});
test('robots wildcard groups, consecutive agents, longest rules and allow ties are respected',()=>{
 const {robotsAllows}=load('robotsPolicy');assert.equal(robotsAllows('User-agent: *\nUser-agent: other\nDisallow: /private','/private/a'),false);assert.equal(robotsAllows('User-agent: *\nDisallow: /\nAllow: /public','/public/a'),true);assert.equal(robotsAllows('User-agent: *\nDisallow: /*?secret=*$','/path?secret=1'),false);assert.equal(robotsAllows('User-agent: other\nDisallow: /','/'),true);
});
