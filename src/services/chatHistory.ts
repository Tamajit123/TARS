import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type ChatThreadType = 'main' | 'side';
export type ChatMessageRole = 'user' | 'assistant';

type LocalThread = { id: string; type: ChatThreadType; title: string; has_unread_updates: boolean; created_at: string; updated_at: string };
type LocalMessage = { id: string; thread_id: string; role: ChatMessageRole; content: string; metadata: Record<string, unknown>; created_at: string };
type LocalStore = { threads: LocalThread[]; messages: LocalMessage[] };
const LOCAL_KEY = 'tars:local-chat:v1';
const readLocal = async (): Promise<LocalStore> => JSON.parse(await AsyncStorage.getItem(LOCAL_KEY) || '{"threads":[],"messages":[]}') as LocalStore;
const writeLocal = (store: LocalStore) => AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(store));
const localId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function requireUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Sign in to access your cloud conversations.');
  return user.id;
}

export const CreateNewThread = async (_userEmail: string, type: ChatThreadType, title?: string) => {
  if (!isSupabaseConfigured) {
    const store = await readLocal();
    const now = new Date().toISOString();
    const thread: LocalThread = { id: localId(), type, title: title || 'New conversation', has_unread_updates: false, created_at: now, updated_at: now };
    store.threads.unshift(thread);
    await writeLocal(store);
    return thread;
  }
  const userId = await requireUserId();
  const { data, error } = await supabase.from('chat_threads').insert({ user_id: userId, type, title: title || 'New conversation' }).select().single();
  if (error) throw error;
  return data;
};

export const getThread = async (threadId: string, _userEmail?: string) => {
  if (!isSupabaseConfigured) {
    const store = await readLocal();
    return threadId ? store.threads.find((thread) => thread.id === threadId) || null : store.threads.find((thread) => thread.type === 'main') || null;
  }
  const userId = await requireUserId();
  const query = supabase.from('chat_threads').select('*').eq('user_id', userId);
  const { data, error } = threadId
    ? await query.eq('id', threadId).maybeSingle()
    : await query.eq('type', 'main').maybeSingle();
  if (error) throw error;
  return data;
};

export const GetLatestThread = async (_userEmail: string) => {
  if (!isSupabaseConfigured) return (await readLocal()).threads[0] || null;
  const userId = await requireUserId();
  const { data, error } = await supabase.from('chat_threads').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
};

export const saveMessage = async (_userEmail: string, threadId: string, role: ChatMessageRole, content: string, metadata: Record<string, unknown> = {}) => {
  if (!isSupabaseConfigured) {
    const store = await readLocal();
    const now = new Date().toISOString();
    const message: LocalMessage = { id: localId(), thread_id: threadId, role, content, metadata, created_at: now };
    store.messages.push(message);
    store.threads = store.threads.map((thread) => thread.id === threadId ? { ...thread, title: thread.title === 'New conversation' && role === 'user' ? content.slice(0, 40) : thread.title, updated_at: now } : thread);
    await writeLocal(store);
    return message;
  }
  const userId = await requireUserId();
  const { data, error } = await supabase.from('chat_messages').insert({ user_id: userId, thread_id: threadId, role, content, metadata }).select().single();
  if (error) throw error;
  const update: Record<string, string> = { updated_at: new Date().toISOString() };
  if (role === 'user') update.title = content.slice(0, 40);
  const { error: updateError } = await supabase.from('chat_threads').update(update).eq('id', threadId).eq('user_id', userId);
  if (updateError) throw updateError;
  return data;
};

export const updateMessage = async (messageId: string, content: string, metadata: Record<string, unknown>) => {
  if (!isSupabaseConfigured) {
    const store = await readLocal();
    const message = store.messages.find((item) => item.id === messageId);
    if (!message) throw new Error('Message not found.');
    Object.assign(message, { content, metadata });
    await writeLocal(store);
    return message;
  }
  const userId = await requireUserId();
  const { data, error } = await supabase.from('chat_messages').update({ content, metadata }).eq('id', messageId).eq('user_id', userId).select().single();
  if (error) throw error;
  return data;
};

export const LoadMessages = async (threadId: string) => {
  if (!isSupabaseConfigured) return (await readLocal()).messages.filter((message) => message.thread_id === threadId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const userId = await requireUserId();
  const { data, error } = await supabase.from('chat_messages').select('*').eq('thread_id', threadId).eq('user_id', userId).order('created_at', { ascending: true });
  if (error) throw error;
  return data;
};

export const GetAllUserThreads = async (_userEmail: string) => {
  if (!isSupabaseConfigured) return [...(await readLocal()).threads].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const userId = await requireUserId();
  const { data, error } = await supabase.from('chat_threads').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const DeleteThread = async (threadId: string) => {
  if (!isSupabaseConfigured) {
    const store = await readLocal();
    store.threads = store.threads.filter((thread) => thread.id !== threadId);
    store.messages = store.messages.filter((message) => message.thread_id !== threadId);
    await writeLocal(store);
    return null;
  }
  const userId = await requireUserId();
  const { error } = await supabase.from('chat_threads').delete().eq('id', threadId).eq('user_id', userId);
  if (error) throw error;
  return null;
};
