// Administrative read-only diagnostics; never imported by the mobile app.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { Composio } from '@composio/core';
import vm from 'node:vm';
import ts from 'typescript';
const local = parseEnv(fs.readFileSync('.env', 'utf8'));
process.env.COMPOSIO_API_KEY ||= local.COMPOSIO_API_KEY?.trim();
const identity = JSON.parse(fs.readFileSync('.database-audit/composio-session.json', 'utf8'));
const sdk = new Composio();
const session = await sdk.sessions.use(identity.sessionId);
const readExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('supabase/functions/_shared/composioReads.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports:readExports});
const cases = [
  ['reddit', 'Read preferences of the currently authenticated Reddit user', 'REDDIT_GET_ME_PREFS', { fields: 'lang,nightmode' }],
  ['twitter', 'Read my own authenticated X user profile', 'TWITTER_USER_LOOKUP_ME', {}],
  ['trello', 'List my Trello boards', 'TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER', { idMember: 'me', fields: 'name,url,closed', lists: 'none' }],
  ['jira', 'Search Jira issues assigned to the current user', 'JIRA_SEARCH_ISSUES', { jql: 'assignee = currentUser() ORDER BY updated DESC', max_results: 5, fields: ['summary', 'status'] }],
];
function shape(data, depth = 0) {
  if (Array.isArray(data)) return { count: data.length, first: depth < 4 && data.length ? shape(data[0], depth + 1) : undefined };
  if (data && typeof data === 'object') return Object.fromEntries(Object.entries(data).slice(0, 35).filter(([key]) => !/token|secret|credential|authorization/i.test(key)).map(([key, value]) => [key, depth < 4 ? shape(value, depth + 1) : typeof value]));
  return typeof data;
}
function safeError(data) {
  const raw = typeof data === 'string' ? data : JSON.stringify(data || null);
  return raw.replace(/(?:Bearer\s+|(?:access_token|refresh_token|api_key|client_secret)["'\s:=]+)[^\s",}]+/gi, '[REDACTED]').slice(0, 1200);
}
const report = [];
for (const [toolkit, query, tool, args] of cases) {
  const only = process.argv.find(arg => arg.startsWith('--toolkit='))?.slice(10);
  if (only && toolkit !== only) continue;
  const discovery = await session.search({ query, toolkits: [toolkit] });
  const schema = discovery.toolSchemas?.[tool];
  // Obtain real public metadata even if semantic search did not rank the known tool.
  const rawTools = schema ? null : await sdk.tools.getRawComposioTools({ toolkits: [toolkit], search: query, limit: 10 });
  const found = schema || rawTools?.find(item => item.slug === tool || item.name === tool);
  if (!found) { report.push({toolkit, tool, status:'BLOCKED', reason:'Tool not returned by live discovery.'}); continue; }
  const response = await fetch('https://backend.composio.dev/api/v3.1/tool_router/session/' + encodeURIComponent(identity.sessionId) + '/execute', {
    method: 'POST', headers: {'x-api-key':process.env.COMPOSIO_API_KEY,'Content-Type':'application/json'},
    body: JSON.stringify({tool_slug:tool,arguments:args}),signal:AbortSignal.timeout(45000),
  });
  const result = await response.json();
  let verification;
  try {
    if (!response.ok) throw new Error('Composio HTTP '+response.status);
    verification = { status:'PASS', count:readExports.readResult(tool,result).count };
  } catch (error) { verification = {status:'FAIL',message:safeError(error.message)}; }
  const entry = {toolkit, tool, ...verification, httpStatus:response.status, resultType:result.result_type, logId:result.log_id, error:safeError(result.error), shape:shape(result), providerStatus: result.data?.status_code, providerErrors: safeError(result.data?.http_error || result.data?.message || result.data?.error || result.data?.response?.error)};
  report.push(entry); console.log(JSON.stringify(entry));
}
fs.writeFileSync('.database-audit/connected-reads-diagnostic.json',JSON.stringify(report,null,2));
if (!report.length || report.some(item=>item.status!=='PASS')) process.exitCode=1;
