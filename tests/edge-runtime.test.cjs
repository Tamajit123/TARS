const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the actual Edge source with controlled boundaries. These are unit
// tests; the separate database scripts perform the real provider checks.
function load(name, globals = {}, imports = {}, cache = {}) {
  if (cache[name]) return cache[name];
  const filename = path.resolve('supabase/functions/_shared', name + '.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  cache[name] = exports;
  vm.runInNewContext(source, { exports, require: id => { if (id === 'npm:ajv@8.20.0') return { __esModule: true, default: require('ajv') }; if (id in imports) return imports[id]; if (/^\.\/[a-zA-Z]+\.ts$/.test(id)) return load(id.slice(2,-3), globals, imports, cache); throw new Error('Unexpected import'); },
    URL, URLSearchParams, AbortSignal, setTimeout, clearTimeout, WebSocket, TextDecoder, TextEncoder, Response, ReadableStream,
    Deno: { env: { get: name => /^(GEMINI|COMPOSIO|BROWSERBASE)_API_KEY$/.test(name) ? 'unit-test-placeholder' : undefined }, resolveDns: async () => ['127.0.0.1'] },
    console: { error() {} }, fetch: async () => { throw new Error('Unexpected network request'); }, ...globals }, { filename });
  return exports;
}

test('strict JSON schemas use Gemini parametersJsonSchema, retaining server validation constraints',async()=>{
  let payload;
  const transport=load('providerTransport',{fetch:async(_url,init)=>{payload=JSON.parse(init.body);return new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{functionCall:{name:'classify_request',args:{category:'general'}}}]},finishReason:'STOP'}]}));}});
  await transport.requestModelTurn({system:'Classify',contents:[{role:'user',content:'Hello'}],tools:[{name:'classify_request',parameters:{type:'object',additionalProperties:false,properties:{category:{type:'string'}},required:['category']}}],toolMode:'ANY'});
  const declaration=payload.tools[0].functionDeclarations[0];assert.equal(declaration.parameters,undefined);assert.equal(declaration.parametersJsonSchema.additionalProperties,false);assert.equal(payload.toolConfig.functionCallingConfig.mode,'ANY');
});

test('optional OpenAI adapter requires explicit selection and preserves tool-call IDs without switching Gemini',async()=>{
  const bodies=[];const transport=load('providerTransport',{Deno:{env:{get:name=>({AI_PROVIDER:'openai',OPENAI_MODEL:'configured-test-model',OPENAI_API_KEY:'unit-test-placeholder'})[name]}},fetch:async(url,init)=>{assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.equal(init.headers.Authorization,'Bearer unit-test-placeholder');bodies.push(JSON.parse(init.body));return new Response(JSON.stringify({choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'call_123',type:'function',function:{name:'read_source',arguments:'{"query":"example"}'}}]},finish_reason:'tool_calls'}]}));}});
  const result=await transport.requestModelTurn({system:'Test',contents:[{role:'user',content:'Read a source'}],tools:[{name:'read_source',parameters:{type:'OBJECT',properties:{query:{type:'STRING'}},required:['query']}}]});assert.equal(result.calls[0].id,'call_123');assert.equal(result.calls[0].args.query,'example');assert.equal(bodies[0].store,false);assert.equal(bodies[0].tools[0].function.parameters.type,'object');
  assert.equal(load('providerTransport').providerConfig().provider,'gemini');
});

