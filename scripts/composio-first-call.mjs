// Operator entrypoint for the same Supabase UUID identity used by TARS.
// Credentials are loaded through the existing ignored .env, never printed.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { Composio } from '@composio/core';
const require = createRequire(import.meta.url);
const { withClient } = require('./database/connection.cjs');
const local = parseEnv(fs.readFileSync('.env', 'utf8'));
if (!process.env.COMPOSIO_API_KEY) process.env.COMPOSIO_API_KEY = local.COMPOSIO_API_KEY?.trim();
if (!process.env.COMPOSIO_API_KEY) throw new Error('Configure the existing Platform project key in the ignored .env.');
const stateFile = '.database-audit/composio-session.json';
const save = value => { fs.mkdirSync('.database-audit', { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify(value, null, 2)); };
try {
  let state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
  const explicitUser = process.argv.find(value => value.startsWith('--user-id='))?.slice(10);
  const userId = explicitUser || state.userId || await withClient(async db => {
    const result = await db.query('select user_id from auth.sessions order by created_at desc limit 1');
    if (!result.rows[0]) throw new Error('Sign in to TARS first or pass an existing --user-id.');
    return result.rows[0].user_id;
  });
  const binding = await withClient(async db => {
    if (!(await db.query('select id from auth.users where id=$1', [userId])).rowCount) throw new Error('The selected TARS identity does not exist.');
    const installed = (await db.query("select to_regclass('public.composio_sessions') is not null as present")).rows[0].present;
    return installed ? (await db.query('select session_id from public.composio_sessions where user_id=$1', [userId])).rows[0]?.session_id : null;
  });
  const composio = new Composio();
  const savedSession = binding || (state.userId === userId ? state.sessionId : undefined);
  const session = savedSession ? await composio.sessions.use(savedSession) : await composio.create(userId);
  state = { ...(state.userId === userId ? state : {}), userId, sessionId: session.sessionId };
  save(state);
  console.log(JSON.stringify({ stage: 'session_ready', userId, sessionId: session.sessionId }));
  if (process.argv.includes('--bind')) {
    await withClient(async db => {
      await db.query('insert into public.composio_sessions(user_id,session_id) values($1,$2) on conflict(user_id) do nothing', [userId, session.sessionId]);
      const mapping = (await db.query('select session_id from public.composio_sessions where user_id=$1', [userId])).rows[0];
      if (mapping.session_id !== session.sessionId) throw new Error('An existing session binding differs; no binding was overwritten.');
    });
    console.log(JSON.stringify({ stage: 'bound_to_existing_backend', userId, sessionId: session.sessionId }));
  }
  if (process.argv.includes('--discover')) {
    const queries = ['Find GitHub tool to read the currently authenticated user profile', 'Find Gmail tool to list email labels, without reading message bodies', 'Find Google Calendar tool to list my calendars'];
    state.discovery = [];
    for (const query of queries) {
      const result = await session.search({ query });
      state.discovery.push({ query, result }); save(state);
      console.log(JSON.stringify({ stage: 'discovery', query, tools: result.results?.flatMap(item => item.primaryToolSlugs || []), toolkits: result.results?.flatMap(item => item.toolkits || []) }));
    }
  }
  if (process.argv.includes('--connect')) {
    const toolkits = [...new Set((state.discovery || []).flatMap(item => item.result.results?.flatMap(result => result.toolkits || []) || []))];
    if (toolkits.length !== 3) throw new Error('Discover the three requested integrations first.');
    state.connections ||= {};
    for (const toolkit of toolkits) {
      const current = await session.toolkits({ toolkits: [toolkit] });
      if (current.items.some(item => item.connection?.isActive)) {
        console.log(JSON.stringify({ stage: 'already_connected', toolkit })); continue;
      }
      if (!state.connections[toolkit]?.redirectUrl) {
        const connection = await session.authorize(toolkit);
        state.connections[toolkit] = { id: connection.id, redirectUrl: connection.redirectUrl, status: connection.status };
        save(state);
      }
      console.log(JSON.stringify({ stage: 'authorize', toolkit, ...state.connections[toolkit] }));
    }
  }
  if (process.argv.includes('--call')) {
    if (state.discovery?.length !== 3) throw new Error('Run --discover before calling the three requested integrations.');
    state.proof ||= [];
    for (const discovery of state.discovery || []) {
      const toolkit = discovery.result.results?.[0]?.toolkits?.[0];
      const slug = discovery.result.results?.[0]?.primaryToolSlugs?.[0];
      const schema = discovery.result.toolSchemas?.[slug]?.inputSchema;
      if (!slug || !schema) throw new Error('Discover complete read-only schemas before calling tools.');
      const current = await session.toolkits({ toolkits: [toolkit] });
      if (!current.items.some(item => item.connection?.isActive)) {
        console.log(JSON.stringify({ stage: 'waiting_for_authorization', toolkit })); process.exitCode = 1; continue;
      }
      const required = schema.required || [];
      const args = {};
      for (const field of required) {
        if (field === 'user_id') args[field] = 'me';
        else throw new Error('The discovered tool needs explicit arguments.');
      }
      const result = await session.execute(slug, args);
      if (result.error || !result.logId) {
        console.log(JSON.stringify({ stage: 'tool_failed', toolkit, tool: slug, logId: result.logId || null })); process.exitCode = 1; continue;
      }
      const body = result.data?.response?.data || result.data?.data || result.data;
      const summary = toolkit === 'github' ? { login: body.login, publicRepositories: body.public_repos }
        : toolkit === 'gmail' ? { labelsCount: body.labels?.length }
        : { calendarsCount: (body.calendars || body.items)?.length };
      const proof = { toolkit, tool: slug, logId: result.logId, summary, completedAt: new Date().toISOString() };
      state.proof.push(proof); save(state);
      console.log(JSON.stringify({ stage: 'tool_completed', ...proof }));
    }
  }
} catch (error) {
  const cause = error.cause || error;
  console.error(JSON.stringify({ stage: 'failed', code: error.code || error.name, status: cause.status || error.status,
    requestId: cause.requestID || cause.requestId || error.requestId || cause.headers?.get?.('x-request-id') || null }));
  process.exitCode = 1;
}
