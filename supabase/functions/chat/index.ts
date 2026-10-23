import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: { serve: (handler: (request: Request) => Response | Promise<Response>) => void; env: { get: (name: string) => string | undefined } };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Sign in to use chat." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !anonKey || !openAiKey) return json({ error: "Chat service is not configured." }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Your session is invalid or expired. Sign in again." }, 401);

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Request body must be JSON." }, 400); }
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 40) {
    return json({ error: "Send between 1 and 40 messages." }, 400);
  }
  let input: Array<{ role: "user" | "assistant"; content: string }>;
  try {
    input = messages.map((item) => {
      const record = item as { role?: unknown; content?: unknown };
      if (!['user', 'assistant'].includes(String(record?.role)) || typeof record?.content !== 'string' || !record.content.trim() || record.content.length > 12000) {
        throw new Error("invalid message");
      }
      return { role: record.role as "user" | "assistant", content: record.content.trim() };
    });
  } catch {
    return json({ error: "Each message needs a valid role and text up to 12,000 characters." }, 400);
  }
  if (input.reduce((size, item) => size + item.content.length, 0) > 80000) {
    return json({ error: "The conversation is too long. Start a new chat or remove older messages." }, 400);
  }
  if (input.filter((item) => item.role === 'user').length === 0) return json({ error: "A user message is required." }, 400);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
        instructions: "You are TARS, a capable personal AI assistant. Be precise and transparent. Distinguish suggestions from actions; never claim to have executed an action unless an authorized tool actually did so. You do not have external tools in this chat.",
        input,
        max_output_tokens: 1200,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[chat] Provider request failed", response.status);
      return json({ error: "TARS could not complete that reply. Try again shortly." }, 502);
    }
    const output = typeof data.output_text === "string" ? data.output_text.trim() : "";
    if (!output) return json({ error: "TARS returned an empty reply. Please try again." }, 502);
    return json({ output });
  } catch (error) {
    console.error("[chat] Request failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "Chat service is temporarily unavailable." }, 502);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