test('OpenAI real SSE parser retains fragmented tool arguments and rejects an incomplete stream',async()=>{
  const adapter=load('openaiTransport');const delta=[];const frames=[{choices:[{delta:{content:'Hello '}}]},{choices:[{delta:{content:'world'},finish_reason:'stop'}]}].map(value=>'data: '+JSON.stringify(value)+'\n\n').join('')+'data: [DONE]\n\n';
  const result=await adapter.collectOpenAIStream(new Response(frames),text=>delta.push(text));assert.equal(delta.join(''),'Hello world');assert.equal(result.choices[0].message.content,'Hello world');await assert.rejects(adapter.collectOpenAIStream(new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'),()=>{}),error=>error.code==='provider_stream_interrupted');
});

test('classification requires user evidence and clarifies only missing travel parameters',async()=>{
  const plan={category:'flights',mode:'research',missing:[],clarification:'',parameters:[{name:'origin',value:'BLR',quote:'BLR'},{name:'destination',value:'CCU',quote:'CCU'},{name:'departure_date',value:'2026-11-29',quote:'29 November 2026'},{name:'trip_type',value:'one-way',quote:'Find a flight'}]};
  const module=load('universalAgent',{}, {'./providerTransport.ts':{requestModelTurn:async()=>({calls:[{name:'classify_request',args:plan}]})}});
  const result=await module.classifyRequest('Find a flight BLR to CCU on 29 November 2026','');assert.equal(result.mode,'clarify');assert.deepEqual([...result.missing],['trip_type']);assert.equal(result.parameters.some(parameter=>parameter.name==='trip_type'),false);
  plan.parameters[0].quote='Invented origin';await assert.rejects(module.classifyRequest('Find a flight BLR to CCU on 29 November 2026',''),/user evidence/);
});

test('rich composition validates parsed payloads against source quotes and retains provider failures',()=>{
  const {EvidenceLedger}=load('universalAgent'),ledger=new EvidenceLedger();ledger.add({ok:true,sources:[{id:'original',title:'Source',url:'https://example.com',provider:'browserbase_fetch',kind:'page',retrievedAt:new Date().toISOString(),excerpt:'Product costs INR 420.'}]},'fetch_page');
  const value={intent:'shopping',status:'completed',title:'Product',summary:'One sourced listing.',limitations:[],blocks:[{type:'product_list',items:[{title:'Product',sourceId:'src1',fields:[],price:{value:'INR 420',basis:'listed',quote:'Product costs INR 420.'}}]}]};
  ledger.add({ok:false,error:'A second source returned HTTP 403.'},'fetch_page');const response=ledger.compose({response_json:JSON.stringify(value)});assert.equal(response.status,'partial');assert.match(response.limitations[0],/403/);assert.equal(response.sources[0].id,'src1');
  value.blocks[0].items[0].price.value='INR 100';assert.throws(()=>ledger.compose({response_json:JSON.stringify(value)}),/evidence/);assert.throws(()=>ledger.compose({response_json:'invalid'}),/valid JSON/);
});

test('browser rejects private networks, credentials and unsafe URL schemes before starting a session', async () => {
  const browser = load('browser');
  for (const url of ['http://example.com', 'https://127.0.0.1', 'https://localhost', 'https://user:password@example.com', 'https://example.com:8443', 'file:///etc/passwd', 'https://example.internal']) {
    await assert.rejects(browser.readPublicPage(url), /public HTTPS/);
  }
  await assert.rejects(browser.readPublicPage('https://example.com'), /Private network/);
});

test('reply recovery queries the exact authenticated owner and returns status without stored response content',async()=>{
  const filters=[];const db={from:()=>({select(){return this;},eq(key,value){filters.push([key,value]);return this;},maybeSingle:async()=>({data:{request_id:'saved-request',status:'provider_failed',error_code:'provider_unavailable',response_text:'Must not leave server'},error:null})})};
  const result=await load('replyStatus').ownedReplyStatus(db,'owner','11111111-1111-1111-1111-111111111111','saved-request');
  assert.deepEqual(filters,[['user_id','owner'],['conversation_id','11111111-1111-1111-1111-111111111111'],['request_id','saved-request']]);
  assert.equal(result.request.response_text,null);assert.doesNotMatch(JSON.stringify(result),/Must not leave server/);
  await assert.rejects(load('replyStatus').ownedReplyStatus(db,'owner','invalid','saved-request'),error=>error.status===400);
});

test('Gemini daily free quota is distinguished from transient RPM limits and never immediately retried',async()=>{
  let calls=0;const provider=load('providerTransport',{fetch:async()=>{calls++;return new Response(JSON.stringify({error:{status:'RESOURCE_EXHAUSTED',message:'Generate content requests per day limit exceeded on Free Tier.',details:[{violations:[{quotaId:'GenerateRequestsPerDayPerProjectPerModel-FreeTier'}]}]}}),{status:429});}});
  await assert.rejects(provider.requestModelTurn({system:'Test',contents:[{role:'user',content:'Synthetic check'}]}),error=>error.code==='provider_daily_quota_exhausted'&&error.diagnostic.httpStatus===429);assert.equal(calls,1);assert.match(load('ai').providerMessage('provider_daily_quota_exhausted'),/daily.*quota.*used up/);
});

test('Instagram personal-account denial is actionable while the existing connection stays intact',()=>{
  const registry=load('toolRegistry');assert.throws(()=>registry.safeToolResult({result_type:'completed',log_id:'log_denied',data:{successful:false,status_code:403,message:'Access is denied because the instagram account type is not business or creator. The instagram account was switched to a personal account.'}}),error=>error.status===409&&error.requestId==='log_denied'&&/Business or Creator/.test(error.message));
});

test('Gemini failures return a safe diagnostic and keep the credential out of the URL', async () => {
  const gemini = load('gemini', { Deno: { env: { get: name => name === 'GEMINI_API_KEY' ? 'unit-test-placeholder' : undefined } }, fetch: async (url, init) => {
    assert.doesNotMatch(url, /key=|unit-test-placeholder/);
    assert.equal(init.headers['x-goog-api-key'], 'unit-test-placeholder');
    return { ok: false, status: 503, json: async () => ({ error: { status: 'UNAVAILABLE', message: 'do not log raw provider bodies' } }) };
  } });
  await assert.rejects(gemini.generateGeminiReply([{ role: 'user', content: 'Hello' }]), error => error.code === 'provider_unavailable' && error.diagnostic.httpStatus === 503);
  assert.match(load('ai').providerMessage('provider_unavailable'), /temporarily unavailable.*high demand/);
});

test('model inference retries a transient failure with identical history and preserved tool signatures', async () => {
  const bodies = [];
  const transport = load('providerTransport', { fetch: async (_url, init) => {
    bodies.push(init.body);
    return bodies.length === 1 ? { ok: false, status: 503, json: async () => ({ error: { status: 'UNAVAILABLE' } }) } : { ok: true, json: async () => ({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'browse_page', args: { url: 'https://example.com' } }, thoughtSignature: 'test-signature' }] }, finishReason: 'STOP' }] }) };
  } });
  const result = await transport.requestModelTurn({ system: 'Test', contents: [{ role: 'user', parts: [{ text: 'Read the page' }] }], tools: [{ name: 'browse_page' }] });
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(result.calls[0].name, 'browse_page');
  assert.equal(result.content[0].geminiContent.parts[0].thoughtSignature, 'test-signature');
});

