import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';
import type { Database } from '../_shared/database.ts';
import { getModel, ProviderError, providerMessage } from '../_shared/ai.ts';
import {providerConfig,type AgentEvent } from '../_shared/providerTransport.ts';
import {readRichResponse,type RichResponse} from '../_shared/richResponse.ts';
import type {RequestPlan} from '../_shared/universalAgent.ts';
import { generateAgentReply } from '../_shared/agent.ts';
import { loadAttachmentParts,AttachmentError } from '../_shared/media.ts';
import { attachmentIds } from '../_shared/mediaPolicy.ts';

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_BODY_BYTES = 64_000;
const MAX_MESSAGE_CHARS = 12_000;
const MAX_OUTPUT_CHARS = 20_000;
const MAX_CONTEXT_MESSAGES = 20;
const MAX_REQUESTS_PER_MINUTE = 20;
const IN_PROGRESS_MS = 180_000;
type AdminClient = SupabaseClient<Database>;

Deno.serve(async (request) => {
  if (request.method !== 'POST' || !request.headers.get('accept')?.includes('text/event-stream')) return handleChat(request);
  const abort = new AbortController();
  let closed = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: unknown) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); }
        catch { closed = true; abort.abort(); }
      };
      const heartbeat = setInterval(() => { if (!closed) { try { controller.enqueue(encoder.encode(': heartbeat\n\n')); } catch { closed = true; abort.abort(); } } }, 15000);
      try {
        const response = await handleChat(request, emit, AbortSignal.any([request.signal, abort.signal]));
        emit({ type: 'result', data: await response.json(), status: response.status });
      } catch { emit({ type: 'error', message: 'The stream was interrupted. Your saved message can be retried safely.' }); }
      finally { clearInterval(heartbeat); if (!closed) { closed = true; controller.close(); } }
    },
    cancel() { closed = true; abort.abort(); },
  });
  return new Response(stream, { headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
});

