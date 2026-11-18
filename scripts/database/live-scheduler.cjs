const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { withClient } = require('./connection.cjs');

withClient(async (client) => {
  const explicitUser = process.argv.find(arg => arg.startsWith('--user-id='))?.slice(10);
  const owner = explicitUser ? (await client.query('select id from auth.users where id=$1',[explicitUser])).rows[0]?.id : (await client.query('select id from auth.users order by created_at limit 1')).rows[0]?.id;
  assert.ok(owner, 'An existing project identity is required.');
  const tag = `TARS verification ${crypto.randomUUID()}`;
  let threadId, taskId;
  const started = new Date();
  const browserProbe = process.argv.includes('--browser-probe');
  const composioProbe = process.argv.includes('--composio-probe');
  const readProvider = process.argv.find(arg => arg.startsWith('--read-provider='))?.slice(16);
  const searchProbe = process.argv.includes('--search-probe');
  const readCases = {
    reddit: ['REDDIT_GET_ME_PREFS', 'Read my connected Reddit language and night-mode preferences now. Return only whether the read worked, not the preference values.'],
    twitter: ['TWITTER_USER_LOOKUP_ME', 'Read my connected X (Twitter) profile now. Return only whether a real username was returned, not its value.'],
    trello: ['TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER', 'Read my Trello boards now and return only the number of boards. Zero boards is a valid result.'],
    jira: ['JIRA_SEARCH_ISSUES', 'Read my Jira issues assigned to me now, using assignee = currentUser() ORDER BY updated DESC and a limit of 5. Return only the issue count. Zero issues is a valid result.'],
  };
  if (readProvider && !readCases[readProvider]) throw new Error('Choose reddit, twitter, trello or jira.');
  const customPrompt = readProvider ? readCases[readProvider][1] + ' Use the connected read tool and do not use web browsing.' : searchProbe ? 'Use search_web to search for Browserbase documentation live view. Return one actual documentation URL from the search results and its title. Do not invent URLs or use browse_page.' : null;
  let readReport;
  try {
    await client.query('begin');
    threadId = (await client.query("insert into public.chat_threads(user_id,type,title) values($1,'side',$2) returning id", [owner,tag])).rows[0].id;
    taskId = (await client.query("insert into public.scheduled_agent_tasks(user_id,title,original_prompt,task_payload,schedule_rule,timezone,next_run_at) values($1,$2,$3,$4,$5,'UTC',now()) returning id", [owner,tag,composioProbe ? 'Use all three connected read tools: GITHUB_GET_THE_AUTHENTICATED_USER, GMAIL_LIST_LABELS, GOOGLECALENDAR_LIST_CALENDARS. Return only my GitHub login, public repository count, Gmail label count, and calendar count. Do not use browser tools. Do not return label names, calendar titles or email addresses.' : browserProbe ? 'Use browse_page to read https://example.com now. Return the actual page title and its source URL. Do not use search_web.' : 'Reply with exactly: TARS database verification succeeded. This is a text-generation test; do not use any external tools.',{ sourceThreadId: threadId },{ frequency:'daily',time:'00:01' }])).rows[0].id;
    if (customPrompt) await client.query('update public.scheduled_agent_tasks set original_prompt=$1 where id=$2', [customPrompt, taskId]);
    await client.query("update public.scheduled_agent_tasks set next_run_at=now()-interval '1 second' where id=$1", [taskId]);
    await client.query('commit');
    if (process.argv.includes('--dispatch-now')) await client.query('select private.dispatch_tars_schedules()');
    fs.writeFileSync('.database-audit/scheduler-fixture.json', JSON.stringify({ taskId,threadId,tag }));
    console.log(JSON.stringify({ stage:'waiting_for_real_pg_cron',taskId,maxWaitSeconds:150 }));
    let run;
    let browserViewObserved = false, browserViewHttpStatus = null;
    for (let attempt=0; attempt<300; attempt++) {
      const rows = (await client.query("select id,status,output_summary,error_message,attempt,metadata->>'failure_code' as failure_code,metadata->'failure_diagnostic' as failure_diagnostic from public.agent_tool_runs where scheduled_task_id=$1 order by created_at desc limit 1",[taskId])).rows;
      run = rows[0];
      if ((browserProbe || searchProbe) && !browserViewObserved) {
        const progress = (await client.query("select metadata->'execution' as state from public.agent_tool_runs where metadata->>'conversation_id'=$1 and action_name=$2 and status='running' order by created_at desc limit 1", [threadId, searchProbe ? 'search_web' : 'browse_page'])).rows[0]?.state;
        const view = progress?.browser;
        if (view?.available && Date.parse(view.expiresAt) > Date.now() && view.liveUrl) {
          const url = new URL(view.liveUrl);
          assert.equal(url.protocol, 'https:'); assert.match(url.hostname, /(^|\.)browserbase\.com$/);
          assert.equal(url.username + url.password, '');
          browserViewObserved = true;
          // Inspect the provider-issued short-lived view only for our tagged
          // owner fixture; never log or persist its capability URL.
          const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
          browserViewHttpStatus = response.status;
          await response.body?.cancel();
          assert.equal(response.ok, true, 'The provider browser view must be reachable while active.');
        }
      }
      if (run && run.status !== 'running') break;
      await new Promise((resolve) => setTimeout(resolve,500));
    }
    assert.ok(run, 'The cron dispatcher did not create an execution within 150 seconds.');
    if (run.status !== 'completed') console.log(JSON.stringify({stage:'scheduled_failure',runId:run.id,code:run.failure_code,diagnostic:run.failure_diagnostic,attempt:run.attempt}));
    assert.equal(run.status,'completed',run.error_message || 'The provider run did not complete.');
    assert.ok(run.output_summary?.trim(), 'A genuine provider response was not saved.');
    if (browserProbe) {
      const browser = (await client.query("select status,metadata from public.agent_tool_runs where metadata->>'conversation_id'=$1 and action_name='browse_page'", [threadId])).rows;
      assert.ok(browser.some(item => item.status === 'completed'), 'The agent must actually call and complete Browserbase.');
      const state = browser.find(item => item.status === 'completed').metadata.execution;
      assert.equal(state?.phase, 'completed');
      assert.ok(state.steps.length >= 3, 'Genuine browser milestones must be persisted.');
      assert.match(state.result.title, /Example Domain/i);
      assert.equal(state.browser.available, false, 'Released browser sessions must not be shown as live.');
      assert.equal(state.browser.liveUrl, undefined, 'The completed record must not expose an expired browser view.');
      assert.match(run.output_summary, /Example Domain/i);
    }
    if (composioProbe) {
      const reads = (await client.query("select action_name,status,metadata->>'logId' as log_id from public.agent_tool_runs where metadata->>'conversation_id'=$1 and metadata->>'provider'='composio'", [threadId])).rows;
      fs.writeFileSync('.database-audit/composio-agent-diagnostic.json', JSON.stringify({ output: run.output_summary, reads }, null, 2));
      assert.equal(reads.filter(read => read.status === 'completed' && read.log_id).length, 3, 'The real Gemini agent must complete all three Composio reads with log IDs.');
      console.log(JSON.stringify({ stage: 'gemini_composio_reads_verified', reads }));
    }
    if (readProvider) {
      const reads = (await client.query("select action_name,status,error_message,metadata->>'logId' as log_id,metadata->'execution'->'result' as result from public.agent_tool_runs where metadata->>'conversation_id'=$1 and metadata->>'provider'='composio'", [threadId])).rows;
      assert.ok(reads.some(read => read.action_name === readCases[readProvider][0] && read.status === 'completed' && read.log_id), 'The real Gemini agent must complete the requested provider read with a log ID: '+JSON.stringify(reads));
      readReport = { provider: readProvider, reads };
      console.log(JSON.stringify({stage:'real_agent_read_verified',...readReport}));
    }
    if (searchProbe) {
      const read = (await client.query("select status,metadata->'execution' as state from public.agent_tool_runs where metadata->>'conversation_id'=$1 and action_name='search_web' order by created_at desc limit 1",[threadId])).rows[0];
      assert.equal(read?.status,'completed','The AI must actually execute a search in Browserbase.');
      assert.match(read.state.result.url,/html\.duckduckgo\.com/);
      assert.ok(read.state.result.excerpt.length>300,'Search must contain usable page text.');
      assert.match(run.output_summary,/docs\.browserbase\.com/,'Final answer must cite a real result.');
      assert.equal(read.state.browser.available,false);
    }
    const messages = (await client.query("select id,content from public.chat_messages where thread_id=$1 and metadata->>'executionId'=$2",[threadId,run.id])).rows;
    assert.equal(messages.length,1,'The result must be delivered once to the test conversation.');
    assert.equal(messages[0].content,run.output_summary);
    const task = (await client.query('select last_run_status,next_run_at,lease_token from public.scheduled_agent_tasks where id=$1',[taskId])).rows[0];
    assert.equal(task.last_run_status,'completed');
    assert.equal(task.lease_token,null);
    assert.ok(new Date(task.next_run_at)>new Date());
    const cron = (await client.query("select d.status from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname='tars-agent-run-due-schedules' and d.start_time>=$1 order by d.start_time desc limit 1",[started])).rows[0];
    if (!process.argv.includes('--dispatch-now')) assert.equal(cron?.status,'succeeded');
    const report = { status:'PASS',trigger:process.argv.includes('--dispatch-now') ? 'manual database dispatch -> pg_net -> deployed agent-run -> Gemini -> PostgreSQL' : 'real pg_cron -> pg_net -> deployed agent-run -> Gemini -> PostgreSQL',runId:run.id,providerResponseCharacters:run.output_summary.length,messageSavedOnce:true,nextOccurrencePersisted:true,leaseReleased:true, ...(browserProbe ? { browserViewObserved, browserViewHttpStatus } : {}) };
    Object.assign(report, readReport || {}, (browserProbe || searchProbe) ? {browserViewObserved,browserViewHttpStatus} : {});
    fs.writeFileSync(readProvider ? `.database-audit/live-${readProvider}-agent-result.json` : searchProbe ? '.database-audit/live-search-agent-result.json' : composioProbe ? '.database-audit/live-composio-agent-result.json' : browserProbe ? '.database-audit/live-browser-agent-result.json' : '.database-audit/live-scheduler-result.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally {
    // Remove only this script's tagged fixtures; original user rows are untouched.
    await client.query('reset role');
    await client.query('begin');
    try {
      if (taskId) {
        await client.query('delete from public.agent_tool_runs where scheduled_task_id=$1 and user_id=$2',[taskId,owner]);
        await client.query('delete from public.scheduled_agent_tasks where id=$1 and title=$2 and user_id=$3',[taskId,tag,owner]);
      }
      if (threadId) await client.query("delete from public.agent_tool_runs where user_id=$1 and metadata->>'conversation_id'=$2", [owner, threadId]);
      if (threadId) await client.query('delete from public.chat_threads where id=$1 and title=$2 and user_id=$3',[threadId,tag,owner]);
      await client.query('commit');
    } catch(error) { await client.query('rollback'); throw error; }
    console.log(JSON.stringify({fixturesRemoved:true}));
  }
}).catch((error) => { console.error(JSON.stringify({status:'FAIL',code:error.code || error.name,message:error.message})); process.exitCode=1; });
