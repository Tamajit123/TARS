import { ProviderError } from './providerError.ts';
import {requestOpenAITurn} from './openaiTransport.ts';
type Data = Record<string, any>;
export type AgentEvent = { type: 'text.delta'; delta: string } | { type: 'tool.started' | 'tool.completed'; name: string };
export type ModelTurnRequest = { system: string; contents: Data[]; tools?: Data[]; allowTools?: boolean; toolMode?:'AUTO'|'ANY'|'NONE'; allowedToolNames?:string[];afterTools?: boolean; deadline?: number; signal?: AbortSignal; model?: string; onEvent?: (event: AgentEvent) => void };
export type ModelTurnResult = { text: string; content: Data[]; calls: Data[]; finishReason: string | null };

/** Gemini's constrained decoding can reject nested maxItems/maxLength products.
 * Keep the serving grammar small; Ajv and the shared validator still enforce
 * every bound after generation, independently of the model. */
export function geminiToolSchema(schema:Data):Data{
  const result:Data={};for(const [key,value] of Object.entries(schema)){
    if(['maxItems','minItems','maxLength','minLength','minimum','maximum','pattern','format'].includes(key))continue;
    result[key]=key==='properties'?Object.fromEntries(Object.entries(value).map(([name,child])=>[name,geminiToolSchema(child as Data)])):key==='items'&&value&&typeof value==='object'?geminiToolSchema(value):value;
  }return result;
}

export function providerConfig() {
  const provider = Deno.env.get('AI_PROVIDER') || 'gemini';
  if (!['gemini','openai'].includes(provider)) throw new ProviderError('provider_configuration_error');
  const model = provider==='openai'?Deno.env.get('OPENAI_MODEL')||'':Deno.env.get('AI_MODEL') || Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite';
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(model)) throw new ProviderError('provider_model_unavailable');
  return { provider, model };
}

/** One transport for ordinary replies and every agent round. Retries repeat
 * only model inference with the identical history, never any tool execution.
 * Provider switching is deliberately disabled once a conversation turn starts.
 */
export async function requestModelTurn(request: ModelTurnRequest): Promise<ModelTurnResult> {
  const config = providerConfig();
  const model = request.model || config.model;
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(model)) throw new ProviderError('provider_model_unavailable');
  if(config.provider==='openai')return requestOpenAITurn(request,model);
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new ProviderError('provider_not_configured');
  const deadline = request.deadline || Date.now() + 105000;
  const payload = JSON.stringify({ systemInstruction: { parts: [{ text: request.system }] }, contents: geminiContents(request.contents),
    ...(request.tools?.length ? { tools: [{ functionDeclarations: request.tools.map(tool=>tool.parameters?.type==='object'?{name:tool.name,description:tool.description,parametersJsonSchema:geminiToolSchema(tool.parameters)}:tool) }], toolConfig: { functionCallingConfig: { mode: request.allowTools === false ? 'NONE' : request.toolMode||'AUTO',...(request.allowTools!==false&&request.allowedToolNames?.length?{allowedFunctionNames:request.allowedToolNames}:{}) } } } : {}),
    // Retain normal reasoning for the user's question and tool selection. Once
    // verified results arrive, supported Flash models can synthesize directly
    // instead of spending the remaining response window on extra thinking.
    generationConfig: { maxOutputTokens: 4096, thinkingConfig: model.startsWith('gemini-2.5') ? { thinkingBudget: 0 } : { thinkingLevel: request.afterTools && /^(gemini-3\.6-flash|gemini-3\.5-flash-lite|gemini-3-flash-preview|gemini-3\.1-flash-lite)$/.test(model) ? 'minimal' : 'low' } },
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    if (request.signal?.aborted) throw new ProviderError('provider_cancelled');
    const remaining = deadline - Date.now();
    if (remaining < 1000) throw new ProviderError('provider_timeout');
    // Real 3.6 Flash probes took 33–53 seconds even for short successful
    // responses. Include generation/stream completion in a bounded 90s window;
    // the caller's whole-turn deadline remains an independent upper bound.
    const timeout = AbortSignal.timeout(Math.min(90000, remaining));
    let response: Response;
    let delivered = false;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${request.onEvent ? 'streamGenerateContent?alt=sse' : 'generateContent'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: payload, signal: request.signal ? AbortSignal.any([request.signal, timeout]) : timeout,
      });
    } catch {
      if (request.signal?.aborted) throw new ProviderError('provider_cancelled');
      if (attempt < 1 && !timeout.aborted) continue;
      throw new ProviderError(timeout.aborted ? 'provider_timeout' : 'provider_unreachable');
    }
    const data = response.ok && request.onEvent
      ? await collectGeminiStream(response, delta => { delivered = true; request.onEvent?.({ type: 'text.delta', delta }); }).catch(error => { if (request.signal?.aborted) throw new ProviderError('provider_cancelled'); if (timeout.aborted) throw new ProviderError('provider_timeout'); throw error; })
      : await response.json().catch(() => null);
    if (!response.ok) {
      const dailyQuota=response.status===429&&/per.day|perday|requestsperday/i.test(String(data?.error?.message||'')+JSON.stringify(data?.error?.details||[]));
      const code = dailyQuota?'provider_daily_quota_exhausted':response.status === 429 ? 'provider_rate_limited' : response.status === 503 ? 'provider_unavailable' : response.status === 404 ? 'provider_model_unavailable' : [400,401,403].includes(response.status) ? 'provider_configuration_error' : 'provider_error';
      const retryAfter = Number(response.headers?.get('retry-after') || 0);
      const retryable = !dailyQuota&&[429,500,502,503,504].includes(response.status) && retryAfter <= 3;
      if (!delivered && retryable && attempt < (response.status === 429 ? 1 : 2) && deadline - Date.now() > 5000) {
        await new Promise(resolve => setTimeout(resolve, Math.max(retryAfter * 1000, 1000 * 2 ** attempt + Math.random() * 250)));
        continue;
      }
      // Diagnostic remains server-side; never log requests or return raw bodies
      // to chat clients. The maintenance probe uses fixed synthetic queries.
      const detail=response.status===400&&typeof data?.error?.message==='string'?data.error.message.split(key).join('[redacted]').replace(/(?:AIza[\w-]+|sk-[\w-]+|Bearer\s+\S+)/g,'[redacted]').slice(0,800):null;
      const quota=response.status===429&&Array.isArray(data?.error?.details)?data.error.details.flatMap((item:Data)=>Array.isArray(item.violations)?item.violations:[]).map((item:Data)=>item.quotaId).filter((value:unknown)=>typeof value==='string'&&/^[\w.-]{1,180}$/.test(value)).join(',').slice(0,400):null;
      throw new ProviderError(code, { httpStatus: response.status, status: typeof data?.error?.status === 'string' ? data.error.status : null, attempts: attempt + 1,detail,quota,retryAfterSeconds:retryAfter||null });
    }
    if (data?.promptFeedback?.blockReason) throw new ProviderError('provider_safety_blocked');
    if (!data || !Array.isArray(data.candidates)) throw new ProviderError('malformed_provider_response');
    const candidate = data.candidates[0];
    if (data.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') throw new ProviderError('provider_safety_blocked');
    const content = candidate?.content;
    if (!content || !Array.isArray(content.parts)) throw new ProviderError('empty_provider_response');
    const text = content.parts.filter((part: Data) => !part.thought && typeof part.text === 'string').map((part: Data) => part.text).join('').trim();
    const calls = content.parts.filter((part: Data) => part.functionCall).map((part: Data) => part.functionCall);
    if (!text && !calls.length) throw new ProviderError('empty_provider_response', { finishReason: candidate.finishReason || null });
    if (calls.length > 8 || text.length > 100000) throw new ProviderError('malformed_provider_response');
    // Keep signatures/parts intact when returning the model turn to its own
    // conversation. Logging contains counts only, never prompts or results.
    console.info?.('[ai] completed', { provider: config.provider, model, attempts: attempt + 1, inputTokens: data.usageMetadata?.promptTokenCount || 0, outputTokens: data.usageMetadata?.candidatesTokenCount || 0, toolCalls: calls.length });
    return { text: text.slice(0, 20000), content: [{ geminiContent: content }], calls, finishReason: candidate.finishReason || null };
  }
  throw new ProviderError('provider_error');
}