async function handleChat(request: Request, emit?: (event: AgentEvent) => void, signal?: AbortSignal): Promise<Response> {
  const requestStarted=Date.now();let firstTextAt:number|undefined;
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed", message: "Use POST for chat requests." }, 405);

  const logId = crypto.randomUUID();
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ ok: false, error: "request_too_large", message: "This chat request is too large." }, 413);

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ ok: false, error: "unauthorized", message: "Sign in to use chat." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, error: "service_not_configured", message: "Chat is not fully configured on the server." }, 503);
  }

  const authClient = createClient<Database>(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ ok: false, error: "unauthorized", message: "Your session expired. Sign in again." }, 401);

  let body: Record<string, unknown>;
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_body");
    body = value as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_request", message: "Request body must be a JSON object." }, 400);
  }

  if (body.action !== undefined && body.action !== "send" && body.action !== "persist-assistant") {
    return json({ ok: false, error: "invalid_action", message: "This chat action is not supported." }, 400);
  }
  const action = body.action === "persist-assistant" ? "persist-assistant" : "send";
  const conversationId = body.conversationId;
  const requestId = body.requestId;
  if (typeof conversationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId)) {
    return json({ ok: false, error: "invalid_conversation", message: "Choose a valid conversation and try again." }, 400);
  }
  if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) {
    return json({ ok: false, error: "invalid_request_id", message: "The request identifier is invalid. Try sending again." }, 400);
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: thread, error: threadError } = await admin.from("chat_threads")
      .select("id,user_id").eq("id", conversationId).eq("user_id", user.id).maybeSingle();
    if (threadError) throw threadError;
    if (!thread) return json({ ok: false, error: "conversation_not_found", message: "This conversation is unavailable or belongs to another account." }, 404);

    const { data: previous, error: previousError } = await admin.from("ai_chat_requests")
      .select("id,status,response_text,response_metadata,updated_at")
      .eq("user_id", user.id).eq("conversation_id", conversationId).eq("request_id", requestId).maybeSingle();
    if (previousError) throw previousError;

    if (action === "persist-assistant") {
      return await persistAssistant(admin, user.id, conversationId, requestId, previous, logId);
    }

    const message = body.message;
    let requestedAttachments:string[];
    try{requestedAttachments=attachmentIds(body.attachmentIds);}catch(error){return json({ok:false,message:error instanceof Error?error.message:'Invalid attachments.'},400);}
    if (typeof message !== "string" || !message.trim() || message.trim().length > MAX_MESSAGE_CHARS) {
      return json({ ok: false, error: "invalid_message", message: "Write a message up to 12,000 characters." }, 400);
    }
    if (previous?.status === "completed") {
      const saved = await getRequestMessages(admin, user.id, conversationId, requestId);
      if (saved.userMessage && saved.assistantMessage) return json({ ok: true, persisted: true, ...saved, requestId });
      if (previous.response_text) return json({ ok: true, persisted: false, ...saved, output: previous.response_text, requestId });
      return json({ ok: false, error: "history_incomplete", message: "This reply is still being recovered. Retry safely." }, 503);
    }
    if (previous?.status === "persistence_failed" && previous.response_text) {
      const saved = await getRequestMessages(admin, user.id, conversationId, requestId);
      return json({ ok: true, persisted: false, ...saved, output: previous.response_text, requestId });
    }
    if (previous?.status === "pending" && Date.now() - Date.parse(previous.updated_at) < IN_PROGRESS_MS) {
      return json({ ok: false, error: "request_in_progress", message: "TARS is still working on this message. Try again in a moment." }, 409);
    }

    const minuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count, error: rateError } = await admin.from("ai_chat_requests")
      .select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", minuteAgo);
    if (rateError) throw rateError;
    if ((count || 0) >= MAX_REQUESTS_PER_MINUTE) {
      return json({ ok: false, error: "rate_limited", message: "You’re sending messages too quickly. Wait a minute and try again." }, 429);
    }

    if (previous) {
      const { data: claim, error: claimError } = await admin.from("ai_chat_requests")
        .update({ status: "pending", error_code: null, updated_at: new Date().toISOString() })
        .eq("id", previous.id).eq("updated_at", previous.updated_at).select("id").maybeSingle();
      if (claimError) throw claimError;
      if (!claim) return json({ ok: false, error: "request_in_progress", message: "TARS is already handling this message. Try again shortly." }, 409);
    } else {
      const { error: createError } = await admin.from("ai_chat_requests").insert({
        user_id: user.id, conversation_id: conversationId, request_id: requestId, status: "pending",
      });
      if (createError?.code === "23505") return json({ ok: false, error: "request_in_progress", message: "TARS is already handling this message. Try again shortly." }, 409);
      if (createError) throw createError;
    }

    const { data: savedUser, error: userInsertError } = await admin.from("chat_messages").insert({
      user_id: user.id, thread_id: conversationId, role: "user", content: message.trim(), request_id: requestId,metadata:{attachmentIds:requestedAttachments},
    }).select("id,role,content,created_at,metadata").single();
    let userMessage = savedUser;
    if (userInsertError?.code === "23505") {
      const { data, error } = await admin.from("chat_messages").select("id,role,content,created_at,metadata")
        .eq("user_id", user.id).eq("thread_id", conversationId).eq("request_id", requestId).eq("role", "user").single();
      if (error) throw error;
      userMessage = data;
    } else if (userInsertError) throw userInsertError;

    await admin.from("chat_threads").update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId).eq("user_id", user.id);
    const { data: history, error: historyError } = await admin.from("chat_messages")
      .select("id,role,content,metadata").eq("user_id", user.id).eq("thread_id", conversationId)
      .in("role", ["user", "assistant"]).order("created_at", { ascending: false }).limit(MAX_CONTEXT_MESSAGES);
    if (historyError) throw historyError;
    const context:import('../_shared/ai.ts').ProviderMessage[]=[];

    let output: string;
    let richResponse:RichResponse|undefined,requestPlan:RequestPlan|undefined;
    try {
      const savedMetadata=isRecord(userMessage?.metadata)?userMessage.metadata:{};
      const savedIds=attachmentIds(savedMetadata.attachmentIds);
      if(savedIds.length&&userMessage){
        const linked=await admin.from('chat_attachments').update({message_id:userMessage.id}).eq('user_id',user.id).eq('thread_id',conversationId).in('id',savedIds).or(`message_id.is.null,message_id.eq.${userMessage.id}`).select('id,name,mime_type,size_bytes,object_path,duration_ms');
        if(linked.error||linked.data?.length!==savedIds.length)throw new AttachmentError('An attachment is unavailable or already belongs to another message.');
        const metadata={...savedMetadata,attachments:linked.data};
        const stored=await admin.from('chat_messages').update({metadata}).eq('id',userMessage.id).eq('user_id',user.id);
        if(stored.error)throw new AttachmentError('The attachment reference could not be saved. Retry safely.');
        userMessage.metadata=metadata;
      }
      const budget={bytes:0};
      for(const item of (history||[]).reverse()){
        const metadata=isRecord(item.metadata)?item.metadata:{};
        let media;
        try{media=await loadAttachmentParts(admin,user.id,conversationId,metadata.attachmentIds,budget);}
        catch(error){if(item.id===userMessage?.id)throw error;media={parts:[{text:'An earlier attachment is unavailable for analysis. Ask the user to attach a supported version if it is needed.'}],refs:[]};}
        context.push({role:item.role as 'user'|'assistant',content:item.content,parts:media.parts});
      }
      output = await generateAgentReply(context, admin, user.id, conversationId, requestId, { signal, onPlan:plan=>{requestPlan=plan;}, onRichResponse:response=>{richResponse=readRichResponse(response)||undefined;}, onEvent: event=>{if(event.type==='text.delta'&&firstTextAt===undefined)firstTextAt=Date.now();emit?.(event);}, timezone: validTimezone(body.timezone) });
    } catch (error) {
      const code = error instanceof ProviderError ? error.code : "provider_unavailable";
      console.error("[chat] provider failure", { requestId: logId, code });
      await admin.from("ai_chat_requests").update({ status: "provider_failed", error_code: code, updated_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("request_id", requestId);
      return json({ ok: false, persistedUserMessage: true, error: code, message: error instanceof AttachmentError?error.message:providerMessage(code), userMessage, requestId });
    }

    const responseMetadata={provider:providerConfig().provider,model:getModel(),timings:{totalMs:Date.now()-requestStarted,firstTextMs:firstTextAt===undefined?null:firstTextAt-requestStarted},...(richResponse?{richResponse}:{}),...(requestPlan?{requestPlan}:{})};
    const { error: cacheError } = await admin.from("ai_chat_requests").update({
      response_text: output, response_metadata:responseMetadata as any, status: "persistence_failed", error_code: null, updated_at: new Date().toISOString(),
    }).eq("user_id", user.id).eq("request_id", requestId);
    if (cacheError) console.error("[chat] reply recovery record failed", { requestId: logId, code: cacheError.code || "db_error" });

    const { data: assistantMessage, error: assistantInsertError } = await admin.from("chat_messages").insert({
      user_id: user.id, thread_id: conversationId, role: "assistant", content: output, request_id: requestId,
      metadata: responseMetadata as any,
    }).select("id,role,content,created_at,metadata").single();
    if (assistantInsertError) {
      if (assistantInsertError.code === "23505") {
        const saved = await getRequestMessages(admin, user.id, conversationId, requestId);
        if (saved.assistantMessage) {
          await markCompleted(admin, user.id, requestId, output);
          return json({ ok: true, persisted: true, userMessage, assistantMessage: saved.assistantMessage, requestId });
        }
      }
      console.error("[chat] assistant save failed", { requestId: logId, code: assistantInsertError.code || "db_error" });
      return json({ ok: true, persisted: false, userMessage, output, requestId, message: "TARS replied, but the reply could not be saved. Retry saving it." });
    }

    await markCompleted(admin, user.id, requestId, output);
    if(richResponse)await publishRichActivity(admin,user.id,requestId,conversationId,richResponse);
    return json({ ok: true, persisted: true, userMessage, assistantMessage, requestId });
  } catch (error) {
    const code = isRecord(error) && typeof error.code === "string" ? error.code : "internal_error";
    console.error("[chat] request failed", { requestId: logId, code });
    return json({ ok: false, error: "chat_request_failed", message: "TARS could not finish that request. Your draft is available; retry safely." }, 500);
  }
}

