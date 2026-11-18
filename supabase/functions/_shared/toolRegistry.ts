import {filterEmailDay,type DayWindow} from './localDay.ts';
import Ajv from 'npm:ajv@8.20.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';
import { composioAPI, ConnectionError } from './connections.ts';
import { composioSession } from './composio.ts';
import { additionalReads } from './additionalReads.ts';
import { reviewedTools } from './reviewedTools.ts';
import {mapRouteResult} from './maps.ts';
import {servicePreview} from './servicePreview.ts';
type Data = Record<string, any>;
export type DiscoveredTool = { name: string; toolkit: string; description: string; parameters: Data; requiresConfirmation: boolean };
const validator = new Ajv({ strict: false, allErrors: false, validateFormats: false });
const allowedTools = [...reviewedTools, ...additionalReads];
const toolkits = new Set(['gmail','googlecalendar','slack','notion','trello','jira','reddit','twitter','instagram','github','google_maps']);

export const discoveryTools = [
  { name: 'discover_connected_tools', description: 'Discover current actions and input schemas for the user intent in the existing Composio session. Call this before run_connected_tool. Connections and permissions are verified by the server.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
  { name: 'run_connected_tool', description: 'Run a previously discovered action with its exact schema. Pass arguments as a JSON object encoded in arguments_json. Read results are real. External writes only prepare a confirmation card; they are never executed here.', parameters: { type: 'OBJECT', properties: { tool_name: { type: 'STRING' }, arguments_json: { type: 'STRING' } }, required: ['tool_name','arguments_json'] } },
];

export async function discoverTools(db: SupabaseClient, userId: string, query: string) {
  if (!query.trim() || query.length > 500) throw new ConnectionError(400, 'Describe the action in up to 500 characters.');
  const session = await composioSession(db, userId);
  const result = await composioAPI(`tool_router/session/${encodeURIComponent(session)}/search`, 'POST', { queries: [{ use_case: query }] });
  const found: DiscoveredTool[] = [];
  for (const [name, value] of Object.entries(result.tool_schemas || {}) as [string,Data][]) {
    const reviewed = allowedTools.find(tool => tool.name === name);
    if (!reviewed || !toolkits.has(value.toolkit?.toLowerCase()) || value.toolkit.toLowerCase() !== reviewed.toolkit) continue;
    let parameters = value.input_schema;
    if (!value.hasFullSchema || !parameters) {
      const full = await composioAPI(`tools/${encodeURIComponent(name)}`);
      if (full.toolkit?.slug !== reviewed.toolkit || !full.input_parameters) continue;
      parameters = full.input_parameters;
    }
    found.push({ name, toolkit: reviewed.toolkit, description: (value.description || reviewed.description).slice(0, 1800), parameters, requiresConfirmation: reviewed.requiresConfirmation });
  }
  return found.slice(0, 12);
}

export function validatedToolArgs(tool: DiscoveredTool, raw: string) {
  if (raw.length > 16000) throw new ConnectionError(400, 'The action arguments are too large.');
  let args: Data; try { args = JSON.parse(raw); } catch { throw new ConnectionError(400, 'Action arguments must be valid JSON.'); }
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new ConnectionError(400, 'Use an object for action arguments.');
  if (!validator.validate(tool.parameters, args)) throw new ConnectionError(400, 'The action needs valid required fields. Ask for missing details.');
  const checkCredentials = (value: unknown, depth = 0) => {
    if (depth > 12) throw new ConnectionError(400, 'The action arguments are too deeply nested.');
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (/(api.?key|access.?token|refresh.?token|password|client.?secret|__proto__|constructor|prototype)/i.test(key)) throw new ConnectionError(400, 'Credentials cannot be supplied as action arguments.');
      checkCredentials(item, depth + 1);
    }
  };
  checkCredentials(args);
  for (const key of Object.keys(args)) {
    if (['user_id','idMember'].includes(key) && args[key] !== 'me' && ['gmail','trello'].includes(tool.toolkit)) throw new ConnectionError(400, 'Use the authenticated account (me).');
    if (['max_results','limit','page_size','count','max_results_per_calendar'].includes(key) && Number(args[key]) > 25) throw new ConnectionError(400, 'Read at most 25 records at a time.');
  }
  if (args.auto_paginate === true) throw new ConnectionError(400, 'Automatic unbounded pagination is unavailable. Read one page at a time.');
  return args;
}

export async function requireActiveAccount(db: SupabaseClient, userId: string, toolkit: string) {
  const session = await composioSession(db, userId);
  const state = await composioAPI(`tool_router/session/${encodeURIComponent(session)}/toolkits?toolkits=${encodeURIComponent(toolkit)}`);
  const account = state.items?.find((item: Data) => item.slug === toolkit)?.connected_account;
  if (!account || account.user_id !== userId || account.status !== 'ACTIVE' || account.is_disabled) throw new ConnectionError(409, `Connect ${toolkit} in Connected services before running this action.`);
  return session;
}

