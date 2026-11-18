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
  const provider = read('supabase/functions/_shared/providerTransport.ts');
  assert.match(source, /if \(!token\)[\s\S]{0,100}401/);
  assert.match(source, /authClient\.auth\.getUser\(\)/);
  assert.match(source, /\.eq\("id", conversationId\)[\s\S]{0,80}\.eq\("user_id", user\.id\)/);
  assert.match(source, /ai_chat_requests/);
  assert.match(source, /requestId/);
  assert.match(provider, /AbortSignal\.timeout/);
  assert.match(provider, /Deno\.env\.get\('GEMINI_API_KEY'\)/);
  assert.match(provider, /'x-goog-api-key': key/);
  assert.doesNotMatch(source, /EXPO_PUBLIC_.*(?:GEMINI|SERVICE_ROLE)/i);
});

test('legacy chat schema is extended safely and private Users rows are sealed', () => {
  const sql = read('supabase/migrations/202610230002_auth_chat_recovery_storage.sql');
  assert.match(sql, /add column if not exists type text not null default 'side'/i);
  assert.match(sql, /create table if not exists public\.chat_messages/i);
  assert.match(sql, /create policy tars_threads_owner_guard[\s\S]*as restrictive/i);
  assert.match(sql, /alter table public\."Users" enable row level security/i);
  assert.match(sql, /revoke all on table public\."Users" from anon, authenticated/i);
  assert.doesNotMatch(sql, /delete\s+from\s+public\."Users"|drop\s+table\s+public\."Users"/i);
});

test('avatar storage is private and only allows the owner folder', () => {
  const sql = read('supabase/migrations/202610230002_auth_chat_recovery_storage.sql');
  assert.match(sql, /values \('tars-avatars', 'tars-avatars', false/i);
  assert.match(sql, /storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/i);
  const client = read('src/lib/auth.ts');
  assert.match(client, /upload\(path,[\s\S]*upsert: false/);
  assert.match(client, /Crypto\.randomUUID\(\)/);
  assert.match(client, /update\(\{ avatar_path: path \}\)[\s\S]*\.select\('id'\)\.single\(\)/);
  assert.doesNotMatch(client, /EXPO_PUBLIC_.*(?:SERVICE_ROLE|OPENAI_API_KEY)/i);
});

test('scheduled execution never trusts a user ID supplied in the request body', () => {
  const source = read('supabase/functions/agent-run/index.ts');
  assert.match(source, /mustGetEnv\("SCHEDULER_SECRET"\)/);
  assert.match(source, /resolveUser\(req, supabase\)/);
  assert.doesNotMatch(source, /fallbackUserId|return \{ id: fallback/);
  assert.match(source, /unsupported_mode/);
  assert.match(source, /hasExternalAction/);
  assert.match(source, /delivery !== "chat"/);
});

test('client Supabase configuration contains no server-only credentials', () => {
  const source = read('src/lib/supabase.ts');
  assert.match(source, /EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(source, /typeof globalThis\.localStorage === 'undefined'/);
  assert.match(source, /Platform\.OS === 'web' \? webStorage : AsyncStorage/);
  assert.doesNotMatch(source, /SERVICE_ROLE_KEY|OPENAI_API_KEY|COMPOSIO_API_KEY|BROWSERBASE_API_KEY/);
});

test('deployed connection routes use a verified bearer token and server credentials', () => {
  const backend = read('supabase/functions/agent-run/index.ts');
  assert.match(backend, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(backend, /auth\.getUser\(token\)/);
  assert.match(backend, /resolveUser\(req, supabase\)/);
  assert.doesNotMatch(backend, /return \{\s*userId:\s*bodyUserId/);
});

test('tool connections use the authenticated deployed Edge Function', () => {
  const service = read('src/services/tools.ts');
  assert.match(service, /supabase.functions.invoke\('agent-run'/);
  assert.match(service, /mode: 'tools_catalog'/);
  assert.match(service, /if \(!match \|\| !token\)/);
  const connections = read('supabase/functions/_shared/connections.ts');
  assert.match(connections, /account.user_id === userId/);
  assert.match(connections, /api\('connected_accounts\/link', 'POST', \{ auth_config_id: tool\.composio_auth_config_id, user_id: userId/);
  assert.match(read('supabase/functions/_shared/callbacks.ts'), /TOOL_CALLBACK_URLS/);
  assert.doesNotMatch(service, /http:\/\/localhost:8081/);
});

test('the app exposes Google OAuth only and protects signed-in routes', () => {
  const welcome = read('src/app/index.tsx');
  const callback = read('src/app/auth/callback.tsx');
  const redirect = read('src/lib/authRedirect.ts');
  const tabs = read('src/app/(tabs)/_layout.tsx');
  const appConfig = JSON.parse(read('app.json'));
  assert.match(welcome, /signInWithOAuth\(\{[\s\S]*provider: 'google'/);
  assert.match(welcome, /hasGoogleIdentity\(session\.user\)/);
  assert.match(welcome, /Linking\.createURL\('auth\/callback'\)/);
  assert.equal(appConfig.expo.scheme, 'tarsai');
  assert.doesNotMatch(welcome, /signInWithPassword|signInWithOtp|verifyOtp|resetPasswordForEmail|Email and password|Phone and SMS/);
  assert.match(callback, /const isGoogle = session\?\.user\.app_metadata\?\.provider === 'google'/);
  assert.match(callback, /if \(!session \|\| !isGoogle\)/);
  assert.match(callback, /await supabase\.auth\.signOut\(\)/);
  assert.match(redirect, /callbackExchanges\.get\(url\)/);
  assert.match(redirect, /exchangeCodeForSession\(code\)/);
  assert.match(tabs, /identity\.provider === 'google'/);
  assert.match(tabs, /router\.replace\('\/'\)/);
  assert.equal(fs.existsSync(path.join(root, 'src/app/auth/reset-password.tsx')), false);
});
