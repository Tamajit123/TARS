import {checkPublicRobots} from './robotsPolicy.ts';
import {createProviderRegistry} from './providerRegistry.ts';
import {assertPublicTarget,BrowserError} from './browser.ts';
import {safeResultUrl,sourceText,type Source,type IntentCategory} from './richResponse.ts';
import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.118.0';
export class ResearchError extends Error{constructor(message:string,readonly status=502){super(message);}}
type Data=Record<string,any>;
export type ResearchResult={ok:true;title:string;provider:string;sources:Source[];retrievedAt:string;expiresAt:string;cached:boolean;durationMs:number;limitations:string[]};
export const researchCapabilities=()=>[
  {name:'browserbase_search',capabilities:['search','discovery'],configured:Boolean(Deno.env.get('BROWSERBASE_API_KEY'))&&Deno.env.get('BROWSERBASE_SEARCH_ENABLED')==='true',credential:'BROWSERBASE_API_KEY',timeoutMs:20000,freshness:'Search excerpts may be cached by the upstream provider; not live availability.'},
  {name:'browserbase_fetch',capabilities:['fetch','extraction'],configured:Boolean(Deno.env.get('BROWSERBASE_API_KEY'))&&Deno.env.get('BROWSERBASE_FETCH_ENABLED')==='true',credential:'BROWSERBASE_API_KEY',timeoutMs:20000,freshness:'Retrieved page content; no guarantee of bookable offers.'},
  {name:'browserbase_cloud',capabilities:['javascript','navigation','live_preview'],configured:Boolean(Deno.env.get('BROWSERBASE_API_KEY')),credential:'BROWSERBASE_API_KEY',timeoutMs:60000,freshness:'Actual navigated page; no authentication or transactions.'},
  ...['flights','hotels','car_rentals','shopping','weather'].map(name=>({name:name+'_api',capabilities:[name],configured:false,credential:'No dedicated adapter/credential configured',timeoutMs:0,freshness:'Use sourced discovery; no invented live offers.'})),
];
export function researchRegistry(){return createProviderRegistry(researchCapabilities().filter(value=>['browserbase_search','browserbase_fetch'].includes(value.name)).map(value=>({definition:{...value,authentication:'Server secret '+value.credential,inputSchema:{type:'string',maxLength:value.name.endsWith('search')?200:2000},outputSchema:{type:'object',required:['ok','sources','retrievedAt','expiresAt'],contract:'ResearchResult v1'},rateLimit:'2 concurrent / 16 per minute per owner; 6 concurrent globally',errorFormat:{code:'HTTP status',message:'Safe provider failure; no raw response or credentials'},sourceMetadata:['title','url','provider','kind','retrievedAt','expiresAt','cached','excerpt']},execute:(input:string,category:IntentCategory,signal?:AbortSignal)=>retrieveResearch(value.name.endsWith('search')?'search':'fetch',input,category,signal)})));}
const inflight=new Map<string,Promise<ResearchResult>>();let active=0;
export function researchExpiry(category:IntentCategory){return ['flights','hotels','car_rentals','weather','finance'].includes(category)?60000:['news','events','jobs','shopping','subscriptions'].includes(category)?300000:1800000;}
async function bb(path:string,body:Data,signal?:AbortSignal){
  const key=Deno.env.get('BROWSERBASE_API_KEY');if(!key)throw new ResearchError('Browserbase is not configured.',503);
  let response:Response;try{response=await fetch('https://api.browserbase.com/v1/'+path,{method:'POST',headers:{'x-bb-api-key':key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});}catch{if(signal?.aborted)throw new ResearchError('Research was cancelled.',499);throw new ResearchError('Browserbase '+path+' timed out. Retry later.',504);}
  if(!response.ok){await response.body?.cancel();throw new ResearchError('Browserbase '+path+' returned HTTP '+response.status+'. Check account access or quota.',response.status);}
  const raw=await response.text();if(raw.length>5500000)throw new ResearchError('The page exceeds the supported response size.');
  try{return JSON.parse(raw);}catch{throw new ResearchError('Browserbase returned invalid data.');}
}
const htmlText=(text:string)=>sourceText(text.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
export async function retrieveResearch(action:'search'|'fetch',input:string,category:IntentCategory,signal?:AbortSignal):Promise<ResearchResult>{
  if(!input.trim()||input.length>(action==='search'?200:2000))throw new ResearchError('Use a concise search or public HTTPS URL.',400);
  const start=Date.now(),retrievedAt=new Date().toISOString(),provider='browserbase_'+action;const sources:Source[]=[];
  if(action==='search'){
    const result=await bb('search',{query:input.trim(),provider:'parallel',mode:'fast',numResults:6,excerpts:true,maxAgeHours:1},signal);
    if(!Array.isArray(result.results))throw new ResearchError('Search returned no verified results array.');
    const seen=new Set<string>();for(const row of result.results){const url=safeResultUrl(row.url);if(!url||seen.has(url)||typeof row.title!=='string')continue;seen.add(url);sources.push({id:'s'+(sources.length+1),title:sourceText(row.title,300),url,provider,retrievedAt,kind:'search',excerpt:sourceText((Array.isArray(row.excerpts)?row.excerpts.join('\n'):row.description||'').slice(0,6000)),...(safeResultUrl(row.image)?{image:safeResultUrl(row.image)!}:{}),...(typeof row.publishedDate==='string'&&Number.isFinite(Date.parse(row.publishedDate))?{publishedAt:new Date(row.publishedDate).toISOString()}:{})});if(sources.length===6)break;}
  }else{
    const url=await assertPublicTarget(input);try{await checkPublicRobots(url,signal);}catch(error){throw new ResearchError(error instanceof Error?error.message:'Robots verification failed.',403);}
    const page=await bb('fetch',{url:url.href,allowRedirects:false,allowInsecureSsl:false,proxies:false,format:'raw'},signal);
    if(page.statusCode!==200)throw new ResearchError('The source page returned HTTP '+page.statusCode+'. Redirects, sign-ins and challenges are not bypassed.',page.statusCode||502);
    if(typeof page.content!=='string'||!/text\/(html|plain)|application\/(json|xhtml)/i.test(page.contentType||''))throw new ResearchError('This source is not a supported text page.');
    if(/captcha|verify you are human|access denied|checking your browser/i.test(page.content.slice(0,15000)))throw new ResearchError('The source is blocked by a challenge. Choose another permitted source.',403);
    const title=page.content.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||url.hostname;
    sources.push({id:'s1',title:sourceText(title,300),url:url.href,provider,retrievedAt,kind:'page',excerpt:htmlText(page.content)});
  }
  const expiresAt=new Date(Date.now()+researchExpiry(category)).toISOString();
  return {ok:true,title:action==='search'?'Search results':'Source page',provider,sources:sources.map(source=>({...source,expiresAt})),retrievedAt,expiresAt,cached:false,durationMs:Date.now()-start,limitations:action==='search'?['Search excerpts may be upstream cached; verify current prices and availability on the original site.']:['A retrieved page is not a guarantee of price or availability at checkout.']};
}
export async function executeResearch(db:SupabaseClient,owner:string,action:'search'|'fetch',input:string,category:IntentCategory,conversationId?:string,requestId?:string,signal?:AbortSignal){
  const enabled=Deno.env.get(action==='search'?'BROWSERBASE_SEARCH_ENABLED':'BROWSERBASE_FETCH_ENABLED')==='true';if(!enabled)throw new ResearchError('Browserbase '+action+' access has not been enabled on this project.',503);
  const key=action+'|'+category+'|'+(action==='search'?input.trim().toLowerCase():input.trim()),operation=owner+'|'+key;

  const task=(async()=>{
    if(active>=3)throw new ResearchError('Research is busy. Retry after the current requests finish.',429);active++;
    let runId:string|undefined;
    try{
      const {data:cached}=await db.from('agent_tool_runs').select('metadata').eq('user_id',owner).eq('action_name','research_'+action).eq('status','completed').eq('metadata->research->>key',key).order('created_at',{ascending:false}).limit(1).maybeSingle();
      const previous=cached?.metadata?.research?.result as ResearchResult|undefined;
      const usable=previous?.ok&&Date.parse(previous.expiresAt)>Date.now();
      const metadata:Data={provider:'web_search',researchProvider:'browserbase_'+action,conversation_id:conversationId||null,request_id:requestId||null,research:{key},execution:{version:1,phase:'running',activity:action==='search'?'Searching sources':'Fetching source',updatedAt:new Date().toISOString(),steps:[{label:usable?'Using a dated cached result':'Requesting original sources',at:new Date().toISOString()}]}};
      const reserved=await db.rpc('claim_tars_research_run',{p_owner:owner,p_action:'research_'+action,p_input:input,p_metadata:metadata});if(reserved.error)throw new ResearchError('Research execution could not be reserved.');if(!reserved.data)throw new ResearchError('Research concurrency or rate limit reached. Retry later.',429);runId=reserved.data;
      const result:ResearchResult=usable?{...previous,cached:true,sources:previous.sources.map(source=>({...source,cached:true}))}:await sharedRetrieval(operation,action,input,category,signal);
      metadata.research.result=result;metadata.execution={...metadata.execution,phase:'completed',activity:result.sources.length?'Sources retrieved':'No results returned',updatedAt:new Date().toISOString(),result:{title:result.title,excerpt:result.sources.length+' original sources'+(result.cached?' · cached':''),links:result.sources.filter(s=>s.url).map(s=>({text:s.title,url:s.url}))}};
      const stored=await db.from('agent_tool_runs').update({status:'completed',finished_at:new Date().toISOString(),output_summary:result.sources.length+' sources retrieved',metadata}).eq('id',runId).eq('user_id',owner);if(stored.error)throw new ResearchError('The research result could not be saved.');return result;
    }catch(error){if(runId)await db.from('agent_tool_runs').update({status:signal?.aborted?'cancelled':'failed',finished_at:new Date().toISOString(),error_message:error instanceof ResearchError||error instanceof BrowserError?error.message:'Research failed.'}).eq('id',runId).eq('user_id',owner);throw error;}finally{active--;}
  })();return await task;
}

async function sharedRetrieval(key:string,action:'search'|'fetch',input:string,category:IntentCategory,signal?:AbortSignal){
  // Cancellation belongs to the originating request. Do not attach another user
  // or request to its abort signal; only identical work in that request dedupes.
  const scoped=key+'|'+(signal?signalId(signal):'none');
  const previous=inflight.get(scoped);if(previous)return previous;
  const adapter=researchRegistry().get('browserbase_'+action);if(!adapter?.definition.configured)throw new ResearchError('The selected research provider is unavailable.',503);
  const task=adapter.execute(input,category,signal);inflight.set(scoped,task);
  try{return await task;}finally{inflight.delete(scoped);}
}
const signalIds=new WeakMap<AbortSignal,string>();let nextSignal=0;
function signalId(signal:AbortSignal){if(!signalIds.has(signal))signalIds.set(signal,String(++nextSignal));return signalIds.get(signal)!;}
