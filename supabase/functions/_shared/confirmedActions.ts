import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';
import { composioAPI, ConnectionError } from './connections.ts';
import { requireActiveAccount, safeToolResult, validatedToolArgs, type DiscoveredTool } from './toolRegistry.ts';
import { reviewedTools } from './reviewedTools.ts';
import {confirmReminder} from './reminderActions.ts';
type Data = Record<string, any>;

export async function prepareAction(db: SupabaseClient, userId: string, tool: DiscoveredTool, args: Data, conversationId?: string, requestId?: string) {
  if (!tool.requiresConfirmation || !conversationId || !requestId || !reviewedTools.some(item => item.name === tool.name && item.requiresConfirmation)) throw new ConnectionError(400, 'This action cannot be prepared here.');
  await requireActiveAccount(db, userId, tool.toolkit);
  const { data: thread } = await db.from('chat_threads').select('id').eq('id', conversationId).eq('user_id', userId).maybeSingle();
  if (!thread) throw new ConnectionError(404, 'Conversation unavailable.');
  const { data, error } = await db.from('pending_tool_actions').upsert({ user_id: userId, conversation_id: conversationId, request_id: requestId, tool_slug: tool.name, toolkit: tool.toolkit, arguments: args, input_schema: tool.parameters, summary: `${tool.name.replaceAll('_', ' ')} in ${tool.toolkit}` }, { onConflict: 'user_id,conversation_id,request_id,tool_slug', ignoreDuplicates: true }).select('id').maybeSingle();
  if (error) throw new ConnectionError(500, 'The confirmation could not be saved. No external action was taken.');
  const saved = data || (await db.from('pending_tool_actions').select('id').eq('user_id', userId).eq('conversation_id', conversationId).eq('request_id', requestId).eq('tool_slug', tool.name).single()).data;
  return { ok: false, requiresConfirmation: true, actionId: saved?.id, message: 'Prepared only. Ask the user to review and confirm the exact details in the confirmation card. Nothing has been sent or changed.' };
}

export async function confirmAction(db: SupabaseClient, userId: string, actionId: string, cancel = false) {
  if (!/^[0-9a-f-]{36}$/i.test(actionId)) throw new ConnectionError(400, 'Choose a valid confirmation.');
  const { data: action, error } = await db.from('pending_tool_actions').select('*').eq('id', actionId).eq('user_id', userId).maybeSingle();
  if (error || !action) throw new ConnectionError(404, 'This confirmation is unavailable.');
  if (action.status === 'completed') return { ok: true, status: 'completed', result: action.result };
  if(!cancel&&action.tool_slug==='TARS_CREATE_REMINDER'&&action.toolkit==='tars'&&action.status==='executing')return confirmReminder(db,userId,action);
  if (action.status !== 'pending') throw new ConnectionError(409, action.status === 'executing' ? 'This action is already executing. Do not submit it again.' : 'This action is no longer pending. Check the provider before preparing another attempt.');
  if (Date.parse(action.expires_at) <= Date.now()) throw new ConnectionError(409, 'This confirmation expired. Ask TARS to prepare it again.');
  if (cancel) {
    const saved = await db.from('pending_tool_actions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', actionId).eq('user_id', userId).eq('status','pending').select('id').maybeSingle();
    if (saved.error || !saved.data) throw new ConnectionError(409, 'This confirmation changed. Refresh its status.');
    return { ok: true, status: 'cancelled' };
  }
  if(action.tool_slug==='TARS_CREATE_REMINDER'&&action.toolkit==='tars')return confirmReminder(db,userId,action);
  const reviewed = reviewedTools.find(tool => tool.name === action.tool_slug && tool.toolkit === action.toolkit && tool.requiresConfirmation);
  if (!reviewed) throw new ConnectionError(400, 'This action is no longer supported.');
  const tool: DiscoveredTool = { ...reviewed, parameters: action.input_schema };
  const args = validatedToolArgs(tool, JSON.stringify(action.arguments));
  const session = await requireActiveAccount(db, userId, action.toolkit);
  // One atomic claim. A timeout/unknown result is never automatically retried.
  const claim = await db.from('pending_tool_actions').update({ status: 'executing', updated_at: new Date().toISOString() }).eq('id', actionId).eq('user_id', userId).eq('status','pending').select('id').maybeSingle();
  if (claim.error || !claim.data) throw new ConnectionError(409, 'This action was already submitted.');
  try {
    const response = await composioAPI(`tool_router/session/${encodeURIComponent(session)}/execute`, 'POST', { tool_slug: action.tool_slug, arguments: args });
    const result = { data: safeToolResult(response), logId: response.log_id };
    const saved = await db.from('pending_tool_actions').update({ status:'completed', result, updated_at: new Date().toISOString() }).eq('id', actionId).eq('user_id', userId);
    if (saved.error) throw new Error('Persistence unavailable after provider execution');
    return { ok: true, status: 'completed', result };
  } catch {
    await db.from('pending_tool_actions').update({ status:'failed', result:{ message:'Execution could not be confirmed. Check the provider before repeating this action.' }, updated_at:new Date().toISOString() }).eq('id', actionId).eq('user_id', userId);
    throw new ConnectionError(502, 'Execution could not be confirmed. Check the provider before repeating this action.');
  }
}
