const fs=require('node:fs'),assert=require('node:assert/strict');
const {withClient}=require('./connection.cjs');
withClient(async db=>{
  await db.query('begin');
  try{
    if(process.argv.includes('--pending'))await db.query(fs.readFileSync('supabase/migrations/20261103202127_activity_failures_and_atomic_snooze.sql','utf8'));
    const [owner,other]=(await db.query('select id from auth.users order by created_at limit 2')).rows.map(row=>row.id);
    const asOwner=async id=>{await db.query('reset role');await db.query("select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true)",[JSON.stringify({sub:id,role:'authenticated'}),id]);await db.query('set local role authenticated');};
    await asOwner(owner);
    for(const repeat of ['once','daily']){
      const parent=(await db.query("insert into public.task_reminders(user_id,title,due_at,repeat,timezone,sound) values($1,'Rollback snooze check',now()+interval '1 hour',$2,'Asia/Kolkata',false) returning id,revision",[owner,repeat])).rows[0];
      const call=async revision=>(await db.query('select public.snooze_tars_reminder($1,$2) as id',[parent.id,revision])).rows[0].id;
      const child=await call(1);assert.equal(await call(1),child);
      assert.equal((await db.query('select id from public.task_reminders where source_reminder_id=$1',[parent.id])).rowCount,1);
      const updated=(await db.query('select status,revision from public.task_reminders where id=$1',[parent.id])).rows[0];assert.equal(updated.status,repeat==='once'?'completed':'active');assert.equal(updated.revision,2);
      await db.query('savepoint stale');let error;try{await call(99);}catch(e){error=e;}await db.query('rollback to savepoint stale');assert.equal(error?.code,'40001');assert.equal((await db.query('select revision from public.task_reminders where id=$1',[parent.id])).rows[0].revision,2);
      await asOwner(other);await db.query('savepoint foreign_owner');error=undefined;try{await call(1);}catch(e){error=e;}await db.query('rollback to savepoint foreign_owner');assert.equal(error?.code,'42501');await asOwner(owner);
    }
    await db.query('reset role');
    const activity=(await db.query("select private.tars_activity('Summarize my calendar',null,'failed','{}',null) as value")).rows[0].value;assert.equal(activity.status,'failed');assert.deepEqual(activity.sources,['TARS']);
    console.log(JSON.stringify({status:'PASS',checks:['one-shot atomic snooze','recurring parent retained','retry returns the same child','one child per parent revision','stale revision leaves original unchanged','foreign owner denied','pre-tool failures attributed to TARS'],transaction:'ROLLBACK; no reminders retained or notifications scheduled'}));
  }finally{await db.query('rollback');}
}).catch(e=>{console.error(JSON.stringify({status:'FAIL',code:e.code||e.name,message:e.message}));process.exitCode=1;});
