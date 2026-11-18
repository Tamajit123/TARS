import { refreshBrowserPreview } from '../_shared/browserPreview.ts';
import {ownedReplyStatus} from '../_shared/replyStatus.ts';
import {retrieveResearch,researchCapabilities} from '../_shared/researchProviders.ts';
import {diagnoseProviders} from '../_shared/providerDiagnostics.ts';
import {executeGoogleMaps} from '../_shared/googleMaps.ts';
import {ensureMapsAuthConfig} from '../_shared/mapsSetup.ts';
import { confirmAction } from '../_shared/confirmedActions.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { generateReply, getProviderHealth, ProviderError, providerMessage } from '../_shared/ai.ts';
import { composioAPI, toolkitMetadata, ConnectionError, getConnectionHealth, handleConnectionRequest } from '../_shared/connections.ts';
import { readPublicPage } from '../_shared/browser.ts';
import { generateAgentReply } from '../_shared/agent.ts';
import {classifyRequest} from '../_shared/universalAgent.ts';
import { executeComposioRead } from '../_shared/composio.ts';
import {executeDiscoveredRead,validatedToolArgs} from '../_shared/toolRegistry.ts';

type JsonRecord = Record<string, any>;
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
const json = (body: JsonRecord, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const mustGetEnv = (name: string) => { const value = Deno.env.get(name); if (!value) throw new HttpError(503, `${name} is not configured on the server.`); return value; };
const createAdminClient = () => createClient(mustGetEnv('SUPABASE_URL'), mustGetEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
type AdminClient = ReturnType<typeof createAdminClient>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Use POST.' }, 405);
  try {
    const text = await req.text();
    if (text.length > 16_000) throw new HttpError(413, 'Request too large.');
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Use a JSON object.');
    const supabase = createAdminClient();
    // Maintenance probes use the same reviewed read pipeline as chat. They
    // require the existing scheduler secret and cannot execute arbitrary tools.
    if(body.mode==='read_only_diagnostic'){
      if(req.headers.get('authorization')!==`Bearer ${mustGetEnv('SCHEDULER_SECRET')}`)throw new HttpError(401,'Unauthorized.');
      if(typeof body.owner!=='string'||!/^[0-9a-f-]{36}$/i.test(body.owner))throw new HttpError(400,'Choose an existing owner.');
      const {data:profile}=await supabase.from('profiles').select('id').eq('id',body.owner).single();
      if(!profile)throw new HttpError(404,'Existing owner not found.');
      const start=Date.now();
      if(body.probe==='log'){
        if(typeof body.logId!=='string'||!/^log_[\w-]{5,100}$/.test(body.logId))throw new HttpError(400,'Choose a valid log ID.');
        const {data:owned}=await supabase.from('agent_tool_runs').select('id').eq('user_id',body.owner).eq('metadata->>logId',body.logId).limit(1).maybeSingle();
        if(!owned)throw new HttpError(404,'Owned execution not found.');
        const log=await composioAPI(`logs/tool_execution/${encodeURIComponent(body.logId)}`);
        const errors:JsonRecord={};
        const project=(value:unknown,path='',depth=0)=>{if(depth>9||!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(/request|headers|token|secret|credential|authorization/i.test(key))continue;const next=`${path}.${key}`;if(/^(error|error_message|message|code|error_subcode|error_user_msg|error_user_title|status_code|type)$/.test(key)&&(typeof item==='string'||typeof item==='number'))errors[next]=typeof item==='number'?item:String(item).replace(/(?:Bearer\s+\S+|(?:access_token|refresh_token|api_key|client_secret)["'\s:=]+[^\s",}]+)/gi,'[redacted]').slice(0,600);else if(item&&typeof item==='object')project(item,next,depth+1);}};
        project(log.data);return json({ok:true,logId:body.logId,status:log.status,dataKeys:Object.keys(log.data||{}),errors});
      }
      const extraReads:Record<string,{toolkit:string;args:JsonRecord}>={SLACK_LIST_ALL_CHANNELS:{toolkit:'slack',args:{limit:1,types:'public_channel'}},NOTION_SEARCH_NOTION_PAGE:{toolkit:'notion',args:{query:'',page_size:1}},INSTAGRAM_GET_USER_INFO:{toolkit:'instagram',args:{ig_user_id:'me',fields:'id,username'}}};
      if(extraReads[body.tool]){
        try{
          const chosen=extraReads[body.tool],metadata=await composioAPI(`tools/${encodeURIComponent(body.tool)}`);
          if(metadata.toolkit?.slug!==chosen.toolkit||!metadata.input_parameters)throw new HttpError(502,'The live read schema did not match the reviewed provider.');
          const tool={name:body.tool,toolkit:chosen.toolkit,description:'Read-only release verification',parameters:metadata.input_parameters,requiresConfirmation:false};
          const result=await executeDiscoveredRead(supabase,body.owner,tool,validatedToolArgs(tool,JSON.stringify(chosen.args)));
          return json({ok:true,toolkit:chosen.toolkit,logId:result.logId,durationMs:Date.now()-start});
        }catch(error){return json({ok:false,code:error instanceof ConnectionError?error.status:502,logId:error instanceof ConnectionError?error.requestId:undefined,error:error instanceof ConnectionError?error.message:'The reviewed read could not run.'});}
      }
      if(body.probe==='maps'){
        const result=await executeGoogleMaps(supabase,body.owner,'maps_compute_route',{origin:'12.9170,77.6227',destination:'12.9569,77.7011',mode:'DRIVE'},undefined,undefined,req.signal,true);
        return json({ok:result.ok,durationMs:Date.now()-start,...('error' in result?{error:result.error}:{route:result.result?.route})});
      }
      const result=await executeComposioRead(supabase,body.owner,body.tool,{});
      return json({ok:result.ok,durationMs:Date.now()-start,toolkit:result.toolkit,logId:'logId' in result?result.logId:null,message:'message' in result?result.message:undefined,needsConnection:'needsConnection' in result?result.needsConnection:undefined});
    }
    if(body.mode==='universal_health'){
      if(req.headers.get('authorization')!==`Bearer ${mustGetEnv('SCHEDULER_SECRET')}`)throw new HttpError(401,'Unauthorized.');
      if(typeof body.owner==='string'&&/^[0-9a-f-]{36}$/i.test(body.owner)){
        const start=Date.now();let blocks:unknown,plan:unknown;const issues:string[]=[];try{const reply=await generateAgentReply([{role:'user',content:body.case==='laptop'?'Find two laptops under INR 80,000 from Indian retailers with native product cards, verified specifications and sourced listed prices.':'Compare Netflix, Spotify and YouTube Premium subscriptions in India using official sources.'}],supabase,body.owner,undefined,undefined,{onPresentationError:message=>{issues.push(message);},onPlan:value=>{plan=value;},onRichResponse:value=>{blocks=value.blocks.map(block=>({type:block.type,items:block.items?.length,rows:block.rows?.length}));}});return json({ok:true,characters:reply.length,blocks,plan,issues,durationMs:Date.now()-start});}catch(error){return json({ok:false,code:error instanceof ProviderError?error.code:'server_error',diagnostic:error instanceof ProviderError?error.diagnostic:{},issues,durationMs:Date.now()-start});}
      }
      const results=[];for(const query of ['Find the cheapest flight from BLR to CCU on 29 November 2026.','Research Browserbase using two reliable sources.']){const start=Date.now();try{results.push({ok:true,plan:await classifyRequest(query,''),durationMs:Date.now()-start});}catch(error){results.push({ok:false,code:error instanceof ProviderError?error.code:'invalid_plan',diagnostic:error instanceof ProviderError?error.diagnostic:undefined,message:error instanceof ProviderError?undefined:(error instanceof Error?error.message:'Invalid classification.'),durationMs:Date.now()-start});}}
      return json({results});
    }
    if(body.mode==='research_health'){
      if(req.headers.get('authorization')!==`Bearer ${mustGetEnv('SCHEDULER_SECRET')}`)throw new HttpError(401,'Unauthorized.');
      const results=[];for(const action of ['search','fetch'] as const){try{const result=await retrieveResearch(action,action==='search'?'Browserbase official live view documentation':'https://example.com','research');results.push({action,ok:true,durationMs:result.durationMs,sources:result.sources.length,provider:result.provider});}catch(error){results.push({action,ok:false,error:error instanceof Error?error.message:'Research unavailable.'});}}
      return json({capabilities:researchCapabilities(),results});
    }
    if(body.mode==='provider_diagnostics'){
      if(req.headers.get('authorization')!==`Bearer ${mustGetEnv('SCHEDULER_SECRET')}`)throw new HttpError(401,'Unauthorized.');
      const selected=['text','stream','multi_turn','long','structured','function_call'].includes(body.diagnosticCase)?body.diagnosticCase:undefined;
      return json({ok:true,diagnostics:await diagnoseProviders(selected)});
    }
    if (body.mode === 'provider_health') {
      if (req.headers.get('authorization') !== `Bearer ${mustGetEnv('SCHEDULER_SECRET')}`) throw new HttpError(401, 'Unauthorized.');
      let probe;
      let browserProbe;
      let mapsProbe;
      if (body.mapsProbe === true) {
        try { const info=await toolkitMetadata('google_maps'); const tool=await composioAPI('tools/GOOGLE_MAPS_GET_ROUTE'); mapsProbe={ok:true,authConfigId:body.ensureMapsConfig===true?await ensureMapsAuthConfig():undefined,slug:info.slug,authSchemes:info.auth_schemes,managedAuthSchemes:info.composio_managed_auth_schemes,tool:{slug:tool.slug,description:tool.description,input:tool.input_parameters}}; }
        catch(error){mapsProbe={ok:false,code:error instanceof ConnectionError?error.status:500};}
      }
      if (body.browserProbe === true) {
        try {
          let browserViewHttpStatus: number | null = null;
          const milestones: string[] = [];
          const page = await readPublicPage('https://example.com', async view => {
            if (!view.liveUrl || !(Date.parse(view.expiresAt) > Date.now())) return;
            const url = new URL(view.liveUrl);
            if (url.protocol !== 'https:' || !/(^|\.)browserbase\.com$/.test(url.hostname) || url.username || url.password) return;
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            browserViewHttpStatus = response.status;
            await response.body?.cancel();
          }, async activity => { milestones.push(activity); });
          browserProbe = { ok: true, title: page.title, characters: page.text.length, milestones, browserViewHttpStatus };
        }
        catch (error) { browserProbe = { ok: false, message: error instanceof Error ? error.message : 'Browser probe failed.' }; }
      }
      if (body.probe === true) {
        const model = typeof body.probeModel === 'string' && /^[a-z0-9][a-z0-9._-]{0,99}$/.test(body.probeModel) ? body.probeModel : undefined;
        try { let chunks = 0; const prompt=[{role:'user' as const,content:body.streamProbe ? 'Write five short sentences about how an assistant can help plan a day. Do not use external tools.' : 'Reply with exactly OK.'}]; const onEvent=body.streamProbe ? (event: {type:string})=>{if(event.type==='text.delta')chunks++;} : undefined; const output=typeof body.agentProbeUserId==='string' && /^[0-9a-f-]{36}$/i.test(body.agentProbeUserId) ? await generateAgentReply(prompt,supabase,body.agentProbeUserId,undefined,undefined,{model,onEvent}) : await generateReply(prompt,false,model,onEvent); probe={ok:true,responseCharacters:output.length,streamedChunks:chunks}; }
        catch (error) { probe = { ok: false, code: error instanceof ProviderError ? error.code : 'server_error', diagnostic: error instanceof ProviderError ? error.diagnostic : {} }; }
      }
      return json({ ok: true, gemini: await getProviderHealth(), probe, browserProbe, mapsProbe, composio: await getConnectionHealth(), browserbaseConfigured: Boolean(Deno.env.get('BROWSERBASE_API_KEY')) });
    }
    if (body.mode === 'run_due_schedules') {
      const schedulerSecret = mustGetEnv("SCHEDULER_SECRET");
      if (req.headers.get('authorization') !== `Bearer ${schedulerSecret}`) throw new HttpError(401, 'Unauthorized.');
      const { data, error } = await supabase.rpc('claim_tars_agent_runs', { p_limit: 3 });
      if (error) throw error;
      const results = await Promise.all((data || []).map((reservation: JsonRecord) => runReservation(supabase, reservation)));
      return json({ ok: true, processed: results.length, results });
    }
    const user = await resolveUser(req, supabase);
    if(body.mode==='reply_status')return json(await ownedReplyStatus(supabase,user.id,body.conversationId,body.requestId));
    if(body.mode==='maps_request'){try{return json(await executeGoogleMaps(supabase,user.id,body.action,body.arguments||{},undefined,undefined,req.signal,true));}catch(error){return json({ok:false,error:error instanceof Error?error.message:'Maps unavailable.'},400);}}
    if (body.mode === 'browser_preview') return json(await refreshBrowserPreview(supabase,user.id,body.runId));
    if (['confirm_tool_action','cancel_tool_action'].includes(body.mode)) return json(await confirmAction(supabase, user.id, body.actionId, body.mode === 'cancel_tool_action'));
    if (body.mode === 'read_integration') return json(await executeComposioRead(supabase, user.id, body.tool, body.arguments || {}));
    if (['tools_catalog', 'tool_connect', 'tool_status', 'tool_disconnect'].includes(body.mode)) return json(await handleConnectionRequest(supabase, user.id, body));
    if (body.mode === 'run_scheduled_task') {
      if (typeof body.scheduledTaskId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.scheduledTaskId)) throw new HttpError(400, 'Choose a valid task.');
      const { data, error } = await supabase.rpc('claim_tars_agent_runs', { p_task_id: body.scheduledTaskId, p_owner_id: user.id, p_limit: 1 });
      if (error) throw error;
      if (!data?.length) throw new HttpError(409, 'This task is unavailable or already running.');
      const result = await runReservation(supabase, data[0]);
      return json({ ...result, ok: result.status === 'completed' }, result.status === 'completed' ? 200 : 502);
    }
    if (body.mode === 'list_connections') {
      const key = mustGetEnv('COMPOSIO_API_KEY');
      const base = Deno.env.get('COMPOSIO_BASE_URL') || 'https://backend.composio.dev';
      const url = new URL('/api/v3.1/connected_accounts', base);
      url.searchParams.set('user_ids', user.id); url.searchParams.set('statuses', 'ACTIVE');
      const response = await fetch(url, { headers: { 'x-api-key': key }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new HttpError(502, 'Connected accounts could not be verified.');
      const accounts = await response.json();
      const providers = [...new Set((accounts.items || []).map((account: JsonRecord) => account.toolkit?.slug || account.appName?.toLowerCase()).filter(Boolean))];
      return json({ ok: true, providers });
    }
    return json({ ok: false, error: 'unsupported_mode' }, 400);
  } catch (error) {
    if (error instanceof HttpError || error instanceof ConnectionError) return json({ ok: false, message: error.message }, error.status);
    if (error instanceof SyntaxError) return json({ ok: false, message: 'Invalid JSON request.' }, 400);
    console.error('[agent-run] request failed', { code: error instanceof ProviderError ? error.code : 'server_error' });
    return json({ ok: false, message: 'The task could not be completed. Check execution history and retry.' }, 500);
  }
});

