const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function harness({os='ios',saveFails=false}={}){
  let inserts=0,notificationReads=0;
  const row={id:'saved-reminder',revision:1,user_id:'owner'};
  const compile=(file,imports)=>{
    const exports={};
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(code,{exports,Date,Intl,Promise,Set,require:id=>{assert.ok(id in imports,`Unexpected import ${id}`);return imports[id];}});
    return exports;
  };
  const plan=compile('supabase/functions/_shared/reminderPlan.ts',{});
  const db={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from:()=>{
    const query={select:()=>query,eq:()=>query,insert:values=>{inserts++;Object.assign(row,values);return query;},single:async()=>({data:saveFails?null:row,error:saveFails?{code:'save-failed'}:null}),then:resolve=>Promise.resolve({data:[row],error:null}).then(resolve)};
    return query;
  }};
  const api=compile('src/services/reminders.ts',{
    'expo-notifications':{getAllScheduledNotificationsAsync:async()=>{notificationReads++;throw new Error('Device notification service unavailable');}},
    'expo-crypto':{randomUUID:()=> 'device'},
    '@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async()=> 'device'}},
    'react-native':{Platform:{OS:os}},'@/lib/supabase':{supabase:db},
    '../../supabase/functions/_shared/reminderPlan':plan,
  });
  return {api,counts:()=>({inserts,notificationReads})};
}
const draft=()=>({title:'Synthetic reminder',dueAt:new Date(Date.now()+3600000).toISOString(),repeat:'once',timezone:'Asia/Kolkata',sound:false});
test('successful reminder save survives device-sync failure without inviting another insert',async()=>{
  const h=harness();const result=await h.api.saveAndSyncReminder(draft());
  assert.equal(result.reminder.id,'saved-reminder');assert.equal(result.scheduled,0);
  assert.match(result.errors[0],/Saved in your account/);assert.match(result.errors[0],/could not be verified/);
  assert.equal(h.counts().inserts,1);assert.equal(h.counts().notificationReads,1);
});
test('failed account save never starts notification sync; web never claims a device alert',async()=>{
  const failed=harness({saveFails:true});await assert.rejects(failed.api.saveAndSyncReminder(draft()),/could not save/);
  assert.equal(failed.counts().notificationReads,0);
  const web=harness({os:'web'});const result=await web.api.saveAndSyncReminder(draft());
  assert.equal(result.scheduled,0);assert.match(result.errors[0],/installed iPhone or Android/);assert.equal(web.counts().notificationReads,0);
});