// Compact data for the model. Never persist raw provider/OAuth envelopes.
export function safeToolResult(result: Data) {
  const envelope = result.data?.response || result.data || {};
  const status = Number(envelope.status_code || envelope.statusCode || 0);
  if (result.result_type !== 'completed' || !result.log_id || result.error || result.data?.successful === false || envelope.error || envelope.http_error || envelope.successful === false || status >= 400) {
    const providerError=[envelope.message,envelope.http_error,envelope.error,result.error].filter(value=>typeof value==='string').join(' ');
    if(status===403&&/instagram account.*(?:not business or creator|personal account)/i.test(providerError))throw new ConnectionError(409,'Instagram requires a Business or Creator account. Switch to a professional account in Instagram, then retry. Your existing Composio connection is preserved.',result.log_id);
    throw new ConnectionError(502, `The provider did not confirm success${status ? ` (HTTP ${status})` : ''}.`, result.log_id);
  }
  const clean = (value: any, depth = 0): any => {
    if (depth > 7) return undefined;
    if (typeof value === 'string') return value.slice(0, 5000);
    if (Array.isArray(value)) return value.slice(0, 25).map(item => clean(item, depth + 1));
    if (value && typeof value === 'object' && value.mimeType === 'text/plain' && typeof value.body?.data === 'string') {
      try { const binary = atob(value.body.data.replaceAll('-', '+').replaceAll('_', '/')); return { mimeType: 'text/plain', text: new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0))).slice(0, 5000) }; } catch { return { mimeType: 'text/plain', text: 'Message content could not be decoded.' }; }
    }
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !/(access.?token|refresh.?token|api.?key|password|secret|attachment|raw|avatar|photo)/i.test(key)).slice(0, 60).map(([key, item]) => [key, clean(item, depth + 1)]));
    return value;
  };
  const data = clean(envelope.data || envelope);
  const encoded = JSON.stringify(data);
  return encoded.length > 32000 ? { truncated: true, excerpt: encoded.slice(0, 32000) } : data;
}

export async function executeDiscoveredRead(db: SupabaseClient, userId: string, tool: DiscoveredTool, args: Data, conversationId?: string, requestId?: string,dayWindow?:DayWindow) {
  if (tool.requiresConfirmation) throw new ConnectionError(409, 'This action requires confirmation.');
  const session = await requireActiveAccount(db, userId, tool.toolkit);
  const started = new Date().toISOString();
  const metadata: Data = { provider: 'composio', toolkit: tool.toolkit, conversation_id: conversationId, request_id: requestId, execution: { version: 1, phase: 'running', activity: `Reading ${tool.toolkit}`, updatedAt: started, steps: [{ label: 'Connected account verified', at: started }] } };
  const { data: run, error } = await db.from('agent_tool_runs').insert({ user_id: userId, action_name: tool.name, status: 'running', input_summary: `Read ${tool.toolkit}`, started_at: started, metadata }).select('id').single();
  if (error || !run) throw new ConnectionError(500, 'Execution tracking could not start.');
  try {
    const providerStarted=Date.now();
    const result = await composioAPI(`tool_router/session/${encodeURIComponent(session)}/execute`, 'POST', { tool_slug: tool.name, arguments: args });
    metadata.timings={providerMs:Date.now()-providerStarted};
    metadata.logId = result.log_id || null;
    const original = safeToolResult(result);
    const data=dayWindow&&tool.name==='GMAIL_FETCH_EMAILS'?filterEmailDay(original,dayWindow):original;
    if(tool.toolkit==='gmail'&&Array.isArray(data.messages)&&!data.messages.length){delete data.message;delete data.status;}
    if(data.verifiedDateWindow)data.verifiedDateWindow={date:data.verifiedDateWindow.date,timezone:data.verifiedDateWindow.timezone};
    if(dayWindow)metadata.dateWindow=dayWindow;
    const now = new Date().toISOString();
    metadata.execution = { ...metadata.execution, phase: 'completed', activity: `${tool.toolkit} read completed`, updatedAt: now, steps: [...metadata.execution.steps, { label: 'Provider returned a confirmed result', at: now }], result: { title: `${tool.toolkit} read completed`, excerpt: 'Retrieved account data. The reply below summarizes the results.' } };
    if(tool.name==='GOOGLE_MAPS_GET_ROUTE'){const route=mapRouteResult(data,args,now);if(route)metadata.execution.result={title:'Google Maps route',route};}
    const preview=servicePreview(tool.toolkit,data,now);if(preview)metadata.execution.result.preview=preview;
    const saved = await db.from('agent_tool_runs').update({ status: 'completed', finished_at: now, output_summary: `${tool.name} completed`, metadata }).eq('id', run.id).eq('user_id', userId);
    if (saved.error) throw new ConnectionError(500, 'The result could not be recorded.');
    return { ok: true, data, logId: result.log_id, retrievedAt: now, toolkit: tool.toolkit };
  } catch (error) {
    const now = new Date().toISOString();
    const message=error instanceof ConnectionError?error.message:'Read failed. Check authorization or retry.';
    await db.from('agent_tool_runs').update({ status: 'failed', finished_at: now, error_message: message, metadata: { ...metadata, execution: { ...metadata.execution, phase: 'failed', reason:message, updatedAt: now } } }).eq('id', run.id).eq('user_id', userId);
    throw error;
  }
}
