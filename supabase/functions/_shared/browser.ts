import {checkPublicRobots} from './robotsPolicy.ts';
import {searchAPI,searchProvider} from './webSearch.ts';
declare const EdgeRuntime: { waitUntil: (task: Promise<unknown>) => void } | undefined;
// Read-only cloud browsing. No model-supplied JavaScript, form submission,
// credential entry, persistent browser context, or purchase operations.
export class BrowserError extends Error { constructor(message: string, readonly reason: 'failed' | 'timed_out' | 'blocked' | 'cancelled' = 'failed') { super(message); } }
type Data = Record<string, any>;
async function browserAPI(path: string, method = 'GET', body?: Data) {
  const key = Deno.env.get('BROWSERBASE_API_KEY');
  if (!key) throw new BrowserError('Browserbase is not configured.');
  const response = await fetch(`https://api.browserbase.com/v1/${path}`, { method,
    headers: { 'x-bb-api-key': key, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new BrowserError('The cloud browser is unavailable.');
  return response.json();
}

export async function assertPublicTarget(raw:string){
  const url = new URL(raw);
  if (raw.length > 2000 || url.protocol !== 'https:' || url.port || url.username || url.password
    || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)
    || /(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(url.hostname)) throw new BrowserError('Use a public HTTPS website.');
  const addresses = await Deno.resolveDns(url.hostname, 'A');
  if (!addresses.length || addresses.some(address => /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.0\.0\.|198\.(18|19)\.|22[4-9]\.|23\d\.|24\d\.|25[0-5]\.)/.test(address))) throw new BrowserError('Private network addresses are unavailable.');
  const ipv6=await Deno.resolveDns(url.hostname,'AAAA').catch(()=>[]);
  if(ipv6.some(address=>/^(::(?:1|ffff:)|f[cd]|fe[89ab])/i.test(address)))throw new BrowserError('Private network addresses are unavailable.');
  return url;
}
async function readPublicPageSession(raw: string, onSession?: (value: { sessionId: string; liveUrl: string; expiresAt: string }) => Promise<void>, onProgress?: (activity: string) => Promise<void>,signal?:AbortSignal,onReleased?:()=>void) {
  const operationStarted=Date.now();
  if(signal?.aborted)throw new BrowserError('Browser request cancelled.','cancelled');
  const url=await assertPublicTarget(raw);
  if(Deno.env.get('BROWSERBASE_FETCH_ENABLED')==='true')try{await checkPublicRobots(url,signal);}catch(error){throw new BrowserError(error instanceof Error?error.message:'Robots verification failed.','blocked');}
  const session = await browserAPI('sessions', 'POST', { timeout: 60,
    ...(Deno.env.get('BROWSERBASE_PROJECT_ID') ? { projectId: Deno.env.get('BROWSERBASE_PROJECT_ID') } : {}),
    browserSettings: { viewport: { width: 390, height: 844 }, allowedDomains: [url.hostname], ignoreCertificateErrors: false, logSession: false, recordSession: false, solveCaptchas: false },
    userMetadata: { application: 'tars', operation: 'read_public_page' } });
  const startupMs=Date.now()-operationStarted;
  const previewUntil = Date.now() + 45000;
  let previewReady = false;
  let socket: WebSocket | undefined;
  const pending = new Map<number, { resolve: (result: Data) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const onAbort=()=>{previewReady=false;socket?.close();for(const request of pending.values()){clearTimeout(request.timer);request.reject(new BrowserError('Browser request cancelled.','cancelled'));}pending.clear();};
  signal?.addEventListener('abort',onAbort,{once:true});
  let sequence = 0;
  try {
    if(signal?.aborted)throw new BrowserError('Browser request cancelled.','cancelled');
    await onProgress?.('Connecting to the cloud browser');
    // connectUrl is a credential: it stays inside this server invocation.
    socket = new WebSocket(session.connectUrl);
    socket.addEventListener('message', event => {
      let value; try { value = JSON.parse(String(event.data)); } catch { return; }
      const request = pending.get(value.id); if (!request) return;
      clearTimeout(request.timer); pending.delete(value.id);
      if (value.error) request.reject(new BrowserError('The cloud browser command failed.')); else request.resolve(value.result || {});
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new BrowserError('The browser connection timed out.', 'timed_out')), 12000);
      socket!.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket!.addEventListener('error', () => { clearTimeout(timer); reject(new BrowserError('The browser connection failed.')); }, { once: true });
    });
    const send = (method: string, params: Data = {}, sessionId?: string): Promise<Data> => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new BrowserError('The page took too long to respond.', 'timed_out')); }, 12000);
      pending.set(id, { resolve, reject, timer }); socket!.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const attached = await send('Target.attachToTarget', { targetId, flatten: true });
    const page = attached.sessionId;
    await send('Page.enable', {}, page);
    if (onSession) {
      const debug = await browserAPI(`sessions/${encodeURIComponent(session.id)}/debug?expiresIn=60`).catch(() => ({}));
      await onSession({ sessionId: session.id, liveUrl: typeof (debug.pages?.find((entry: Data) => entry.id === targetId)?.debuggerFullscreenUrl) === 'string' ? debug.pages.find((entry: Data) => entry.id === targetId).debuggerFullscreenUrl : '', expiresAt: new Date(previewUntil).toISOString() });
    }

    const navigationStarted=Date.now();
    await onProgress?.('Opening the requested page');
    const navigation = await send('Page.navigate', { url: url.href }, page);
    if (navigation.errorText) throw new BrowserError('The website could not be opened.');
    await onProgress?.('Reading page content');
    let result: Data = {};
    for (let attempt = 0; attempt < 20; attempt++) {
      const evaluated = await send('Runtime.evaluate', {
        expression: `JSON.stringify({ready:document.readyState,url:location.href,title:document.title,text:document.body?.innerText.slice(0,16000)||'',links:[...document.querySelectorAll('a[href]')].filter(a=>a.href.startsWith('https://')&&a.innerText.trim()).slice(0,40).map(a=>({text:a.innerText.slice(0,120),url:a.href})),tables:[...document.querySelectorAll('table')].slice(0,1).map(t=>({columns:[...t.querySelectorAll('thead th')].slice(0,3).map(c=>c.innerText.slice(0,100)),rows:[...t.querySelectorAll('tbody tr')].slice(0,8).map(r=>[...r.cells].slice(0,3).map(c=>c.innerText.slice(0,180)))}))})`,
        returnByValue: true,
      }, page);
      try { result = JSON.parse(evaluated.result?.value || '{}'); } catch { /* wait for navigation */ }
      if (result.url !== 'about:blank' && result.text && result.ready === 'complete') break;
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    if (!result.text || result.url === 'about:blank') throw new BrowserError('No readable page content was returned.');
    if (/^https:\/\/([a-z.]+\.)?google\.com\/sorry\//i.test(result.url) || /^(access denied|just a moment|verify you are human)/i.test(result.title || '') || /our systems have detected unusual traffic|please solve the challenge|confirm you are a human|unfortunately, bots use duckduckgo/i.test(result.text)) throw new BrowserError('The website blocked automated access. No usable results were retrieved.', 'blocked');
    previewReady = Boolean(!signal?.aborted && onSession && typeof EdgeRuntime !== 'undefined');
    return { metrics:{startupMs,navigationAndExtractionMs:Date.now()-navigationStarted,totalMs:Date.now()-operationStarted},previewExpiresAt: previewReady ? new Date(previewUntil).toISOString() : undefined, title: result.title, url: result.url, text: result.text, links: result.links, tables: result.tables, sessionId: session.id, retrievedAt: new Date().toISOString() };
  } finally {
    signal?.removeEventListener('abort',onAbort);
    const release = async () => {
      socket?.close();
      for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new BrowserError('Browser session ended.')); }
      await browserAPI(`sessions/${encodeURIComponent(session.id)}`, 'POST', { status: 'REQUEST_RELEASE', projectId: session.projectId }).catch(() => {});
      onReleased?.();
    };
    // Keep the existing CDP connection briefly so people can actually open the
    // live view after the answer. No paid keepAlive feature or extra session.
    // Browserbase's 60-second timeout remains an independent hard cap.
    if (previewReady && typeof EdgeRuntime !== 'undefined') {
      EdgeRuntime.waitUntil((async () => {
        await new Promise(resolve => setTimeout(resolve, Math.max(0, previewUntil - Date.now())));
        await release();
      })());
    } else await release();
  }
}

