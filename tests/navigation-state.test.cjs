const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function harness(){
  const store=new Map(),records=new Map(),requests=[];let networkFailure=false;
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/navigationState.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{
    if(name==='@react-native-async-storage/async-storage')return {__esModule:true,default:{getItem:async key=>store.get(key)||null,setItem:async(key,value)=>{store.set(key,value);},removeItem:async key=>{store.delete(key);}}};
    if(name==='@/lib/supabase')return {supabase:{from:table=>{assert.equal(table,'chat_threads');const filters={};return {select(){return this;},eq(key,value){filters[key]=value;return this;},async maybeSingle(){requests.push(filters);return {data:records.get(filters.id)===filters.user_id?{id:filters.id}:null,error:networkFailure?new Error('offline'):null};}};}}};
    throw new Error(name);
  }});
  return {api:exports,store,records,requests,fail:()=>{networkFailure=true;}};
}
const id='8951a060-b880-4e55-80a4-6b61b390eceb';
test('last tab and conversation are separate, user-scoped and limited to product routes',async()=>{
  const h=harness();await h.api.rememberScreen('one','/tasks');await h.api.rememberScreen('two','/tools');
  await h.api.rememberScreen('one','/auth/callback');assert.equal(await h.api.restoreDestination('one'),'/(tabs)/tasks');assert.equal(await h.api.restoreDestination('two'),'/tools');
  await h.api.rememberScreen('one','/chat');await h.api.rememberConversation('one',id);h.records.set(id,'one');
  assert.equal((await h.api.restoreDestination('one')).params.thread_id,id);
  assert.equal((await h.api.restoreDestination('two')),'/tools');assert.equal(h.requests[0].user_id,'one');
});
test('missing, foreign, invalid and failed conversation restores fall back clean without deleting cloud data',async()=>{
  const h=harness();await h.api.rememberScreen('one','/chat');await h.api.rememberConversation('one',id);h.records.set(id,'two');
  assert.equal((await h.api.restoreDestination('one')).params.clean,'1');assert.equal(h.records.get(id),'two');
  h.records.set(id,'one');await h.api.rememberConversation('one',id);h.fail();assert.equal((await h.api.restoreDestination('one')).params.clean,'1');
  h.store.set('tars:last-tab:v1:one','constructor');assert.equal((await h.api.restoreDestination('one')).params.clean,'1');
  await h.api.rememberConversation('one',id);await h.api.forgetConversation('one');assert.equal(h.records.size,1);assert.equal((await h.api.restoreDestination('one')).params.clean,'1');
});
