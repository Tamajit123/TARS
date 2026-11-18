// Read back only explicitly labelled release fixtures. No browser credentials,
// customer contents, mutations or external provider calls are involved.
const assert=require('node:assert/strict');
const {withClient}=require('./connection.cjs');
withClient(async db=>{
  await db.query('begin isolation level repeatable read read only');
  try{
    const thread='0442a492-3347-4e1e-a517-21ae66820c7d';
    const conversation=(await db.query('select user_id,title from public.chat_threads where id=$1',[thread])).rows[0];
    assert.ok(conversation);assert.match(conversation.title,/^Help me plan project Cedar/);
    const owner=conversation.user_id;
    const messages=(await db.query('select role,content,metadata,request_id from public.chat_messages where thread_id=$1 and user_id=$2',[thread,owner])).rows;
    assert.equal(messages.filter(m=>m.role==='assistant'&&m.content.includes('CEDAR-931')).length,2);
    const duplicateRequests=(await db.query("select request_id from public.chat_messages where thread_id=$1 and role='user' and request_id is not null group by request_id having count(*)>1",[thread])).rows;
    assert.equal(duplicateRequests.length,0);
    const attachments=(await db.query(`select a.name,a.message_id,o.id as stored_id,b.public
      from public.chat_attachments a left join storage.objects o on o.name=a.object_path and o.bucket_id='tars-chat'
      left join storage.buckets b on b.id=o.bucket_id where a.thread_id=$1 and a.user_id=$2`,[thread,owner])).rows;
    assert.equal(attachments.length,3);
    for(const file of attachments){assert.ok(file.message_id);assert.ok(file.stored_id);assert.equal(file.public,false);}
    const reminder=(await db.query("select status from public.task_reminders where user_id=$1 and title like 'TARS release reminder verification%' order by created_at desc limit 1",[owner])).rows[0];
    assert.equal(reminder?.status,'completed');
    assert.equal((await db.query("select id from public.ideas where user_id=$1 and title='TARS release verification'",[owner])).rowCount,1);
    const t11='8951a060-b880-4e55-80a4-6b61b390eceb';
    assert.equal((await db.query("select id from public.chat_threads where user_id=$1 and title='TARS integration verification — t11'",[t11])).rowCount,1);
    assert.equal((await db.query("select status from public.task_reminders where user_id=$1 and title='TARS t11 release verification — silent' order by created_at desc limit 1",[t11])).rows[0]?.status,'completed');
    const orphans=(await db.query(`select
      (select count(*)::int from public.chat_messages m left join public.chat_threads t on t.id=m.thread_id and t.user_id=m.user_id where t.id is null) as messages,
      (select count(*)::int from public.chat_attachments a left join public.chat_threads t on t.id=a.thread_id and t.user_id=a.user_id where t.id is null) as attachments`)).rows[0];
    assert.equal(orphans.messages,0);assert.equal(orphans.attachments,0);
    console.log(JSON.stringify({status:'PASS',checks:['t11 custom name persisted','two actual context-aware Cedar replies persisted','no duplicate user request rows','three uploads linked to messages and private storage objects','both accounts verification reminders completed','verification idea persisted','no orphan messages or attachments'],mutations:0}));
  }finally{await db.query('rollback');}
}).catch(error=>{console.error(JSON.stringify({status:'FAIL',code:error.code||error.name,message:error.message}));process.exitCode=1;});