let activeBrowserSessions=0;
export async function readPublicPage(raw:string,onSession?:Parameters<typeof readPublicPageSession>[1],onProgress?:Parameters<typeof readPublicPageSession>[2],signal?:AbortSignal){
  if(activeBrowserSessions>=2)throw new BrowserError('The browser is busy. Wait for the active previews to finish, then retry.');
  activeBrowserSessions++;let released=false;
  const release=()=>{if(!released){released=true;activeBrowserSessions--;}};
  try{return await readPublicPageSession(raw,onSession,onProgress,signal,release);}catch(error){release();throw error;}
}

export async function searchPublicWeb(query: string, onSession?: Parameters<typeof readPublicPage>[1], onProgress?: Parameters<typeof readPublicPage>[2],signal?:AbortSignal) {
  if(searchProvider()!=='browserbase'){await onProgress?.('Requesting the configured search API');return searchAPI(query);}
  const page = await readPublicPage(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, onSession, onProgress,signal);
  const seen = new Set<string>();
  const links: { text: string; url: string }[] = [];
  for (const link of page.links || []) {
    try {
      let target = new URL(link.url);
      // Decode actual search-result redirects; never construct destination URLs.
      if (/(^|\.)duckduckgo\.com$/.test(target.hostname) && target.pathname === '/l/') target = new URL(target.searchParams.get('uddg') || '');
      if (target.protocol !== 'https:' || target.username || target.password || /(^|\.)duckduckgo\.com$/.test(target.hostname) || seen.has(target.href)) continue;
      seen.add(target.href); links.push({ text: link.text, url: target.href });
    } catch { /* discard malformed search links */ }
  }
  if (!links.length && !/no results (found|for)/i.test(page.text)) throw new BrowserError('The search returned no usable result links. No search results were verified.', 'blocked');
  return { ...page, links: links.slice(0, 12) };
}