test('provider errors distinguish invalid models, long rate limits, malformed output and cancellation', async () => {
  const request = { system: 'Test', contents: [] };
  for (const [status, code] of [[404,'provider_model_unavailable'],[429,'provider_rate_limited'],[401,'provider_configuration_error']]) {
    let calls = 0;
    const transport = load('providerTransport', { fetch: async () => { calls++; return { ok: false, status, headers: { get: () => '60' }, json: async () => ({}) }; } });
    await assert.rejects(transport.requestModelTurn(request), error => error.code === code);
    assert.equal(calls, 1);
  }
  const malformed = load('providerTransport', { fetch: async () => ({ ok: true, json: async () => ({ invalid: true }) }) });
  await assert.rejects(malformed.requestModelTurn(request), error => error.code === 'malformed_provider_response');
  await assert.rejects(malformed.requestModelTurn({ ...request, deadline: Date.now() - 1 }), error => error.code === 'provider_timeout');
  await assert.rejects(malformed.requestModelTurn({ ...request, signal: { aborted: true } }), error => error.code === 'provider_cancelled');
});

test('callbacks use server-selected targets and preserve a strict exact allowlist', () => {
  const { connectionCallback } = load('callbacks');
  assert.equal(connectionCallback({ callbackTarget: 'native' }), 'tarsai://tools');
  assert.equal(connectionCallback({ callbackTarget: 'hosted' }), undefined);
  assert.equal(connectionCallback({ callbackTarget: 'web' }), undefined);
  for (const url of ['tarsai:///tools', 'https://attacker.example/tools', 'tarsai://tools?next=https://attacker.example', 'javascript:alert(1)']) assert.throws(() => connectionCallback({ callbackUrl: url }));
  const configured = load('callbacks', { Deno: { env: { get: name => ({ TOOL_CALLBACK_URLS: 'tarsai://tools,https://tars.example/tools', TOOL_WEB_CALLBACK_URL: 'https://tars.example/tools' })[name] } } });
  assert.equal(configured.connectionCallback({ callbackTarget: 'web' }), 'https://tars.example/tools');
});

