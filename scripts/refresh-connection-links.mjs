// Operator verification of the SAME stable user/config mapping used by TARS.
// No auth configuration or existing connected account is created/replaced here.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { Composio } from '@composio/core';
const require = createRequire(import.meta.url);
const { withClient } = require('./database/connection.cjs');
const local = parseEnv(fs.readFileSync('.env','utf8'));
process.env.COMPOSIO_API_KEY ||= local.COMPOSIO_API_KEY?.trim();
const sdk = new Composio();
const identity = JSON.parse(fs.readFileSync('.database-audit/composio-session.json','utf8'));
await withClient(async db => {
  const mapping = (await db.query('select session_id from public.composio_sessions where user_id=$1',[identity.userId])).rows[0];
  if (!mapping || mapping.session_id !== identity.sessionId) throw new Error('Existing TARS identity/session mapping does not match.');
});
const targets = ['reddit','twitter','trello','jira'];
const preserved = ['slack','notion','instagram'];
async function accounts() {
  const items = [];
  const query = new URLSearchParams({ user_ids: identity.userId, limit: '100' });
  for (let page=0;page<10;page++) {
    const response = await fetch('https://backend.composio.dev/api/v3.1/connected_accounts?'+query,{headers:{'x-api-key':process.env.COMPOSIO_API_KEY},signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('Owner account status request failed: HTTP '+response.status);
    const result = await response.json(); items.push(...(result.items||[]));
    if (!result.next_cursor) return items.filter(item=>item.user_id===identity.userId);
    query.set('cursor',result.next_cursor);
  }
  throw new Error('Account pagination exceeded its safe limit.');
}
const initial = await accounts();
if (initial.length === 0) throw new Error('No owner-matched accounts were returned. Refusing to generate links until identity is verified.');
const protectedIds = initial.filter(account => preserved.includes(account.toolkit?.slug) && account.status === 'ACTIVE').map(account=>account.id).sort();
const report = { userId: identity.userId, inspectedAt: new Date().toISOString(), preserved: preserved.map(toolkit=>({ toolkit, accounts: initial.filter(account=>account.toolkit?.slug === toolkit).map(account=>({ id: account.id, status: account.status })) })), providers: [] };
const links = [];
for (const toolkit of targets) {
  const configs = (await sdk.authConfigs.list({ toolkit })).items.filter(config=>config.isEnabled !== false);
  if (configs.length !== 1) { report.providers.push({ toolkit, status: 'BLOCKED', error: configs.length ? 'Multiple auth configurations: an explicit selection is required.' : 'Missing existing auth configuration.' }); continue; }
  const config = configs[0];
  const existing = initial.filter(account=>account.toolkit?.slug === toolkit);
  if (!process.argv.includes('--generate') || existing.some(account=>account.status==='ACTIVE')) {
    report.providers.push({toolkit,authConfigId:config.id,status:existing.some(account=>account.status==='ACTIVE')?'PASS':'BLOCKED',providerStatuses:existing.map(account=>account.status),reason:existing.some(account=>account.status==='ACTIVE')?'Existing ACTIVE connection preserved.':'Waiting for a fresh hosted authorization flow.'});
    continue;
  }
  const generatedAt = new Date().toISOString();
  const response = await fetch('https://backend.composio.dev/api/v3.1/connected_accounts/link',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':process.env.COMPOSIO_API_KEY},body:JSON.stringify({user_id:identity.userId,auth_config_id:config.id}),signal:AbortSignal.timeout(20000)});
  const data = await response.json();
  if (!response.ok) {
    const code = data.error?.code || data.code;
    report.providers.push({toolkit,authConfigId:config.id,status:'FAIL',httpStatus:response.status,requestId:response.headers.get('x-request-id'),error:typeof code==='string'&&/^[A-Z0-9_-]{1,100}$/i.test(code)?code:'Link request rejected by Composio.'});
    continue;
  }
  const url = new URL(data.redirect_url);
  if (url.protocol!=='https:' || url.hostname!=='connect.composio.dev' || url.username || url.password || !data.connected_account_id || !(Date.parse(data.expires_at)>Date.now())) throw new Error('Provider returned an invalid/expired hosted link.');
  const verifyResponse = await fetch('https://backend.composio.dev/api/v3.1/connected_accounts/'+encodeURIComponent(data.connected_account_id),{headers:{'x-api-key':process.env.COMPOSIO_API_KEY},signal:AbortSignal.timeout(15000)});
  const verified = await verifyResponse.json();
  if (!verifyResponse.ok || verified.user_id!==identity.userId || verified.auth_config?.id!==config.id || verified.toolkit?.slug!==toolkit) throw new Error('Fresh account identity/config verification failed.');
  report.providers.push({toolkit,authConfigId:config.id,status:'PASS',httpStatus:response.status,accountId:data.connected_account_id,generatedAt,expiresAt:data.expires_at,providerStatus:verified.status,oauthCompletion:verified.status==='ACTIVE'?'PASS':'BLOCKED'});
  links.push({toolkit,url:url.href,expiresAt:data.expires_at});
}
const after = await accounts();
report.preservedConnectionsUnchanged = protectedIds.every(id=>after.some(account=>account.id===id&&account.status==='ACTIVE'));
if (!report.preservedConnectionsUnchanged) throw new Error('Protected connection verification failed. No deletion or revocation was requested.');
fs.writeFileSync(process.argv.includes('--generate') ? '.database-audit/fresh-connection-report.json' : '.database-audit/fresh-connection-status.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({report,links},null,2));
