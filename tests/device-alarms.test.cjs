const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),test=require('node:test'),assert=require('node:assert/strict');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Set,Promise,require:id=>{assert.ok(id in imports,`Unexpected import ${id}`);return imports[id];}});return exports;}
const plan=load('src/lib/deviceAlarmPlan.ts');
test('bundled notification sounds satisfy Android resource rules and exist',()=>{
 const config=JSON.parse(fs.readFileSync('app.json','utf8')).expo;
 const notifications=config.plugins.find(plugin=>Array.isArray(plugin)&&plugin[0]==='expo-notifications');
 assert.ok(notifications?.[1]?.sounds?.length,'Custom alert sound must be bundled');
 for(const sound of notifications[1].sounds){assert.ok(fs.existsSync(sound),`Missing sound: ${sound}`);assert.match(require('node:path').basename(sound),/^[a-z][a-z0-9_]*\.(wav|mp3|ogg)$/,'Android raw resource names cannot contain hyphens');}
});
test('device alarms use the next local occurrence; timers start from an explicit clock',()=>{
 const now=new Date(2026,10,2,8,30,0);const next=plan.planDeviceAlarm({kind:'alarm',title:' Wake up ',time:'07:00'},now);assert.equal(new Date(next.dueAt).getDate(),3);assert.equal(new Date(next.dueAt).getHours(),7);assert.equal(next.title,'Wake up');
 assert.equal(Date.parse(plan.planDeviceAlarm({kind:'timer',title:'Tea',durationSeconds:6},now).dueAt)-now.getTime(),6000);
 for(const draft of [{kind:'alarm',title:'x',time:'25:00'},{kind:'timer',title:'x',durationSeconds:0},{kind:'timer',title:'x',durationSeconds:0.5},{kind:'timer',title:'',durationSeconds:5}])assert.throws(()=>plan.planDeviceAlarm(draft,now));
});
test('elapsed means time reached; missing repeating notifications are not shown as scheduled',()=>{
 const alarm={notificationId:'id',dueAt:'2020-01-01T00:00:00Z',state:'scheduled',repeatDaily:false};assert.equal(plan.deviceAlarmState(alarm,new Set()),'elapsed');assert.equal(plan.deviceAlarmState({...alarm,repeatDaily:true},new Set()),'unavailable');assert.equal(plan.deviceAlarmState(alarm,new Set(['id'])),'scheduled');
});
function harness(options={}){
 const store=new Map(),pending=new Map();let id=0,scheduled=0,cancelled=0,exactRequests=0;
 const notification={AndroidImportance:{MAX:7,DEFAULT:5},AndroidAudioUsage:{ALARM:4},AndroidAudioContentType:{SONIFICATION:4},IosAuthorizationStatus:{AUTHORIZED:2},AndroidNotificationPriority:{MAX:'max'},SchedulableTriggerInputTypes:{DAILY:'daily',DATE:'date'},setNotificationHandler(){},
 setNotificationChannelAsync:async()=>{},getNotificationChannelAsync:async()=>({sound:'custom',importance:7}),getPermissionsAsync:async()=>({granted:!options.denied,canAskAgain:false,ios:{status:2,allowsSound:true}}),getExactAlarmPermissionsAsync:async()=>({granted:!options.exactDenied,canAskAgain:false}),requestExactAlarmPermissionsAsync:async()=>{exactRequests++;return {granted:false};},getAllScheduledNotificationsAsync:async()=>[...pending.values()],scheduleNotificationAsync:async request=>{scheduled++;pending.set(request.identifier,request);return request.identifier;},cancelScheduledNotificationAsync:async identifier=>{cancelled++;pending.delete(identifier);},dismissNotificationAsync:async()=>{}};
 const service=load('src/services/deviceAlarms.ts',{'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async key=>store.get(key)||null,setItem:async(key,value)=>{if(options.storageFails)throw new Error('Storage unavailable');store.set(key,value);}}},'expo-notifications':notification,'expo-crypto':{randomUUID:()=>`uuid-${++id}`},'react-native':{Platform:{OS:options.os||'android'}},'@/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:options.owner||'owner'}}}})}}},'@/lib/deviceAlarmPlan':plan});
 return {service,store,pending,counts:()=>({scheduled,cancelled,exactRequests})};
}
test('device alerts persist only after OS acceptance and cancel the exact owned identifier',async()=>{
 const h=harness();const alarm=await h.service.createDeviceAlarm({kind:'timer',title:'Tea',durationSeconds:60});assert.equal(h.pending.get(alarm.notificationId).trigger.delivery,'alarmClock');assert.equal(h.pending.get(alarm.notificationId).content.sound,'tars_alert.wav');assert.equal((await h.service.listDeviceAlarms())[0].state,'scheduled');await h.service.cancelDeviceAlarm(alarm.id);assert.equal(h.pending.size,0);assert.equal((await h.service.listDeviceAlarms())[0].state,'cancelled');
 await assert.rejects(h.service.cancelDeviceAlarm('another-owner-id'));assert.equal(h.counts().cancelled,1);
});
test('permission denial and missing exact alarm access never create a false scheduled alert',async()=>{
 for(const options of [{denied:true},{exactDenied:true},{os:'web'}]){const h=harness(options);await assert.rejects(h.service.createDeviceAlarm({kind:'timer',title:'Tea',durationSeconds:60}));assert.equal(h.counts().scheduled,0);assert.equal(h.store.size,0);}
});
test('storage failure rolls back the device notification; parallel saves retain both records',async()=>{
 const broken=harness({storageFails:true});await assert.rejects(broken.service.createDeviceAlarm({kind:'timer',title:'Tea',durationSeconds:60}));assert.equal(broken.pending.size,0);assert.equal(broken.counts().cancelled,1);
 const h=harness();await Promise.all([h.service.createDeviceAlarm({kind:'timer',title:'One',durationSeconds:60}),h.service.createDeviceAlarm({kind:'timer',title:'Two',durationSeconds:120})]);assert.equal((await h.service.listDeviceAlarms()).length,2);assert.equal(h.pending.size,2);
});
test('sign-out cancels only alerts belonging to the current device account',async()=>{
 const h=harness();await h.service.createDeviceAlarm({kind:'timer',title:'Tea',durationSeconds:60});h.pending.set('another-app',{identifier:'another-app'});await h.service.cancelOwnedDeviceAlarms();assert.ok(h.pending.has('another-app'));assert.equal(h.pending.size,1);
});