test('real browser reader reports genuine milestones and rejects a challenge page as blocked', async () => {
  const progress = [], releases = [];
  class Socket {
    listeners = {};
    constructor() { queueMicrotask(() => this.emit('open', {})); }
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
    emit(type, event) { for (const callback of this.listeners[type] || []) callback(event); }
    close() {}
    send(raw) {
      const { id, method } = JSON.parse(raw);
      const result = method === 'Target.createTarget' ? { targetId: 'test-target' } : method === 'Target.attachToTarget' ? { sessionId: 'test-page' } : method === 'Runtime.evaluate' ? { result: { value: JSON.stringify({ ready: 'complete', url: 'https://www.google.com/sorry/index', title: 'Blocked', text: 'Our systems have detected unusual traffic', links: [], tables: [] }) } } : {};
      queueMicrotask(() => this.emit('message', { data: JSON.stringify({ id, result }) }));
    }
  }
  const browser = load('browser', { WebSocket: Socket, Deno: { env: { get: () => 'unit-test-placeholder' }, resolveDns: async () => ['1.1.1.1'] }, fetch: async (url, init) => {
    if (init.body && JSON.parse(init.body).status === 'REQUEST_RELEASE') releases.push(true);
    return { ok: true, json: async () => url.includes('/debug') ? { debuggerFullscreenUrl: 'https://www.browserbase.com/wrong-blank-tab', pages: [{ id: 'test-target', debuggerFullscreenUrl: 'https://www.browserbase.com/test-view' }] } : { id: 'test-session', connectUrl: 'wss://test.invalid', projectId: 'test-project' } };
  } });
  await assert.rejects(browser.readPublicPage('https://www.google.com', async view => { assert.equal(view.sessionId, 'test-session'); assert.equal(view.liveUrl, 'https://www.browserbase.com/test-view'); }, async activity => { progress.push(activity); }), error => error.reason === 'blocked' && /No usable results/.test(error.message));
  assert.deepEqual(progress, ['Connecting to the cloud browser', 'Opening the requested page', 'Reading page content']);
  assert.equal(releases.length, 1);
});

test('an invented write tool cannot execute through the read-only agent registry', async () => {
  const requests = [];
  const gemini = load('gemini');
  const agent = load('agent', { fetch: async (url, init) => {
    assert.match(url, /^https:\/\/generativelanguage.googleapis.com\//);
    requests.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ candidates: [{ content: { role: 'model', parts: requests.length === 1
      ? [{ functionCall: { name: 'send_email', args: { recipient: 'someone@example.com' } } }]
      : [{ text: 'No message was sent.' }] } }] }) };
  } }, { './gemini.ts': gemini, './connections.ts': { ConnectionError: class extends Error {} }, './browser.ts': { readPublicPage: async () => { throw new Error('Must not execute'); } }, './composio.ts': { composioReadTools: [], executeComposioRead: async () => { throw new Error('Must not execute'); } } });
  const db = { from: table => { assert.equal(table, 'profiles'); return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }; } };
  assert.equal(await agent.generateAgentReply([{ role: 'user', content: 'Send an email' }], db, 'test-owner'), 'No message was sent.');
  assert.equal(requests.length, 2);
  assert.equal(requests[1].contents.at(-1).parts[0].functionResponse.response.ok, false);
});

