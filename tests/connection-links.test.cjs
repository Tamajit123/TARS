const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

// Actual Edge source, controlled provider and database boundaries.
function moduleLoader(fetch) {
  const cache = {};
  const load = name => {
    if (cache[name]) return cache[name];
    const exports = cache[name] = {};
    const code = ts.transpileModule(fs.readFileSync(path.join('supabase/functions/_shared',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(code,{exports,require:id=>load(id.slice(2,-3)),URL,URLSearchParams,AbortSignal,fetch,Deno:{env:{get:name=>name==='COMPOSIO_API_KEY'?'test-server-key':undefined}}});
    return exports;
  };
  return load('connections');
}

function fixture(toolkit, { active = false, foreign = false, invalid = false, configMismatch = false } = {}) {
  const user = 'owner-user', config = 'ac-existing-'+toolkit;
  const accounts = [{id:'ca-old',user_id:foreign?'other-user':user,toolkit:{slug:toolkit},status:active?'ACTIVE':'EXPIRED',created_at:'2026-01-01T00:00:00Z'}];
  const calls = [], saved = [];
  let pointer;
  const db = {from(table) { return { select() {return this;}, eq() {return this;}, single: async()=>({data:{id:toolkit,name:toolkit,toolkit_slug:toolkit,composio_auth_config_id:config,enabled:true},error:null}), maybeSingle:async()=>({data:pointer?{composio_connection_request_id:pointer}:null,error:null}), upsert:async row=>{saved.push(row);pointer=row.composio_connection_request_id;return {error:null};} }; }};
  const connections = moduleLoader(async (raw, init) => {
    const url = new URL(raw), body=init.body?JSON.parse(init.body):null;
    calls.push({path:url.pathname,method:init.method,body});
    const result = url.pathname.endsWith('/connected_accounts') ? {items:accounts}
      : url.pathname.includes('/auth_configs/') ? {id:config,toolkit:{slug:configMismatch?'wrong-toolkit':toolkit},is_enabled:true}
      : (()=>{assert.equal(url.pathname,'/api/v3.1/connected_accounts/link');assert.equal(body.auth_config_id,config);assert.equal(body.user_id,user);const id='ca-new-'+calls.length;accounts.push({id,user_id:user,toolkit:{slug:toolkit},status:'INITIALIZING',created_at:new Date().toISOString()});return {connected_account_id:id,redirect_url:invalid?'https://attacker.example/steal':'https://connect.composio.dev/link/lk_test_'+calls.length,expires_at:new Date(Date.now()+600000).toISOString(),link_token:'must-not-return'};})();
    return {ok:true,status:200,json:async()=>result};
  });
  return {db,user,config,accounts,calls,saved,handle:body=>connections.handleConnectionRequest(db,user,{toolId:toolkit,callbackTarget:'hosted',...body})};
}

for (const provider of ['reddit','twitter','trello','jira']) test(`${provider}: fresh hosted links reuse the exact config/user and require ACTIVE`, async()=>{
  const f=fixture(provider);
  const first=await f.handle({mode:'tool_connect',user_id:'attacker',auth_config_id:'ac-attacker'});
  const second=await f.handle({mode:'tool_connect'});
  assert.notEqual(first.connectUrl,second.connectUrl);
  assert.equal(first.authConfigId,f.config);
  assert.equal(first.status,'pending');
  assert.equal(first.returnMode,'hosted');
  assert.ok(Date.parse(first.expiresAt)>Date.now());
  assert.doesNotMatch(JSON.stringify(first),/test-server-key|must-not-return/);
  assert.doesNotMatch(JSON.stringify(f.saved),/https:|link_token|access_token|refresh_token/);
  assert.equal((await f.handle({mode:'tool_status'})).status,'pending');
  f.accounts.find(account=>account.id===second.connectionRequestId).status='ACTIVE';
  assert.equal((await f.handle({mode:'tool_status'})).status,'connected');
  assert.equal(f.calls.filter(call=>call.path.endsWith('/link')).length,2);
  assert.ok(f.calls.every(call=>!['DELETE','PATCH'].includes(call.method)));
});

for(const provider of ['slack','notion','instagram']) test(`${provider}: ACTIVE account is preserved without a new link`,async()=>{
  const f=fixture(provider,{active:true});const result=await f.handle({mode:'tool_connect'});
  assert.equal(result.status,'connected');assert.equal(result.composioConnectedAccountId,'ca-old');
  assert.ok(!f.calls.some(call=>call.method!=='GET'));
});

test('foreign accounts, mismatched configs, and off-domain hosted links cannot bypass checks',async()=>{
  const foreign=fixture('reddit',{active:true,foreign:true});
  assert.equal((await foreign.handle({mode:'tool_connect'})).status,'pending');
  const mismatch=fixture('twitter',{configMismatch:true});
  await assert.rejects(mismatch.handle({mode:'tool_connect'}),/does not match/);
  const invalid=fixture('jira',{invalid:true});
  await assert.rejects(invalid.handle({mode:'tool_connect'}),/invalid or expired/);
});
