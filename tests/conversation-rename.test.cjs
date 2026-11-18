const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),test=require('node:test'),assert=require('node:assert/strict');
function load({configured=true,storage={},db}={}){
  const exports={};const asyncStorage={getItem:async key=>storage[key]||null,setItem:async(key,value)=>{storage[key]=value;}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/chatHistory.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:id=>id.includes('async-storage')?asyncStorage:{isSupabaseConfigured:configured,supabase:db},Date,Math,JSON});return exports;
}
test('conversation rename persists a normalized title locally without altering original messages',async()=>{
  const storage={'tars:local-chat:v1':JSON.stringify({threads:[{id:'one',title:'Original'}],messages:[{thread_id:'one',content:'Original conversation'}]})};const service=load({configured:false,storage});await service.RenameThread('one','  Project\n Cedar  ');const saved=JSON.parse(storage['tars:local-chat:v1']);assert.equal(saved.threads[0].title,'Project Cedar');assert.equal(saved.messages[0].content,'Original conversation');await assert.rejects(service.RenameThread('one',' '),/120/);await assert.rejects(service.RenameThread('missing','Name'),/not found/);
});
test('cloud rename requires the authenticated owner and acknowledged owned-row update',async()=>{
  const filters=[];let saved,deny=false;
  const db={auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})},from:()=>({update(value){saved=value;return this;},eq(key,value){filters.push([key,value]);return this;},select(){return this;},single:async()=>deny?{data:null,error:{code:'PGRST116'}}:{data:{id:'one'},error:null}})};
  const service=load({db});await service.RenameThread('one','New name');assert.deepEqual(filters,[['id','one'],['user_id','owner']]);assert.equal(saved.title,'New name');deny=true;await assert.rejects(service.RenameThread('foreign','Other'),/could not be renamed/);
});
test('later local messages preserve an explicit rename while a new conversation gets its first-query title',async()=>{
  const storage={};const service=load({configured:false,storage});const thread=await service.CreateNewThread('');
  await service.saveMessage('',thread.id,'user','First query');
  assert.equal(JSON.parse(storage['tars:local-chat:v1']).threads[0].title,'First query');
  await service.RenameThread(thread.id,'Custom name');await service.saveMessage('',thread.id,'user','Follow-up');
  assert.equal(JSON.parse(storage['tars:local-chat:v1']).threads[0].title,'Custom name');
});