test('connected reads validate arguments, project only intended fields and reject embedded provider errors', () => {
  const { readArguments, readResult, composioReadTools } = load('composioReads');
  for (const toolkit of ['reddit','twitter','trello','jira']) assert.ok(composioReadTools.some(tool => tool.toolkit === toolkit));
  assert.equal(readArguments('REDDIT_GET_ME_PREFS', {}).fields, 'lang,nightmode');
  assert.equal(readArguments('TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER', {}).idMember, 'me');
  assert.equal(readArguments('JIRA_SEARCH_ISSUES', {}).max_results, 5);
  for (const [name,args] of [['TWITTER_USER_LOOKUP_ME',{access_token:'secret'}],['TRELLO_ADD_CARDS',{}],['JIRA_SEARCH_ISSUES',{max_results:1000}],['JIRA_SEARCH_ISSUES',{user_id:'someone-else'}]]) assert.throws(() => readArguments(name,args));
  const wrap = data => ({result_type:'completed',log_id:'log-test',data});
  assert.equal(readResult('REDDIT_GET_ME_PREFS',wrap({lang:'en',nightmode:true,access_token:'secret'})).data.access_token, undefined);
  assert.equal(readResult('TWITTER_USER_LOOKUP_ME',wrap({data:{id:'1',name:'Test',username:'test',refresh_token:'secret'}})).data.username,'test');
  assert.equal(readResult('TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER',wrap({details:[]})).count,0);
  assert.equal(readResult('JIRA_SEARCH_ISSUES',wrap({issues:[],total:0})).count,0);
  assert.throws(() => readResult('REDDIT_GET_ME_PREFS',wrap({status_code:404,http_error:'Not found'})),/HTTP 404/);
  assert.throws(() => readResult('JIRA_SEARCH_ISSUES',wrap({successful:false,data:{issues:[]}})));
  assert.throws(() => readResult('TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER',wrap({unexpected:[]})));
});

test('agent can complete reads from all four connected services in one turn', async () => {
  const names = ['REDDIT_GET_ME_PREFS','TWITTER_USER_LOOKUP_ME','TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER','JIRA_SEARCH_ISSUES'];
  const executed = [];
  let turns = 0;
  const agent = load('agent', { fetch: async (_url, init) => {
    const request = JSON.parse(init.body);
    if (turns++) assert.equal(request.contents.at(-1).parts.length,4);
    return {ok:true,json:async()=>({candidates:[{content:{role:'model',parts:turns === 1 ? names.map(name=>({functionCall:{name,args:{}}})) : [{text:'Four real results received.'}]}}]})};
  } }, { './composio.ts': { composioReadTools:names.map(name=>({name,toolkit:'test',parameters:{type:'OBJECT',properties:{}}})),executeComposioRead:async(_db,_owner,name)=>{executed.push(name);return {ok:true};} } });
  const db = {from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})};
  assert.equal(await agent.generateAgentReply([{role:'user',content:'Read all four services'}],db,'owner'),'Four real results received.');
  assert.equal(executed.length,4);
});

test('slow tool selection leaves a bounded synthesis window and no extra tool round or model switch',async()=>{
  let now=1000000,turns=0;const windows=[],bodies=[],executed=[];
  const names=['REDDIT_GET_ME_PREFS','TWITTER_USER_LOOKUP_ME','TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER','JIRA_SEARCH_ISSUES'];
  const agent=load('agent',{
    Date:class extends Date{static now(){return now;}},
    AbortSignal:{timeout:ms=>{windows.push(ms);return new AbortController().signal;},any:AbortSignal.any},
    fetch:async(url,init)=>{
      assert.match(url,/models\/gemini-3\.5-flash-lite:/);const body=JSON.parse(init.body);bodies.push(body);
      if(turns++===0){now+=70000;return {ok:true,json:async()=>({candidates:[{content:{role:'model',parts:names.map(name=>({functionCall:{name,args:{}},thoughtSignature:'retained-signature'}))}}]})};}
      assert.equal(body.toolConfig.functionCallingConfig.mode,'NONE');
      assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'minimal');
      assert.equal(body.contents.at(-2).parts[0].thoughtSignature,'retained-signature');
      assert.equal(body.contents.at(-1).parts.length,4);now+=50000;
      return {ok:true,json:async()=>({candidates:[{content:{role:'model',parts:[{text:'X is connected. Trello and Jira returned no items. Reddit is rate-limited.'}]}}]})};
    },
  },{'./composio.ts':{composioReadTools:names.map(name=>({name,toolkit:'test',parameters:{type:'OBJECT',properties:{}}})),executeComposioRead:async(_db,_owner,name)=>{now+=3000;executed.push(name);return name.startsWith('REDDIT')?{ok:false,message:'HTTP 429'}:{ok:true,data:[]};}}});
  const db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})};
  assert.match(await agent.generateAgentReply([{role:'user',content:'Read all four services'}],db,'owner'),/Reddit is rate-limited/);
  assert.equal(bodies[0].generationConfig.thinkingConfig.thinkingLevel,'low');assert.deepEqual(windows,[90000,53000]);assert.equal(executed.length,4);assert.equal(turns,2);
});

