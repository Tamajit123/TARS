import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';
import {recoverFailedReply} from '@/lib/pendingReply';

// A single collection of conversations; the legacy storage column is not a UI category.
type ChatThreadType = 'side';
export type ChatMessageRole = 'user' | 'assistant';

type LocalThread = { id: string; type: ChatThreadType; title: string; has_unread_updates: boolean; created_at: string; updated_at: string };
type LocalMessage = { id: string; thread_id: string; role: ChatMessageRole; content: string; metadata: Record<string, Json | undefined>; created_at: string };
type LocalStore = { threads: LocalThread[]; messages: LocalMessage[] };
const LOCAL_KEY = 'tars:local-chat:v1';
const OFFLINE_MODE_KEY = 'tars:offline-preview';
export const shouldUseLocalChat = async () => !isSupabaseConfigured || (await AsyncStorage.getItem(OFFLINE_MODE_KEY)) === '1';
const readLocal = async (): Promise<LocalStore> => JSON.parse(await AsyncStorage.getItem(LOCAL_KEY) || '{"threads":[],"messages":[]}') as LocalStore;
const writeLocal = (store: LocalStore) => AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(store));
const localId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function requireUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Sign in to access your cloud conversations.');
  return user.id;
}

export const CreateNewThread = async (_userEmail: string, title = 'New conversation') => {
  const type = 'side' as const;
  if (await shouldUseLocalChat()) {
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
  if(!threadId)return (await GetAllUserThreads(_userEmail||''))[0]||null;
  if (await shouldUseLocalChat()) {
    const store = await readLocal();
    return threadId ? store.threads.find((thread) => thread.id === threadId) || null : [...store.threads].sort((a,b)=>b.updated_at.localeCompare(a.updated_at))[0] || null;
  }
  const userId = await requireUserId();
  const query = supabase.from('chat_threads').select('*').eq('user_id', userId);
  const { data, error } = await query.eq('id', threadId).maybeSingle();
  if (error) throw error;
  return data;
};

export const GetLatestThread = async (_userEmail: string) => {
  if (await shouldUseLocalChat()) return (await readLocal()).threads[0] || null;
  const userId = await requireUserId();
  const { data, error } = await supabase.from('chat_threads').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
};

export const saveMessage = async (_userEmail: string, threadId: string, role: ChatMessageRole, content: string, metadata: Record<string, Json | undefined> = {}) => {
  if (await shouldUseLocalChat()) {
    const store = await readLocal();
    const now = new Date().toISOString();
    const message: LocalMessage = { id: localId(), thread_id: threadId, role, content, metadata, created_at: now };
    const firstUserMessage=role==='user'&&!store.messages.some(item=>item.thread_id===threadId&&item.role==='user'&&item.content.trim());
    store.messages.push(message);
    store.threads = store.threads.map((thread) => thread.id === threadId ? { ...thread, title: firstUserMessage&&['New Chat','New conversation','Main chat','Main conversation',''].includes(thread.title) ? content.replace(/\s+/g,' ').trim().slice(0,80)||thread.title : thread.title, updated_at: now } : thread);
    await writeLocal(store);
    return message;
  }
  const userId = await requireUserId();
  const { data, error } = await supabase.from('chat_messages').insert({ user_id: userId, thread_id: threadId, role, content, metadata }).select().single();
  if (error) throw error;
  const update: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
  const { error: updateError } = await supabase.from('chat_threads').update(update).eq('id', threadId).eq('user_id', userId);
  if (updateError) throw updateError;
  return data;
};

export const updateMessage = async (messageId: string, content: string, metadata: Record<string, Json | undefined>) => {
  if (await shouldUseLocalChat()) {
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
  if (await shouldUseLocalChat()) return (await readLocal()).messages.filter((message) => message.thread_id === threadId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const userId = await requireUserId();
  const { data, error } = await supabase.from('chat_messages').select('*').eq('thread_id', threadId).eq('user_id', userId).order('created_at', { ascending: true }).order('id', { ascending: true });
  if (error) throw error;
  return data;
};

export const GetAllUserThreads = async (_userEmail: string) => {
  if (await shouldUseLocalChat()) return [...(await readLocal()).threads].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  await requireUserId();
  const { data, error } = await supabase.rpc('get_tars_recents');
  if (error) throw error;
  return data;
};

export const DeleteThread = async (threadId: string) => {
  if (await shouldUseLocalChat()) {
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

export async function RenameThread(threadId:string,title:string){
  const value=title.replace(/\s+/g,' ').trim();
  if(!value||value.length>120)throw new Error('Use a conversation name between 1 and 120 characters.');
  if(await shouldUseLocalChat()){
    const store=await readLocal(),thread=store.threads.find(row=>row.id===threadId);
    if(!thread)throw new Error('Conversation not found.');thread.title=value;await writeLocal(store);return;
  }
  const owner=await requireUserId();
  const {data,error}=await supabase.from('chat_threads').update({title:value}).eq('id',threadId).eq('user_id',owner).select('id').single();
  if(error||!data)throw new Error('This conversation could not be renamed. Refresh and try again.');
}

export async function LoadFailedReply(threadId:string,messages:Parameters<typeof recoverFailedReply>[1]){
  const last=messages.at(-1);
  if(!last||last.role!=='user'||!last.request_id||await shouldUseLocalChat())return null;
  const owner=await requireUserId();
  // Request internals remain server-only; the Edge endpoint returns only the
  // authenticated owner's last-turn status and safe error classification.
  const {data,error}=await supabase.functions.invoke('agent-run',{body:{mode:'reply_status',conversationId:threadId,requestId:last.request_id}});
  if(error)throw error;
  if(!owner)return null;
  return recoverFailedReply(threadId,messages,data?.request||null);
}
