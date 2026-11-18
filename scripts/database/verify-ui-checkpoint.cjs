// Read-only evidence for the synthetic conversation exercised in Chrome.
// Does not call Gemini, extract a browser session, or print message contents.
const assert=require('node:assert/strict');
const {withClient}=require('./connection.cjs');
withClient(async db=>{
  const owner='8951a060-b880-4e55-80a4-6b61b390eceb';
  const thread='3281fff1-6cfd-4272-b303-0ef9e8d1a4fe';
  await db.query('begin isolation level repeatable read read only');
  try {
    const conversation=(await db.query('select title from public.chat_threads where id=$1 and user_id=$2',[thread,owner])).rows[0];
    assert.ok(conversation);assert.match(conversation.title,/^Help me plan project Cedar/);
    const messages=(await db.query('select role,content,metadata,request_id from public.chat_messages where thread_id=$1 and user_id=$2 order by created_at',[thread,owner])).rows;
    assert.equal(messages.filter(m=>m.role==='assistant'&&m.content.includes('CEDAR-931')).length,2);
    assert.equal(messages.filter(m=>m.role==='user'&&m.content.startsWith('Run four read-only checks')).length,1,'Retry must not duplicate the user message');
    const mediaMessage=messages.find(m=>m.role==='user'&&m.content.startsWith('From the three uploaded files only'));
    assert.ok(mediaMessage);assert.equal(mediaMessage.metadata.attachmentIds.length,3);
    const attachments=(await db.query(`select a.name,a.message_id,o.id as stored_id,b.public
      from public.chat_attachments a left join storage.objects o on o.name=a.object_path and o.bucket_id='tars-chat'
      left join storage.buckets b on b.id=o.bucket_id where a.thread_id=$1 and a.user_id=$2`,[thread,owner])).rows;
    assert.deepEqual(attachments.map(a=>a.name).sort(),['notes-test.docx','receipt-test.png','voice-test.wav']);
    for(const a of attachments){assert.ok(a.message_id);assert.ok(a.stored_id);assert.equal(a.public,false);}
    const requests=(await db.query('select request_id,status,error_code,activity from public.ai_chat_requests where conversation_id=$1 and user_id=$2 order by created_at',[thread,owner])).rows;
    assert.equal(requests.filter(r=>r.status==='completed').length,2);
    const blocked=requests.filter(r=>r.error_code==='provider_rate_limited');assert.equal(blocked.length,2);
    for(const r of blocked){assert.equal(r.activity.status,'failed');assert.deepEqual(r.activity.sources,['TARS']);}
    console.log(JSON.stringify({status:'PASS',thread,checks:['first-query title retained','two real context-aware replies persisted','retry did not duplicate user message','three mixed attachments linked to message and private objects','quota-blocked requests recorded as failures'],requests:requests.map(({request_id,status,error_code})=>({request_id,status,error_code})),mutations:0}));
  }finally{await db.query('rollback');}
}).catch(error=>{console.error(JSON.stringify({status:'FAIL',code:error.code||error.name,message:error.message}));process.exitCode=1;});