test('browser search returns deduplicated destination URLs and rejects a result-less shell', async () => {
  let usable = true;
  class Socket {
    listeners = {};
    constructor() { queueMicrotask(()=>this.emit('open',{})); }
    addEventListener(type,callback) { (this.listeners[type] ||= []).push(callback); }
    emit(type,event) { for(const callback of this.listeners[type] || []) callback(event); }
    close() {}
    send(raw) {
      const {id,method}=JSON.parse(raw);
      const destination='https://docs.browserbase.com/reference/api/session-live-urls';
      const links = usable ? [{text:'Live URLs',url:'https://duckduckgo.com/l/?uddg='+encodeURIComponent(destination)},{text:'Duplicate',url:destination}] : [];
      const result=method==='Target.createTarget'?{targetId:'target'}:method==='Target.attachToTarget'?{sessionId:'page'}:method==='Runtime.evaluate'?{result:{value:JSON.stringify({ready:'complete',url:'https://html.duckduckgo.com/html/?q=test',title:'Search',text:'Search response',links})}}:{};
      queueMicrotask(()=>this.emit('message',{data:JSON.stringify({id,result})}));
    }
  }
  const browser=load('browser',{WebSocket:Socket,Deno:{env:{get:name=>name==='BROWSERBASE_API_KEY'?'placeholder':undefined},resolveDns:async()=>['1.1.1.1']},fetch:async()=>({ok:true,json:async()=>({id:'session',connectUrl:'wss://test.invalid',projectId:'project'})})});
  const page=await browser.searchPublicWeb('test');
  assert.equal(page.links.length,1);
  assert.equal(page.links[0].url,'https://docs.browserbase.com/reference/api/session-live-urls');
  usable=false;
  await assert.rejects(browser.searchPublicWeb('test'),/no usable result links/);
});

test('successful browser previews return promptly and release in the bounded background task', async () => {
  let background, finishPreview, released = 0, closed = 0;
  class Socket {
    listeners = {};
    constructor() { queueMicrotask(() => this.emit('open', {})); }
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
    emit(type, event) { for (const callback of this.listeners[type] || []) callback(event); }
    close() { closed++; }
    send(raw) {
      const { id, method } = JSON.parse(raw);
      const result = method === 'Target.createTarget' ? { targetId: 'read-tab' } : method === 'Target.attachToTarget' ? { sessionId: 'page' } : method === 'Runtime.evaluate' ? { result: { value: JSON.stringify({ready:'complete',url:'https://example.com',title:'Actual page',text:'Real content',links:[],tables:[]}) } } : {};
      queueMicrotask(() => this.emit('message', { data: JSON.stringify({ id, result }) }));
    }
  }
  let viewer;
  const browser = load('browser', {
    WebSocket: Socket, EdgeRuntime: { waitUntil: task => { background = task; } },
    setTimeout: (callback, delay) => delay > 30000 ? (finishPreview = callback, 0) : setTimeout(callback, delay),
    Deno: { env: { get: () => 'unit-test-placeholder' }, resolveDns: async () => ['1.1.1.1'] },
    fetch: async (url, init) => {
      if (init.body && JSON.parse(init.body).status === 'REQUEST_RELEASE') released++;
      if (url.endsWith('/sessions') && init.method === 'POST') { const viewport = JSON.parse(init.body).browserSettings.viewport; assert.equal(viewport.width,390); assert.equal(viewport.height,844); }
      return { ok:true,json:async()=>url.includes('/debug')?{pages:[{id:'blank-tab',debuggerFullscreenUrl:'https://www.browserbase.com/wrong'},{id:'read-tab',debuggerFullscreenUrl:'https://www.browserbase.com/right'}]}:{id:'session',connectUrl:'wss://test.invalid',projectId:'project'} };
    },
  });
  const result = await browser.readPublicPage('https://example.com', async value => { viewer=value; });
  assert.equal(result.title, 'Actual page');
  assert.equal(viewer.liveUrl, 'https://www.browserbase.com/right');
  assert.equal(result.previewExpiresAt, viewer.expiresAt);
  assert.equal(released, 0); assert.equal(closed, 0);
  assert.equal(typeof finishPreview, 'function');
  finishPreview(); await background;
  assert.equal(released, 1); assert.equal(closed, 1);
});

