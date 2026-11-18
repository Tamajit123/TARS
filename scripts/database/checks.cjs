const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { identifier } = require('./connection.cjs');

async function checkDatabase(client) {
  const passed = [];
  const permissionsOnly = process.argv.includes('--permissions-only');
  const before = permissionsOnly ? { rows: [] } : JSON.parse(fs.readFileSync(process.env.TARS_BASELINE_FILE || '.database-audit/before.json', 'utf8'));
  for (const original of before.rows) {
    const sql = `select count(*)::int as count,md5(coalesce(string_agg(row_hash,'' order by row_hash),'')) as fingerprint from (select md5(to_jsonb(original)::text) as row_hash from (select ${original.columns.map(identifier).join(',')} from public.${identifier(original.table)}) original) hashed`;
    const current = (await client.query(sql)).rows[0];
    assert.equal(current.count, original.count, `${original.table}: original row count changed`);
    assert.equal(current.fingerprint, original.fingerprint, `${original.table}: original values changed`);
  }
  if (!permissionsOnly) passed.push('original table rows and values preserved');
  const users = (await client.query('select id from auth.users order by created_at limit 2')).rows.map((r) => r.id);
  assert.equal(users.length, 2, 'Two existing identities are needed for isolation checks.');
  const [owner, other] = users;
  const asRole = async (role, sub = '') => {
    await client.query('reset role');
    await client.query("select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true)", [JSON.stringify({ sub, role }), sub]);
    await client.query(`set local role ${identifier(role)}`);
  };
  const fails = async (sql, params, code) => {
    await client.query('savepoint denied_operation');
    let thrown;
    try { await client.query(sql, params); } catch (error) { thrown = error; }
    await client.query('rollback to savepoint denied_operation');
    await client.query('release savepoint denied_operation');
    assert.equal(thrown?.code, code, `Expected PostgreSQL ${code}`);
  };
  await asRole('authenticated', owner);
  assert.equal((await client.query('select id,name,avatar_path,theme_preference,preferences from public.profiles where id=$1', [owner])).rowCount, 1);
  assert.equal((await client.query('select id from public.profiles where id=$1', [other])).rowCount, 0);
  passed.push('profile retrieval and owner isolation');
  await client.query("update public.profiles set name='Rollback profile check',preferences=coalesce(preferences,'{}'::jsonb)||jsonb_build_object('assistant_instructions','Rollback preferences check') where id=$1", [owner]);
  const profile = (await client.query('select name,preferences from public.profiles where id=$1', [owner])).rows[0];
  assert.equal(profile.name, 'Rollback profile check');
  assert.equal(profile.preferences.assistant_instructions, 'Rollback preferences check');
  const idea = (await client.query("insert into public.ideas(user_id,title,description) values($1,'Rollback keyboard form check','Multiline\nidea details') returning id", [owner])).rows[0];
  assert.equal((await client.query('select description from public.ideas where id=$1', [idea.id])).rows[0].description, 'Multiline\nidea details');
  passed.push('profile name/preferences and multiline idea writes/readback (transaction rolled back)');

  const side = (await client.query("insert into public.chat_threads(user_id,type,title) values($1,'side','Temporary side chat') returning id", [owner])).rows[0].id;
  const second = (await client.query("insert into public.chat_threads(user_id,type,title) values($1,'side','Second rollback conversation') returning id", [owner])).rows[0].id;
  assert.notEqual(side,second);
  const message = (await client.query("insert into public.chat_messages(user_id,thread_id,role,content,request_id) values($1,$2,'user','Rollback persistence check',$3) returning id", [owner, side, crypto.randomUUID()])).rows[0].id;
  assert.equal((await client.query('select id from public.chat_messages where id=$1 and thread_id=$2', [message, side])).rowCount, 1);
  passed.push('independent Recents conversations and message persistence');
  const task = (await client.query("insert into public.scheduled_agent_tasks(user_id,title,original_prompt,schedule_rule,timezone,next_run_at) values($1,'Rollback task','A test prompt',$2,'Asia/Kolkata',now()) returning id,next_run_at", [owner, { frequency: 'daily', time: '08:00' }])).rows[0];
  assert.ok(new Date(task.next_run_at) > new Date());
  await client.query("update public.scheduled_agent_tasks set status='paused' where id=$1", [task.id]);
  await client.query("update public.scheduled_agent_tasks set status='active' where id=$1", [task.id]);
  await fails("update public.scheduled_agent_tasks set last_run_status='completed' where id=$1", [task.id], '42501');
  await fails("insert into public.user_tool_connections(user_id,tool_id,status) values($1,'gmail','connected')", [owner], '42501');
  await fails("insert into public.agent_tool_runs(user_id,action_name,status) values($1,'fake','completed')", [owner], '42501');
  await fails('select public.claim_tars_agent_runs()', [], '42501');
  passed.push('task creation/pause/resume; client cannot forge connections, executions, or server state');

  await asRole('authenticated', other);
  for (const table of ['chat_threads', 'chat_messages', 'scheduled_agent_tasks']) {
    assert.equal((await client.query(`select id from public.${identifier(table)} where user_id=$1`, [owner])).rowCount, 0);
  }
  assert.equal((await client.query('delete from public.chat_threads where id=$1 returning id', [side])).rowCount, 0);
  await fails("insert into public.chat_threads(user_id,type) values($1,'side')", [owner], '42501');
  const otherThread = (await client.query("insert into public.chat_threads(user_id,type) values($1,'side') returning id", [other])).rows[0].id;
  await asRole('authenticated', owner);
  await fails("insert into public.chat_messages(user_id,thread_id,role,content) values($1,$2,'user','Wrong owner')", [owner, otherThread], '23503');
  passed.push('cross-user reads, deletes, writes, and cross-owner message relationships denied');
  await asRole('anon');
  await fails('select id from public.profiles', [], '42501');
  passed.push('anonymous private-table access denied');

  await client.query('reset role');
  const next = async (rule, timezone, after) => (await client.query('select public.next_tars_run_at($1,$2,$3) as next', [rule, timezone, after])).rows[0].next.toISOString();
  assert.equal(await next({ frequency: 'daily', time: '08:00' }, 'Asia/Kolkata', '2026-10-24T02:00:00Z'), '2026-10-24T02:30:00.000Z');
  assert.equal(await next({ frequency: 'weekly', time: '08:00', weekday: 'monday' }, 'Asia/Kolkata', '2026-10-25T02:00:00Z'), '2026-10-26T02:30:00.000Z');
  assert.equal(await next({ frequency: 'daily', time: '08:00' }, 'America/New_York', '2026-10-31T13:00:00Z'), '2026-11-01T13:00:00.000Z');
  await fails("select public.next_tars_run_at('{\"frequency\":\"daily\",\"time\":\"25:00\"}', 'Asia/Kolkata')", [], '22023');
  await fails("select public.next_tars_run_at('{\"frequency\":\"daily\",\"time\":\"08:00\"}', 'Invalid/Timezone')", [], '22023');
  passed.push('daily/weekly timezone and DST calculations; invalid rules rejected');
  await client.query("update public.scheduled_agent_tasks set next_run_at=now()-interval '1 minute' where id=$1", [task.id]);
  await asRole('service_role');
  const reservations = (await client.query('select public.claim_tars_agent_runs($1,$2,1) as reservation', [task.id, owner])).rows;
  assert.equal(reservations.length, 1);
  const reservation = reservations[0].reservation;
  assert.equal((await client.query('select public.claim_tars_agent_runs($1,$2,1)', [task.id, owner])).rowCount, 0);
  const finish = async (status, output, error, text) => (await client.query('select public.finish_tars_agent_run($1,$2,$3,$4,$5,$6) as result', [reservation.runId, reservation.leaseToken, status, output, error, text])).rows[0].result;
  const completed = await finish('completed', 'A synthetic verification result', null, 'Rollback test result');
  const duplicate = await finish('completed', 'A synthetic verification result', null, 'Rollback test result');
  assert.equal(duplicate.chatMessageId, completed.chatMessageId);
  assert.equal((await client.query("select id from public.chat_messages where metadata->>'executionId'=$1", [reservation.runId])).rowCount, 1);
  await asRole('authenticated', owner);
  assert.equal((await client.query('select id from public.agent_tool_runs where id=$1', [reservation.runId])).rowCount, 1);
  await asRole('authenticated', other);
  assert.equal((await client.query('select id from public.agent_tool_runs where id=$1', [reservation.runId])).rowCount, 0);
  passed.push('exclusive task lease, atomic result/message persistence, idempotent completion, and history isolation');
  await client.query('reset role');

  if ((await client.query("select to_regclass('public.composio_sessions') is not null as present")).rows[0].present) {
    const mapping = (await client.query('select user_id from public.composio_sessions limit 1')).rows[0];
    if (mapping) {
      const stranger = users.find(id => id !== mapping.user_id);
      await asRole('authenticated', mapping.user_id);
      assert.equal((await client.query('select session_id from public.composio_sessions where user_id=$1', [mapping.user_id])).rowCount, 1);
      await fails('update public.composio_sessions set session_id=$1 where user_id=$2', ['trs_not_authorized', mapping.user_id], '42501');
      await fails('delete from public.composio_sessions where user_id=$1', [mapping.user_id], '42501');
      await fails('insert into public.composio_sessions(user_id,session_id) values($1,$2)', [stranger, 'trs_not_authorized'], '42501');
      await asRole('authenticated', stranger);
      assert.equal((await client.query('select session_id from public.composio_sessions where user_id=$1', [mapping.user_id])).rowCount, 0);
      await asRole('anon');
      await fails('select session_id from public.composio_sessions', [], '42501');
      await client.query('reset role');
      passed.push('Composio session ownership, anonymous denial and server-only mutation permissions');
    }
  }

  if ((await client.query("select to_regclass('public.pending_tool_actions') is not null as present")).rows[0].present) {
    const pending = (await client.query("insert into public.pending_tool_actions(user_id,conversation_id,request_id,tool_slug,toolkit,arguments,input_schema,summary) values($1,$2,'rollback-confirmation','SLACK_SEND_MESSAGE','slack','{}','{}','Rollback-only confirmation') returning id", [owner,side])).rows[0];
    await asRole('authenticated',owner);
    assert.equal((await client.query('select id from public.pending_tool_actions where id=$1',[pending.id])).rowCount,1);
    await fails("update public.pending_tool_actions set status='completed' where id=$1",[pending.id],'42501');
    await fails('delete from public.pending_tool_actions where id=$1',[pending.id],'42501');
    await fails("insert into public.pending_tool_actions(user_id,conversation_id,request_id,tool_slug,toolkit,arguments,input_schema,summary) values($1,$2,'forged','SLACK_SEND_MESSAGE','slack','{}','{}','Forged')",[owner,side],'42501');
    await asRole('authenticated',other);
    assert.equal((await client.query('select id from public.pending_tool_actions where id=$1',[pending.id])).rowCount,0);
    await asRole('anon');
    await fails('select id from public.pending_tool_actions',[],'42501');
    await client.query('reset role');
    passed.push('confirmation owner-only reads, cross-user isolation and server-only writes (rolled back)');
  }

  if((await client.query("select to_regclass('public.chat_attachments') is not null as present")).rows[0].present){
    const attachmentId=crypto.randomUUID(),objectPath=`${owner}/${side}/${attachmentId}`;
    await asRole('authenticated',owner);
    await client.query("insert into public.chat_attachments(id,user_id,thread_id,name,mime_type,size_bytes,object_path) values($1,$2,$3,'Rollback.txt','text/plain',12,$4)",[attachmentId,owner,side,objectPath]);
    await fails('update public.chat_attachments set message_id=$1 where id=$2',[message,attachmentId],'42501');
    const reminder=(await client.query("insert into public.task_reminders(user_id,title,due_at,timezone) values($1,'Rollback reminder',now()+interval '1 hour','Asia/Kolkata') returning id",[owner])).rows[0];
    await asRole('authenticated',other);
    assert.equal((await client.query('select id from public.chat_attachments where id=$1',[attachmentId])).rowCount,0);
    assert.equal((await client.query('select id from public.task_reminders where id=$1',[reminder.id])).rowCount,0);
    await fails("insert into public.task_reminders(user_id,title,due_at,timezone) values($1,'Forbidden',now(),'UTC')",[owner],'42501');
    await asRole('anon');await fails('select id from public.chat_attachments',[],'42501');await fails('select id from public.task_reminders',[],'42501');
    await client.query('reset role');
    assert.equal((await client.query("select public from storage.buckets where id='tars-chat'")).rows[0].public,false);
    passed.push('private attachment bucket, immutable client attachment linking, reminder/attachment owner isolation and anonymous denial');
  }
  // No external provider is called by these tests. All fixtures and any
  // administrative state changes are rolled back by the caller.
  return passed;
}

module.exports = { checkDatabase };