async function resolveUser(req: Request, supabase: AdminClient) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new HttpError(401, 'Sign in to run a task.');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Your session expired. Sign in again.');
  return data.user;
}

async function executeScheduledTask(schedule: JsonRecord, supabase: AdminClient, runId: string) {
  const payload = schedule.task_payload || {};
  const delivery = schedule.delivery || 'chat';
  const hasExternalAction = ['browser_task','browserTask','composio_tool_slug','composioToolSlug','composio_toolkit_slug','composioToolkitSlug','composio_arguments','composioArguments'].some((key) => payload[key] !== undefined && payload[key] !== null && payload[key] !== '');
  if (delivery !== "chat" || hasExternalAction) throw new HttpError(422, 'This task requires external tool authorization. Its external actions were not executed.');
  if (typeof schedule.original_prompt !== 'string' || !schedule.original_prompt.trim()) throw new HttpError(422, 'The saved task has no prompt.');
  // Consume Gemini's streaming transport for cloud runs too. No UI events are
  // forwarded, but the same tested incremental response parser is used.
  return generateAgentReply([{ role: 'user', content: `Execute this saved task now and return the result: ${schedule.original_prompt.slice(0, 10_000)}` }], supabase, schedule.user_id, payload.sourceThreadId, `scheduled-${runId}`, { timezone: schedule.timezone || 'UTC',onEvent:()=>{} });
}