async function persistAssistant(admin: AdminClient, userId: string, conversationId: string, requestId: string, request: Record<string, any> | null, logId: string) {
  if (!request) return json({ ok: false, error: "request_not_found", message: "There is no saved reply to recover." }, 404);
  const saved = await getRequestMessages(admin, userId, conversationId, requestId);
  if (saved.assistantMessage) return json({ ok: true, persisted: true, ...saved, requestId });
  const output = request.response_text;
  if (typeof output !== "string" || !output.trim() || output.length > MAX_OUTPUT_CHARS) {
    return json({ ok: false, error: "response_unavailable", message: "The reply is unavailable. Retry the original request to generate it again." }, 409);
  }
  const { data: assistantMessage, error } = await admin.from("chat_messages").insert({
    user_id: userId, thread_id: conversationId, role: "assistant", content: output, request_id: requestId,
    metadata:(isRecord(request.response_metadata)?request.response_metadata:{}) as any,
  }).select("id,role,content,created_at,metadata").single();
  if (error && error.code !== "23505") {
    console.error("[chat] reply recovery failed", { requestId: logId, code: error.code || "db_error" });
    return json({ ok: false, error: "persistence_failed", message: "Could not save the reply. Retry saving it." }, 503);
  }
  const messages = await getRequestMessages(admin, userId, conversationId, requestId);
  await markCompleted(admin, userId, requestId, output);
  const recovered=readRichResponse(request.response_metadata?.richResponse);if(recovered)await publishRichActivity(admin,userId,requestId,conversationId,recovered);
  return json({ ok: true, persisted: true, ...messages, assistantMessage: messages.assistantMessage || assistantMessage, requestId });
}

