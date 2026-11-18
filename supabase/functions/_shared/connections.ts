import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';
import { connectionCallback } from './callbacks.ts';

// Only the service verifies provider accounts and writes connection records.
// OAuth state/tokens returned by Composio are never stored or sent to the app.
import { ConnectionError } from './connectionError.ts';
export { ConnectionError };
type RecordData = Record<string, any>;
const catalog = [
  ['gmail','Gmail','Read, send and organize email'], ['slack','Slack','Messages and workspace channels'],
  ['googlecalendar','Google Calendar','Events and availability'], ['notion','Notion','Pages and databases'],
  ['instagram','Instagram','Posts and profile'], ['reddit','Reddit','Posts and communities'],
  ['github','GitHub','Repositories and issues'], ['twitter','X (Twitter)','Posts and search'],
  ['trello','Trello','Boards and cards'], ['jira','Jira','Issues and projects'],
];

export async function getConnectionHealth() {
  const key = Deno.env.get('COMPOSIO_API_KEY')?.trim();
  if (!key) return { configured: false };
  const response = await fetch('https://backend.composio.dev/api/v3/auth_configs?limit=100', { headers: { 'x-api-key': key }, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  return { configured: true, httpStatus: response.status, authConfigsCount: response.ok ? (data.items || []).length : undefined,
    formatIssue: /^['"]|['"]$|\s|=/.test(key) };
}

export async function composioAPI(path: string, method = 'GET', body?: RecordData) {
  const key = Deno.env.get('COMPOSIO_API_KEY')?.trim();
  if (!key) throw new ConnectionError(503, 'Composio is not configured on the server.');
  const response = await fetch(`https://backend.composio.dev/api/v3.1/${path}`, {
    method, headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new ConnectionError(response.status === 401 || response.status === 403 ? 503 : 502,
    response.status === 401 || response.status === 403 ? 'Composio rejected the server API key. Ask the project owner to check the Platform credential.' : 'Composio could not complete this request. Please retry.', response.headers.get('x-request-id') || undefined);
  return response.status === 204 ? {} : response.json();
}
const api = composioAPI;
const toolkitCache = new Map<string, { until: number; data: RecordData }>();
export async function toolkitMetadata(slug: string) {
  const cached = toolkitCache.get(slug);
  if (cached && cached.until > Date.now()) return cached.data;
  const data = await api(`toolkits/${encodeURIComponent(slug)}`);
  toolkitCache.set(slug, { until: Date.now() + 300000, data });
  return data;
}

async function listAll(path: string, query: URLSearchParams) {
  const items: RecordData[] = [];
  // A bounded loop avoids an unbounded provider request on malformed pagination.
  for (let page = 0; page < 10; page++) {
    const result = await api(`${path}?${query}`);
    items.push(...(result.items || []));
    if (!result.next_cursor) return items;
    query.set('cursor', result.next_cursor);
  }
  throw new ConnectionError(502, 'The provider account list is too large to verify safely.');
}

async function accountsFor(userId: string, toolkit?: string) {
  const params = new URLSearchParams({ user_ids: userId, limit: '100' });
  if (toolkit) params.set('toolkit_slugs', toolkit);
  return (await listAll('connected_accounts', params)).filter(account => account.user_id === userId && (!toolkit || account.toolkit?.slug === toolkit));
}

const statusFor = (account?: RecordData) => account?.status === 'ACTIVE' && !account.is_disabled ? 'connected'
  : ['INITIATED','INITIALIZING'].includes(account?.status) ? 'pending' : account?.status === 'FAILED' ? 'failed' : account ? 'revoked' : 'not_connected';

function latestAccount(accounts: RecordData[], pendingId?: string | null) {
  return accounts.find(account => statusFor(account) === 'connected')
    || accounts.find(account => account.id === pendingId)
    || [...accounts].sort((a,b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''))[0];
}

async function save(db: SupabaseClient, userId: string, toolId: string, account?: RecordData) {
  const status = statusFor(account);
  const now = new Date().toISOString();
  const row = { user_id: userId, tool_id: toolId, status,
    composio_connected_account_id: account?.id || null, composio_connection_request_id: status === 'pending' ? account?.id || null : null,
    connected_label: status === 'connected' ? account?.alias || account?.toolkit?.slug || null : null,
    connected_email: null, last_checked_at: now, connected_at: status === 'connected' ? now : null };
  const { error } = await db.from('user_tool_connections').upsert(row, { onConflict: 'user_id,tool_id' });
  if (error) throw new ConnectionError(500, 'The verified connection status could not be saved.');
  return { success: true, toolId, status, connectedLabel: row.connected_label, connectedEmail: null,
    composioConnectedAccountId: row.composio_connected_account_id, composioConnectionRequestId: row.composio_connection_request_id, lastCheckedAt: now,
    providerStatus: account?.status || null,
    statusMessage: account?.status === 'EXPIRED' ? 'Authorization expired. Tap Connect for a fresh link.' : account?.status === 'FAILED' ? 'Provider authorization failed. Start a fresh connection attempt.' : null };
}

export async function handleConnectionRequest(db: SupabaseClient, userId: string, body: RecordData) {
  if (body.mode === 'tools_catalog') {
    const [configs, accounts] = await Promise.all([
      listAll('auth_configs', new URLSearchParams({ limit: '100' })), accountsFor(userId),
    ]);
    const all = [...catalog, ...configs.filter(config => typeof config.toolkit?.slug === 'string' && !catalog.some(([slug]) => slug === config.toolkit.slug)).map(config => [config.toolkit.slug, config.toolkit.name || config.toolkit.slug, 'Connected application'])];
    const metadata = await Promise.all(all.map(async ([slug]) => { try { return await toolkitMetadata(slug); } catch { return null; } }));
    const tools = all.map(([slug,name,description], sort_order) => {
      const config = configs.find(config => config.toolkit?.slug === slug && !config.is_disabled && config.is_enabled !== false);
      return { id: slug, slug, name, description, toolkit_slug: slug, category: 'Productivity', logo_key: slug,
        actions: [], composio_auth_config_id: config?.id || null, enabled: Boolean(config) && metadata[sort_order]?.enabled !== false && Boolean(metadata[sort_order]), sort_order };
    });
    const { error } = await db.from('tools').upsert(tools, { onConflict: 'id' });
    if (error) throw new ConnectionError(500, 'The tool catalog could not be refreshed.');
    return { ok: true, tools: await Promise.all(tools.map(async (tool, index) => {
      const account = latestAccount(accounts.filter(account => account.toolkit?.slug === tool.toolkit_slug));
      const state = await save(db, userId, tool.id, account);
      const info = metadata[index];
      const availability = state.status === 'connected' ? 'connected' : state.status === 'revoked' ? 'authorization_expired' : !info ? 'temporarily_failing' : info.enabled === false ? 'unsupported' : tool.enabled ? 'ready' : 'configuration_required';
      const reason = availability === 'configuration_required' ? (info?.composio_managed_auth_schemes?.length ? 'A Composio auth configuration is required.' : 'Your own OAuth application credentials are required in Composio.')
        : availability === 'temporarily_failing' ? 'Provider availability could not be checked. Refresh to retry.' : availability === 'authorization_expired' ? 'Authorization expired or was revoked. Reconnect your account.' : availability === 'unsupported' ? 'This toolkit is disabled by the provider.' : null;
      return { ...tool, availability, availability_reason: reason, status: state.status, connected_label: state.connectedLabel, connected_email: null,
        composio_connected_account_id: state.composioConnectedAccountId, logo_url: info?.meta?.logo || null, icon_url: info?.meta?.logo || null };
    })) };
  }
  if (typeof body.toolId !== 'string' || body.toolId.length > 100) throw new ConnectionError(400, 'Choose a valid tool.');
  const { data: tool, error } = await db.from('tools').select('*').eq('id', body.toolId).single();
  if (error || !tool?.toolkit_slug) throw new ConnectionError(404, 'This tool is unavailable. Refresh the catalog.');
  const accounts = await accountsFor(userId, tool.toolkit_slug);
  const { data: savedConnection, error: savedError } = await db.from('user_tool_connections').select('composio_connection_request_id').eq('user_id', userId).eq('tool_id', tool.id).maybeSingle();
  if (savedError) throw new ConnectionError(500, 'The connection attempt could not be loaded.');
  const account = latestAccount(accounts, savedConnection?.composio_connection_request_id);
  if (body.mode === 'tool_status') return await save(db, userId, tool.id, account);
  if (body.mode === 'tool_disconnect') {
    // Only IDs from the live, owner-filtered list can be removed.
    for (const account of accounts) await api(`connected_accounts/${encodeURIComponent(account.id)}`, 'DELETE');
    return { ...await save(db, userId, tool.id), message: 'Disconnected.' };
  }
  if (body.mode !== 'tool_connect') throw new ConnectionError(400, 'Unsupported connection request.');
  if (!tool.enabled && statusFor(account) !== 'connected') throw new ConnectionError(409, 'This integration needs an enabled auth configuration in the existing Composio project.');
  if (statusFor(account) === 'connected') return { ...await save(db, userId, tool.id, account), toolName: tool.name, connectUrl: '', connectionRequestId: account.id };
  const callback = connectionCallback(body);
  if (!tool.composio_auth_config_id) throw new ConnectionError(409, 'This provider has no auth-config ID. Refresh Tools & Connections; the project owner must configure it if it remains missing.');
  const config = await api(`auth_configs/${encodeURIComponent(tool.composio_auth_config_id)}`);
  if (config.toolkit?.slug !== tool.toolkit_slug || config.is_disabled || config.is_enabled === false) throw new ConnectionError(409, 'The saved auth configuration does not match this provider or is disabled. Refresh the catalog.');
  // v3.1 hosted link API: explicit existing config and authenticated user.
  // Always POST a new session. Never store/return an older authorization URL.
  const link = await api('connected_accounts/link', 'POST', { auth_config_id: tool.composio_auth_config_id, user_id: userId, ...(callback ? { callback_url: callback } : {}) });
  let redirect: URL;
  try { redirect = new URL(link.redirect_url); } catch { throw new ConnectionError(502, 'The provider returned an invalid authorization link.'); }
  if (redirect.protocol !== 'https:' || redirect.hostname !== 'connect.composio.dev' || redirect.username || redirect.password || !link.connected_account_id || !(Date.parse(link.expires_at) > Date.now())) throw new ConnectionError(502, 'The provider returned an invalid or expired authorization link.');
  await save(db, userId, tool.id, { id: link.connected_account_id, status: 'INITIATED' });
  return { success: true, toolId: tool.id, toolName: tool.name, connectUrl: redirect.href, connectionRequestId: link.connected_account_id,
    composioConnectedAccountId: link.connected_account_id, authConfigId: tool.composio_auth_config_id, expiresAt: link.expires_at,
    status: 'pending', callbackUrl: callback || null, returnMode: callback ? 'redirect' : 'hosted' };
}