// Normalize the provider-independent conversation while preserving the entire
// Gemini model content, including thought signatures on tool calls.
function geminiContents(items: Data[]) {
  const result: Data[] = [];
  for (const item of items) {
    if (item.geminiContent) result.push(item.geminiContent);
    else if (item.type === 'function_call_output') {
      const part = { functionResponse: { name: item.name, ...(item.call_id ? { id: item.call_id } : {}), response: JSON.parse(item.output) } };
      const last = result.at(-1);
      if (last?.role === 'user' && last.parts?.[0]?.functionResponse) last.parts.push(part);
      else result.push({ role: 'user', parts: [part] });
    } else if (item.parts) result.push(item);
    else result.push({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] });
  }
  return result;
}

export async function collectGeminiStream(response: Response, onDelta: (delta: string) => void) {
  if (!response.body) throw new ProviderError('malformed_provider_response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', finishReason: string | null = null;
  const parts: Data[] = [];
  let characters = 0;
  let usageMetadata: Data = {};
  const consume = (frame: string) => {
    const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') return;
    let chunk: Data; try { chunk = JSON.parse(data); } catch { throw new ProviderError('malformed_provider_response'); }
    if (chunk.error) throw new ProviderError('provider_error');
    if (chunk.promptFeedback?.blockReason) throw new ProviderError('provider_safety_blocked');
    const candidate = chunk.candidates?.[0];
    if (candidate?.finishReason) finishReason = candidate.finishReason;
    for (const part of candidate?.content?.parts || []) {
      characters += JSON.stringify(part).length;
      if (characters > 200000 || parts.length > 10000) throw new ProviderError('malformed_provider_response');
      parts.push(part);
      if (!part.thought && typeof part.text === 'string') onDelta(part.text);
    }
    if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
      if (buffer.length > 1000000) throw new ProviderError('malformed_provider_response');
      let end;
      while ((end = buffer.indexOf('\n\n')) !== -1) { consume(buffer.slice(0, end)); buffer = buffer.slice(end + 2); }
      if (done) break;
    }
    if (buffer.trim()) consume(buffer);
  } catch (error) { if (error instanceof ProviderError) throw error; throw new ProviderError(response.body.locked ? 'provider_unreachable' : 'provider_cancelled'); }
  finally { reader.releaseLock(); }
  if (!finishReason) throw new ProviderError('provider_stream_interrupted');
  return { candidates: [{ content: { role: 'model', parts }, finishReason }], usageMetadata };
}