test('Gemini streams real UTF-8 text incrementally and preserves tool thought signatures', async () => {
  const received = [];
  const encoder = new TextEncoder();
  const frames = [
    { candidates: [{ content: { parts: [{ text: 'Hello ' }] } }] },
    { candidates: [{ content: { parts: [{ text: '\u4f60\u597d' }] } }] },
    { candidates: [{ content: { parts: [{ functionCall: { name: 'read_tool', args: {} }, thoughtSignature: 'test-preserved' }] }, finishReason: 'STOP' }] },
  ].map(value => `data: ${JSON.stringify(value)}\n\n`).join('');
  const bytes = encoder.encode(frames);
  const transport = load('providerTransport', { fetch: async url => {
    assert.match(url, /streamGenerateContent\?alt=sse$/);
    return new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i,i+7)); controller.close(); } }), { status: 200 });
  } });
  const result = await transport.requestModelTurn({ system: 'Test', contents: [{role:'user',content:'Hello'}], onEvent: event => received.push(event.delta) });
  assert.deepEqual(received, ['Hello ', '\u4f60\u597d']);
  assert.equal(result.text, 'Hello \u4f60\u597d');
  assert.equal(result.content[0].geminiContent.parts[2].thoughtSignature, 'test-preserved');
});

test('Gemini rejects a truncated stream instead of reporting a completed reply', async () => {
  const { collectGeminiStream } = load('providerTransport');
  const response = new Response('data: {"candidates":[{"content":{"parts":[{"text":"partial"}]}}]}\n\n');
  await assert.rejects(collectGeminiStream(response, () => {}), error => error.code === 'provider_stream_interrupted');
});


test('dynamic tool arguments validate nested credentials, required fields and bounded reads', () => {
  const { validatedToolArgs, safeToolResult } = load('toolRegistry');
  const tool = {name:'TEST_READ',toolkit:'gmail',parameters:{type:'object',properties:{query:{type:'string'}},required:['query']},requiresConfirmation:false};
  assert.equal(validatedToolArgs(tool, '{"query":"in:unread"}').query, 'in:unread');
  for (const args of [{}, {query:1}, {query:'x',nested:{access_token:'sensitive'}}, {query:'x',user_id:'other'}, {query:'x',max_results:100}, {query:'x',auto_paginate:true}]) assert.throws(()=>validatedToolArgs(tool,JSON.stringify(args)));
  const clean = safeToolResult({result_type:'completed',log_id:'log-test',data:{data:{title:'Actual result',nested:{refresh_token:'sensitive',safe:'yes'}}}});
  assert.equal(clean.nested.safe,'yes'); assert.equal(clean.nested.refresh_token,undefined);
  assert.throws(()=>safeToolResult({result_type:'completed',log_id:'log-test',data:{response:{status_code:403}}}),/HTTP 403/);
});

