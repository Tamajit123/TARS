// ✅ CORRECT in React Native / Expo:
import { createClient } from '@supabase/supabase-js';

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
const PROVIDER_TIMEOUT_MS = 30_000;
const IN_PROGRESS_MS = 90_000;

Deno.serve(async (request) => {
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

  const authClient = createClient(supabaseUrl, anonKey, {
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

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: thread, error: threadError } = await admin.from("chat_threads")
      .select("id,user_id").eq("id", conversationId).eq("user_id", user.id).maybeSingle();
    if (threadError) throw threadError;
    if (!thread) return json({ ok: false, error: "conversation_not_found", message: "This conversation is unavailable or belongs to another account." }, 404);

    const { data: previous, error: previousError } = await admin.from("ai_chat_requests")
      .select("id,status,response_text,updated_at")
      .eq("user_id", user.id).eq("conversation_id", conversationId).eq("request_id", requestId).maybeSingle();
    if (previousError) throw previousError;

    if (action === "persist-assistant") {
      const candidate = typeof body.output === "string" && body.output.length <= MAX_OUTPUT_CHARS ? body.output : undefined;
      return await persistAssistant(admin, user.id, conversationId, requestId, previous, candidate, logId);
    }

    const message = body.message;
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
      user_id: user.id, thread_id: conversationId, role: "user", content: message.trim(), request_id: requestId,
    }).select("id,role,content,created_at").single();
    let userMessage = savedUser;
    if (userInsertError?.code === "23505") {
      const { data, error } = await admin.from("chat_messages").select("id,role,content,created_at")
        .eq("user_id", user.id).eq("thread_id", conversationId).eq("request_id", requestId).eq("role", "user").single();
      if (error) throw error;
      userMessage = data;
    } else if (userInsertError) throw userInsertError;

    await admin.from("chat_threads").update({ title: message.trim().slice(0, 80), updated_at: new Date().toISOString() })
      .eq("id", conversationId).eq("user_id", user.id);
    const { data: history, error: historyError } = await admin.from("chat_messages")
      .select("role,content").eq("user_id", user.id).eq("thread_id", conversationId)
      .in("role", ["user", "assistant"]).order("created_at", { ascending: false }).limit(MAX_CONTEXT_MESSAGES);
    if (historyError) throw historyError;
    const context = (history || []).reverse().map((item) => ({ role: item.role as "user" | "assistant", content: item.content }));

    let output: string;
    try {
      output = await generateGeminiReply(context);
    } catch (error) {
      const code = error instanceof ProviderError ? error.code : "provider_unavailable";
      console.error("[chat] provider failure", { requestId: logId, code });
      await admin.from("ai_chat_requests").update({ status: "provider_failed", error_code: code, updated_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("request_id", requestId);
      return json({ ok: false, persistedUserMessage: true, error: code, message: providerMessage(code), userMessage, requestId });
    }

    const { error: cacheError } = await admin.from("ai_chat_requests").update({
      response_text: output, status: "persistence_failed", error_code: null, updated_at: new Date().toISOString(),
    }).eq("user_id", user.id).eq("request_id", requestId);
    if (cacheError) console.error("[chat] reply recovery record failed", { requestId: logId, code: cacheError.code || "db_error" });

    const { data: assistantMessage, error: assistantInsertError } = await admin.from("chat_messages").insert({
      user_id: user.id, thread_id: conversationId, role: "assistant", content: output, request_id: requestId,
      metadata: { provider: "gemini", model: Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash" },
    }).select("id,role,content,created_at").single();
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
    return json({ ok: true, persisted: true, userMessage, assistantMessage, requestId });
  } catch (error) {
    const code = isRecord(error) && typeof error.code === "string" ? error.code : "internal_error";
    console.error("[chat] request failed", { requestId: logId, code });
    return json({ ok: false, error: "chat_request_failed", message: "TARS could not finish that request. Your draft is available; retry safely." }, 500);
  }
});

async function generateGeminiReply(messages: Array<{ role: "user" | "assistant"; content: string }>) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new ProviderError("provider_not_configured");
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const instructions = [
    "You are TARS, a capable personal AI assistant.",
    "Distinguish verified facts from uncertainty, do not invent sources, and admit when you do not know.",
    "You have no external tools or live web access. Do not claim to send messages, browse, schedule, or change external data.",
    "If a request requires an unavailable integration, state that clearly and offer a safe next step.",
  ].join(" ");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instructions }] },
      contents: messages.map((item) => ({ role: item.role === "assistant" ? "model" : "user", parts: [{ text: item.content }] })),
      generationConfig: { maxOutputTokens: 1200, temperature: 0.7 },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ProviderError(response.status === 429 ? "provider_rate_limited" : "provider_error");
  const output = data?.candidates?.[0]?.content?.parts?.map((part: { text?: unknown }) => typeof part.text === "string" ? part.text : "").join("").trim();
  if (!output) throw new ProviderError("empty_provider_response");
  return output.slice(0, MAX_OUTPUT_CHARS);
}