async function getRequestMessages(admin: AdminClient, userId: string, conversationId: string, requestId: string) {
  const { data, error } = await admin.from("chat_messages").select("id,role,content,created_at,metadata")
    .eq("user_id", userId).eq("thread_id", conversationId).eq("request_id", requestId).in("role", ["user", "assistant"]);
  if (error) throw error;
  return {
    userMessage: data?.find((item) => item.role === "user") || null,
    assistantMessage: data?.find((item) => item.role === "assistant") || null,
  };
}

async function markCompleted(admin: AdminClient, userId: string, requestId: string, output: string) {
  const { error } = await admin.from("ai_chat_requests").update({ status: "completed", response_text: output, error_code: null, updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("request_id", requestId);
  if (error) console.error("[chat] completion marker failed", { code: error.code || "db_error" });
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function validTimezone(value: unknown) {
  if (typeof value !== 'string' || value.length > 80) return 'UTC';
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return value; } catch { return 'UTC'; }
}

async function publishRichActivity(admin:AdminClient,owner:string,requestId:string,conversationId:string,response:RichResponse){
  const {data:question}=await admin.from('chat_messages').select('content').eq('user_id',owner).eq('thread_id',conversationId).eq('request_id',requestId).eq('role','user').maybeSingle();
  if(!question)return;
  const known=new Set(['Gmail','GitHub','Reddit','Slack','Notion','Jira','Trello','Instagram']);
  const providers=[...new Set(response.sources.map(source=>source.kind==='search'||source.kind==='page'?'Web':known.has(source.provider)?source.provider:'Connected service'))];
  const activity={version:1,query:question.content,title:(response.title||'Search results').slice(0,120),summary:response.summary.replace(/[*#`]/g,'').slice(0,900),category:response.intent,sources:providers.length?providers:['TARS'],status:response.status==='partial'?'partial':'completed',conversationId,sourceUrl:response.sources.find(source=>source.url)?.url||null};
  await admin.from('ai_chat_requests').update({activity}).eq('user_id',owner).eq('request_id',requestId);
}