function actionHarness(overrides = {}) {
  const action = {id:'10000000-0000-4000-8000-000000000001',user_id:'owner',status:'pending',tool_slug:'SLACK_SEND_MESSAGE',toolkit:'slack',arguments:{text:'Reviewed message',channel:'test-channel'},input_schema:{type:'object',properties:{text:{type:'string'},channel:{type:'string'}},required:['text','channel']},expires_at:new Date(Date.now()+60000).toISOString(), ...overrides};
  let executions=0;
  const calls=[];
  const db={from:table=>{ assert.equal(table,'pending_tool_actions'); let filters={}, update;
    const query={select:()=>query,eq:(key,value)=>{filters[key]=value;return query;},update:value=>{update=value;return query;},maybeSingle:async()=>{
      const match=Object.entries(filters).every(([key,value])=>action[key]===value);
      if(!match)return {data:null,error:null};
      if(update)Object.assign(action,update);
      return {data:{...action},error:null};
    },then:resolve=>{const match=Object.entries(filters).every(([key,value])=>action[key]===value);if(match&&update)Object.assign(action,update);return Promise.resolve({error:null}).then(resolve);}};return query;}};
  const module=load('confirmedActions',{}, {'./connections.ts':{ConnectionError:class extends Error {constructor(status,message){super(message);this.status=status;}},composioAPI:async(_path,_method,body)=>{executions++; calls.push(body); if(overrides.providerFails)throw new Error('unknown provider outcome');return {log_id:'log-confirmed'};}},'./toolRegistry.ts':{requireActiveAccount:async()=> 'existing-session',validatedToolArgs:(_tool,raw)=>JSON.parse(raw),safeToolResult:()=>({key:'REAL-1'})},'./reviewedTools.ts':{reviewedTools:[{name:'SLACK_SEND_MESSAGE',toolkit:'slack',requiresConfirmation:true}]}});
  return {action,db,module,calls,executions:()=>executions};
}

test('confirmation checks ownership, expiry and cancelled status before external execution', async()=>{
  for(const [overrides,user] of [[{},'other'],[{expires_at:'2020-01-01T00:00:00Z'},'owner'],[{status:'cancelled'},'owner']]){
    const h=actionHarness(overrides);await assert.rejects(h.module.confirmAction(h.db,user,h.action.id));assert.equal(h.executions(),0);
  }
  const h=actionHarness();assert.equal((await h.module.confirmAction(h.db,'owner',h.action.id,true)).status,'cancelled');assert.equal(h.executions(),0);
});

test('confirmation atomically claims once, executes stored arguments and reuses completed result',async()=>{
  const h=actionHarness(); const results=await Promise.allSettled([h.module.confirmAction(h.db,'owner',h.action.id),h.module.confirmAction(h.db,'owner',h.action.id)]);
  assert.equal(h.executions(),1);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(h.calls[0].arguments.text,'Reviewed message');
  assert.equal((await h.module.confirmAction(h.db,'owner',h.action.id)).result.data.key,'REAL-1');assert.equal(h.executions(),1);
});

test('confirmation never retries an unknown external outcome',async()=>{
  const h=actionHarness({providerFails:true});await assert.rejects(h.module.confirmAction(h.db,'owner',h.action.id),/Check the provider/);
  assert.equal(h.action.status,'failed');await assert.rejects(h.module.confirmAction(h.db,'owner',h.action.id));assert.equal(h.executions(),1);
});
test('browser preview refresh rejects foreign executions and never accepts a caller-supplied URL',async()=>{
 let reads=0;
 const preview=load('browserPreview',{}, {'./browser.ts':{readPublicPage:async()=>{reads++;throw new Error('Unexpected');}},'./connections.ts':{ConnectionError:class extends Error{constructor(status,message){super(message);this.status=status;}}}});
 const db={from:()=>{const filters={};const query={select:()=>query,eq:(key,value)=>{filters[key]=value;return query;},maybeSingle:async()=>({data:filters.user_id==='owner'?{id:'10000000-0000-4000-8000-000000000001',status:'completed',metadata:{provider:'browserbase',sourceUrl:'https://localhost'}}:null})};return query;}};
 await assert.rejects(preview.refreshBrowserPreview(db,'other','10000000-0000-4000-8000-000000000001'),/unavailable/);
 await assert.rejects(preview.refreshBrowserPreview(db,'owner','10000000-0000-4000-8000-000000000001'),/public page/);
 assert.equal(reads,0);
});
