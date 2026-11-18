import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';
import { readPublicPage } from './browser.ts';
import { availableBrowser, publicSourceUrl, type ToolExecution } from './execution.ts';
import { ConnectionError } from './connections.ts';

/** Refresh only a real browser execution owned by this authenticated user.
 * No arbitrary caller URL, provider credential or model execution is accepted. */
export async function refreshBrowserPreview(db: SupabaseClient, userId: string, runId: unknown) {
  if (typeof runId !== 'string' || !/^[0-9a-f-]{36}$/i.test(runId)) throw new ConnectionError(400,'Choose a valid browser activity.');
  const { data: run, error } = await db.from('agent_tool_runs').select('id,user_id,status,action_name,metadata,created_at').eq('id',runId).eq('user_id',userId).maybeSingle();
  if (error || !run || run.metadata?.provider !== 'browserbase' || run.status !== 'completed') throw new ConnectionError(404,'This browser activity is unavailable.');
  const current = availableBrowser(run as ToolExecution);
  if (current) return {ok:true,preview:{liveUrl:current,expiresAt:run.metadata.execution.browser.expiresAt}};
  const source = publicSourceUrl(run.metadata.sourceUrl || run.metadata.execution?.result?.url);
  if (!source) throw new ConnectionError(400,'This activity has no public page to reopen.');
  if (Date.parse(run.metadata.preview_requested_at || '') > Date.now()-30000) throw new ConnectionError(429,'A browser preview is already starting. Wait a moment before trying again.');
  const metadata = {...run.metadata,preview_requested_at:new Date().toISOString()};
  const claim = await db.from('agent_tool_runs').update({metadata}).eq('id',runId).eq('user_id',userId).eq('metadata',JSON.stringify(run.metadata)).select('id').maybeSingle();
  if (claim.error || !claim.data) throw new ConnectionError(409,'This browser preview changed. Refresh and try again.');
  try {
    let preview: {liveUrl:string;expiresAt:string} | undefined;
    const page = await readPublicPage(source.href,async view=>{preview={liveUrl:view.liveUrl,expiresAt:view.expiresAt};});
    if (!preview?.liveUrl || !page.previewExpiresAt || Date.parse(preview.expiresAt)<=Date.now()) throw new Error('No live preview available');
    metadata.execution={...metadata.execution,browser:{sessionId:page.sessionId,available:true,...preview}};
    const saved = await db.from('agent_tool_runs').update({metadata}).eq('id',runId).eq('user_id',userId);
    if (saved.error) throw new Error('The preview state could not be saved');
    return {ok:true,preview};
  } catch { throw new ConnectionError(502,'The browser preview could not start. Your saved answer is still available.'); }
}
