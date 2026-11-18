import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';
import { composioAPI, ConnectionError } from './connections.ts';
import type { ExecutionState } from './execution.ts';
import { composioReadTools, readArguments, readResult } from './composioReads.ts';
import {servicePreview} from './servicePreview.ts';
export { composioReadTools };

export async function composioSession(db: SupabaseClient, userId: string) {
  const { data, error } = await db.from('composio_sessions').select('session_id').eq('user_id', userId).maybeSingle();
  if (error) throw new ConnectionError(500, 'The Composio session could not be loaded.');
  if (data) return data.session_id as string;
  const session = await composioAPI('tool_router/session', 'POST', { user_id: userId });
  if (typeof session.session_id !== 'string') throw new ConnectionError(502, 'Composio returned an invalid session.');
  const { error: insertError } = await db.from('composio_sessions').insert({ user_id: userId, session_id: session.session_id });
  if (insertError?.code === '23505') {
    const { data: winner, error } = await db.from('composio_sessions').select('session_id').eq('user_id', userId).single();
    if (error || !winner) throw new ConnectionError(500, 'The Composio session could not be reserved.');
    return winner.session_id as string;
  }
  if (insertError) throw new ConnectionError(500, 'The Composio session could not be saved.');
  return session.session_id as string;
}

export async function executeComposioRead(db: SupabaseClient, userId: string, name: string, args: Record<string, unknown>, conversationId?: string, requestId?: string) {
  const tool = composioReadTools.find(tool => tool.name === name);
  if (!tool) throw new ConnectionError(400, 'Choose one of the supported read operations.');
  let arguments_: Record<string, unknown>;
  try { arguments_ = readArguments(name, args); }
  catch { throw new ConnectionError(400, 'Invalid arguments for this read operation.'); }
  const sessionId = await composioSession(db, userId);
  const path = `tool_router/session/${encodeURIComponent(sessionId)}`;
  const connection = await composioAPI(`${path}/toolkits?toolkits=${encodeURIComponent(tool.toolkit)}`);
  const account = connection.items?.find((item: Record<string, any>) => item.slug === tool.toolkit)?.connected_account;
  if (!account || account.user_id !== userId || account.status !== 'ACTIVE' || account.is_disabled) {
    return { ok: false, needsConnection: true, toolkit: tool.toolkit, message: `Connect ${tool.toolkit} in Settings → Connected services first.` };
  }
  const startedAt = new Date().toISOString();
  const execution: ExecutionState = { version: 1, phase: 'running', activity: tool.description, updatedAt: startedAt, steps: [{ label: 'Connected account verified', at: startedAt }] };
  const metadata = { provider: 'composio', toolkit: tool.toolkit, sessionId, logId: null as string | null, conversation_id: conversationId || null, request_id: requestId || null, execution };
  const { data: run, error } = await db.from('agent_tool_runs').insert({ user_id: userId, action_name: name, status: 'running',
    input_summary: tool.description, started_at: startedAt, metadata }).select('id').single();
  if (error || !run) throw new ConnectionError(500, 'The execution record could not be created.');
  try {
    const providerStarted=Date.now();
    // Match the working session.execute() shape and use the verified user's
    // session account. An explicit selector was rejected by this session;
    // do not substitute an unverified account alias.
    const result = await composioAPI(`${path}/execute`, 'POST', { tool_slug: name, arguments: arguments_ });
    Object.assign(metadata,{timings:{providerMs:Date.now()-providerStarted}});
    metadata.logId = result.log_id || null;
    let output: ReturnType<typeof readResult>;
    try { output = readResult(name, result); }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Provider read failed.';
      execution.phase = 'failed'; execution.reason = message; execution.updatedAt = new Date().toISOString();
      const { error: saveError } = await db.from('agent_tool_runs').update({ status: 'failed', finished_at: execution.updatedAt, error_message: message, metadata }).eq('id', run.id).eq('user_id', userId);
      if (saveError) throw new ConnectionError(500, 'The failed read could not be recorded.');
      return { ok: false, toolkit: tool.toolkit, logId: metadata.logId, message };
    }
    execution.phase = 'completed';
    execution.updatedAt = new Date().toISOString();
    execution.steps.push({ label: 'Provider returned a confirmed result', at: execution.updatedAt });
    // Save only compact, genuine result metrics; never persist raw OAuth or
    // provider payloads in the execution card.
    const label = ({ twitter: 'X', reddit: 'Reddit', trello: 'Trello', jira: 'Jira', github: 'GitHub', gmail: 'Gmail', googlecalendar: 'Google Calendar' } as Record<string,string>)[tool.toolkit];
    execution.result = { title: `${label} read completed`, columns: ['Result', 'Value'], rows: [['Records returned', String(output.count)]] };
    const preview=servicePreview(tool.toolkit,output.data,execution.updatedAt);
    if(preview)execution.result.preview=preview;
    const { error: saveError } = await db.from('agent_tool_runs').update({ status: 'completed', finished_at: new Date().toISOString(),
      output_summary: `${label} read completed; ${output.count} records; Composio log ${result.log_id}`,
      error_message: null, metadata }).eq('id', run.id).eq('user_id', userId);
    if (saveError) throw new ConnectionError(500, 'The Composio result could not be recorded.');
    // Return only what these read operations need, excluding unrelated private
    // profile fields. Do not persist provider payloads or OAuth tokens in logs.
    return { ok: true, logId: result.log_id, toolkit: tool.toolkit, data: output.data };
  } catch (error) {
    execution.phase = 'failed'; execution.updatedAt = new Date().toISOString();
    await db.from('agent_tool_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: 'The Composio read failed. Check the provider request/log ID.', metadata }).eq('id', run.id).eq('user_id', userId);
    throw error;
  }
}