async function runReservation(supabase: AdminClient, reservation: JsonRecord) {
  const { schedule, runId, leaseToken } = reservation;
  let stage='inference';
  try {
    const output = await executeScheduledTask(schedule, supabase, runId);
    stage='persistence';
    const { data, error } = await supabase.rpc('finish_tars_agent_run', { p_run_id: runId, p_lease_token: leaseToken, p_status: 'completed', p_output: output, p_message: output });
    if (error) throw error;
    return data;
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : error instanceof HttpError ? 'task_configuration_error' : 'execution_or_persistence_failed';
    console.error('[agent-run] scheduled execution failed', { runId, code, ...(error instanceof ProviderError ? error.diagnostic : {}) });
    const previous = await supabase.from('agent_tool_runs').select('metadata').eq('id',runId).maybeSingle();
    const safeError=error&&typeof error==='object'?error as JsonRecord:{};
    const diagnostic=error instanceof ProviderError?error.diagnostic:{stage,code:typeof safeError.code==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(safeError.code)?safeError.code:null,name:error instanceof Error?error.name:null};
    await supabase.from('agent_tool_runs').update({metadata:{...(previous.data?.metadata || {}),failure_code:code,failure_diagnostic:diagnostic}}).eq('id',runId);
    const message = error instanceof ProviderError ? providerMessage(error.code) : error instanceof HttpError ? error.message : 'Execution or result persistence failed. The server will retry due tasks up to three times.';
    const { data, error: saveError } = await supabase.rpc('finish_tars_agent_run', { p_run_id: runId, p_lease_token: leaseToken, p_status: 'failed', p_error: message });
    if (saveError) console.error('[agent-run] failure persistence failed', { runId, code: saveError.code });
    return { ...(data || { id: schedule.id, status: 'failed', runId }), message };
  }
}
