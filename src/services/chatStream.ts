import { fetch } from 'expo/fetch';
import { supabase } from '@/lib/supabase';
import { consumeChatStream, type ChatStreamEvent } from '@/lib/chatStream';

export async function streamChat(body: Record<string, unknown>, signal: AbortSignal, onEvent: (event: ChatStreamEvent) => void) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in to continue this conversation.');
  try{
  const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${session.access_token}`, apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '', 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ ...body, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  });
  if (!response.ok) throw new Error('TARS could not reach the chat service. Your message can be retried safely.');
  if (!response.body) throw new Error('Streaming is unavailable on this connection. Retry safely.');
  return await consumeChatStream(response.body, onEvent);
  }catch(error){
    if(signal.aborted)throw error;
    if(error instanceof TypeError||error instanceof Error&&/network error|fetch failed|failed to fetch|load failed/i.test(error.message))throw new Error('The connection was interrupted. Your saved message can be retried safely.');
    throw error;
  }
}
