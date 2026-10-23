const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('core user data tables enable RLS and bind rows to the authenticated user', () => {
  const sql = read('supabase/migrations/202610230001_tars_core.sql');
  for (const table of ['profiles', 'chat_threads', 'chat_messages', 'ideas', 'scheduled_agent_tasks', 'agent_tool_runs', 'user_tool_connections']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), `${table} must enable RLS`);
    assert.match(sql, new RegExp(`create policy [^;]* on public\\.${table}[^;]*auth\\.uid\\(\\)[^;]*`, 'i'), `${table} must have an owner policy`);
  }
  assert.match(sql, /foreign key \(thread_id, user_id\) references public\.chat_threads\(id, user_id\)/i);
});

test('chat function requires a valid Supabase user token and keeps provider keys server-side', () => {
  const source = read('supabase/functions/chat/index.ts');
  assert.match(source, /if \(!token\)[\s\S]{0,100}401/);
  assert.match(source, /userClient\.auth\.getUser\(\)/);
  assert.match(source, /Deno\.env\.get\("OPENAI_API_KEY"\)/);
  assert.doesNotMatch(source, /EXPO_PUBLIC_.*(?:OPENAI|SERVICE_ROLE)/i);
});

test('scheduled execution never trusts a user ID supplied in the request body', () => {
  const source = read('supabase/functions/agent-run/index.ts');
  assert.match(source, /mustGetEnv\("SCHEDULER_SECRET"\)/);
  assert.match(source, /resolveUser\(req, supabase\)/);
  assert.doesNotMatch(source, /fallbackUserId|return \{ id: fallback/);
});

test('client Supabase configuration contains no server-only credentials', () => {
  const source = read('src/lib/supabase.ts');
  assert.match(source, /EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(source, /SERVICE_ROLE_KEY|OPENAI_API_KEY|COMPOSIO_API_KEY|BROWSERBASE_API_KEY/);
});