async function persistAssistant(admin: ReturnType<typeof createClient>, userId: string, conversationId: string, requestId: string, request: Record<string, any> | null, suppliedOutput: string | undefined, logId: string) {
  if (!request) return json({ ok: false, error: "request_not_found", message: "There is no saved reply to recover." }, 404);
  const saved = await getRequestMessages(admin, userId, conversationId, requestId);
  if (saved.assistantMessage) return json({ ok: true, persisted: true, ...saved, requestId });
  const output = request.response_text || suppliedOutput;
  if (typeof output !== "string" || !output.trim() || output.length > MAX_OUTPUT_CHARS) {
    return json({ ok: false, error: "response_unavailable", message: "The reply is unavailable. Retry the original request to generate it again." }, 409);
  }
  const { data: assistantMessage, error } = await admin.from("chat_messages").insert({
    user_id: userId, thread_id: conversationId, role: "assistant", content: output, request_id: requestId,
  }).select("id,role,content,created_at").single();
  if (error && error.code !== "23505") {
    console.error("[chat] reply recovery failed", { requestId: logId, code: error.code || "db_error" });
    return json({ ok: false, error: "persistence_failed", message: "Could not save the reply. Retry saving it." }, 503);
  }
  const messages = await getRequestMessages(admin, userId, conversationId, requestId);
  await markCompleted(admin, userId, requestId, output);
  return json({ ok: true, persisted: true, ...messages, assistantMessage: messages.assistantMessage || assistantMessage, requestId });
}

async function getRequestMessages(admin: ReturnType<typeof createClient>, userId: string, conversationId: string, requestId: string) {
  const { data, error } = await admin.from("chat_messages").select("id,role,content,created_at")
    .eq("user_id", userId).eq("thread_id", conversationId).eq("request_id", requestId).in("role", ["user", "assistant"]);
  if (error) throw error;
  return {
    userMessage: data?.find((item) => item.role === "user") || null,
    assistantMessage: data?.find((item) => item.role === "assistant") || null,
  };
}

async function markCompleted(admin: ReturnType<typeof createClient>, userId: string, requestId: string, output: string) {
  const { error } = await admin.from("ai_chat_requests").update({ status: "completed", response_text: output, error_code: null, updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("request_id", requestId);
  if (error) console.error("[chat] completion marker failed", { code: error.code || "db_error" });
}

function providerMessage(code: string) {
  if (code === "provider_not_configured") return "The Gemini service is not configured yet. Your message is saved; contact the app administrator.";
  if (code === "provider_rate_limited") return "Gemini is receiving too many requests. Wait a moment and retry.";
  return "Gemini could not reply right now. Your message is saved; retry in a moment.";
}
class ProviderError extends Error { constructor(readonly code: string) { super(code); } }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
