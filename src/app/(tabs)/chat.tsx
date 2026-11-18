import {ComposerInput} from '@/components/chat/ComposerInput';
import {ChatKeyboardFrame} from '@/components/chat/ChatKeyboardFrame';
import {ResponseShare} from '@/components/chat/ResponseShare';
import { TabScreen } from '@/components/common/TabScreen';
import {ComposerMedia,DraftAttachments} from '@/components/chat/ComposerMedia';
import {MessageAttachments} from '@/components/chat/MessageAttachments';
import {makeAttachment,uploadAttachment,discardAttachment,type AttachmentDraft} from '@/services/attachments';
import {MAX_ATTACHMENTS,MAX_TURN_ATTACHMENT_BYTES,type AttachmentRef} from '../../../supabase/functions/_shared/mediaPolicy';
import { MascotAvatar } from '@/components/common/MascotAvatar';
import { ConfirmationCard } from '@/components/chat/ConfirmationCard';
import type { Database } from '@/types/database';
import { streamChat } from '@/services/chatStream';
import * as Clipboard from 'expo-clipboard';
import { useAppTheme } from '@/context/ThemeContext';
import type { ColorPalette } from '@/constants/colors';

import { showToast } from '@/context/ToastContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { CreateNewThread, getThread, LoadMessages, LoadFailedReply, saveMessage, shouldUseLocalChat } from '@/services/chatHistory';
import { ChatMessage } from '@/types';
import { SentIcon, Add01Icon } from '@/constants/icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import {RichResponseView} from '@/components/chat/RichResponseView';
import {readRichResponse} from '../../../supabase/functions/_shared/richResponse';
import { AssistantText } from '@/components/chat/AssistantText';
import { ExecutionCard } from '@/components/chat/ExecutionCard';
import { chatTimeline } from '@/lib/chatTimeline';
import { toolActivity } from '@/lib/toolActivity';
import {rememberConversation,forgetConversation} from '@/services/navigationState';
import type { ToolExecution } from '@/types/execution';

type PendingRequest = { conversationId: string; requestId: string; message: string; attachmentIds?:string[]; action: 'send' | 'persist-assistant'; output?: string };

export default function ChatScreen() {
  const params = useLocalSearchParams<{ thread_id?: string | string[];clean?:string }>();
  const routeThreadId = Array.isArray(params.thread_id) ? params.thread_id[0] : params.thread_id;
  const [owner, setOwner] = useState<string | undefined>(isSupabaseConfigured ? undefined : 'offline');
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    let observedSession = false;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      observedSession = true;
      if (active) setOwner(session?.user.id || 'offline');
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active && !observedSession) setOwner(data.session?.user.id || 'offline');
    }).catch(() => { if (active && !observedSession) setOwner('offline'); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  if (owner === undefined) return <ActivityIndicator accessibilityLabel="Opening chat" />;
  // Router reuses this screen between threads. Remount the conversation so a late
  // reply, pending upload or unsent attachment cannot enter another thread/account.
  return <ConversationScreen owner={owner} key={JSON.stringify([owner, routeThreadId || (params.clean==='1'?'clean':'latest')])} />;
}

function ConversationScreen({owner}:{owner:string}) {
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  const router = useRouter();
  const params = useLocalSearchParams<{ thread_id?: string | string[];clean?:string }>();
  const routeThreadId = Array.isArray(params.thread_id) ? params.thread_id[0] : params.thread_id;
  const cleanStart=params.clean==='1'&&!routeThreadId;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [drafts,setDrafts]=useState<AttachmentDraft[]>([]);
  const uploadController=useRef<AbortController|null>(null);
  const addDrafts=(items:AttachmentDraft[])=>{const next=[...drafts,...items.filter(item=>!drafts.some(old=>(item.uri&&old.uri===item.uri)||(item.blob&&old.blob===item.blob)))];if(next.length>MAX_ATTACHMENTS||next.reduce((sum,item)=>sum+item.size,0)>MAX_TURN_ATTACHMENT_BYTES){showToast('Attach up to four files, 20 MB total.');return false;}setDrafts(next);return true;};
  const uploadDraft=async(draft:AttachmentDraft,conversationId=threadId)=>{
    if(!conversationId)throw new Error('Wait for the conversation to open.');if(uploadController.current)throw new Error('Wait for the current upload or cancel it first.');
    const controller=new AbortController();uploadController.current=controller;
    setDrafts(rows=>rows.map(row=>row.id===draft.id?{...row,status:'uploading',error:undefined}:row));
    try{const ref=await uploadAttachment(draft,conversationId,controller.signal,progress=>setDrafts(rows=>rows.map(row=>row.id===draft.id?{...row,progress}:row)));setDrafts(rows=>rows.map(row=>row.id===draft.id?{...row,status:'uploaded',progress:1,ref}:row));return ref;}
    catch(error){setDrafts(rows=>rows.map(row=>row.id===draft.id?{...row,status:'failed',error:error instanceof Error?error.message:'Upload failed.'}:row));throw error;}
    finally{if(uploadController.current===controller)uploadController.current=null;}
  };
  const [threadId, setThreadId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userReady, setUserReady] = useState(!isSupabaseConfigured);
  const [offlinePreview, setOfflinePreview] = useState(!isSupabaseConfigured);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [streamActivity, setStreamActivity] = useState('');
  const [showLatest, setShowLatest] = useState(false);
  const nearBottom = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [toolRuns, setToolRuns] = useState<ToolExecution[]>([]);
  const [confirmations, setConfirmations] = useState<Database['public']['Tables']['pending_tool_actions']['Row'][]>([]);
  const [actionRevision, setActionRevision] = useState(0);
  const hasRunningTools = toolRuns.some(run => run.status === 'running');
  const timeline = chatTimeline(messages, toolRuns);
  const sendingRef = useRef(false);
  const scrollRef = useRef<any>(null);
  const loadRevision = useRef(0);


  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserEmail(data.session?.user.email || '');
      void shouldUseLocalChat().then(setOfflinePreview);
      setUserReady(true);
    }).catch(() => { if (active) setUserReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email || '');
      if (session) setOfflinePreview(false);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const loadConversation = useCallback(async (refresh = false) => {
    if (!userReady) return;
    const revision = ++loadRevision.current;
    if (refresh) setRefreshing(true); else setLoading(true);
    if (!refresh) { setThreadId(null); setMessages([]); setToolRuns([]); setConfirmations([]); }
    setError('');
    if(cleanStart&&!refresh){setLoading(false);setRefreshing(false);return;}
    try {
      let thread = await getThread(routeThreadId || '', userEmail);
      if (revision !== loadRevision.current) return;
      if (!routeThreadId && !thread) thread = await CreateNewThread(userEmail);
      if (revision !== loadRevision.current) return;
      if (!thread) throw new Error('Conversation not found or no longer available.');
      setThreadId(thread.id);
      const rows = await LoadMessages(thread.id);
      if (revision !== loadRevision.current) return;
      setMessages((rows || []).map((row: any) => ({
        id: row.id,
        sender: row.role === 'user' ? 'user' : 'agent',
        text: row.content,
        timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        richResponse:readRichResponse(row.metadata?.richResponse)||undefined, createdAt: row.created_at, requestId: row.request_id,attachments:row.metadata?.attachments as AttachmentRef[]|undefined,
      })));
      const recovered=await LoadFailedReply(thread.id,rows||[]).catch(()=>null);
      if(revision!==loadRevision.current)return;
      setPendingRequest(recovered?.request||null);
      if(recovered)setError(recovered.notice);
      if(owner!=='offline')void rememberConversation(owner,thread.id).catch(()=>{});
    } catch {
      if (revision !== loadRevision.current) return;
      setThreadId(null);
      setMessages([]);
      if(owner!=='offline')void forgetConversation(owner).catch(()=>{});
      setError('Could not load this conversation. Check your connection and try again.');
    } finally { if (revision === loadRevision.current) { setLoading(false); setRefreshing(false); } }
  }, [routeThreadId, userEmail, userReady,cleanStart,owner]);

  useEffect(() => { const revision = loadRevision; void loadConversation(); return () => { revision.current++; }; }, [loadConversation]);
  useEffect(() => {
    if (!threadId || offlinePreview) return;
    let active = true;
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const { data, error } = await supabase.from('agent_tool_runs').select('id,action_name,status,metadata,created_at,started_at,finished_at,output_summary,error_message')
          .filter('metadata->>conversation_id', 'eq', threadId).order('created_at', { ascending: false }).limit(50);
        const pending = await supabase.from('pending_tool_actions').select('*').eq('conversation_id', threadId).order('created_at', { ascending: true }).limit(20);
        if (active && !pending.error && pending.data) setConfirmations(pending.data);
        if (active && !error && data) setToolRuns(data.map(run => ({ ...run, metadata: run.metadata && typeof run.metadata === 'object' && !Array.isArray(run.metadata) ? run.metadata : {} })));
      } finally { busy = false; }
    };
    void refresh();
    const interval = sending || hasRunningTools ? setInterval(() => void refresh(), 1200) : undefined;
    return () => { active = false; if (interval) clearInterval(interval); };
  }, [threadId, offlinePreview, sending, hasRunningTools, actionRevision]);
  useEffect(() => { if (nearBottom.current) scrollRef.current?.scrollToEnd({ animated: false }); }, [messages, toolRuns.length, streamText]);
  useEffect(() => () => { abortRef.current?.abort();uploadController.current?.abort(); }, []);
  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const subscription = Keyboard.addListener(event, () => { if (nearBottom.current) setTimeout(() => { if (nearBottom.current) scrollRef.current?.scrollToEnd({ animated: false }); }, 100); });
    return () => subscription.remove();
  }, []);

  const invokePending = async (request: PendingRequest) => {
    const controller = new AbortController(); abortRef.current = controller;
    const activeTools=new Map<string,number>();
    setStreamText(''); setStreamActivity('');
    try {
      return await streamChat({ action: request.action, conversationId: request.conversationId, requestId: request.requestId, message: request.message,attachmentIds:request.attachmentIds }, controller.signal, event => {
        if (event.type === 'text.delta' && typeof event.delta === 'string') setStreamText(current => current + event.delta);
        if (event.type === 'tool.started') {const name=event.name||'service';activeTools.set(name,(activeTools.get(name)||0)+1);setStreamActivity(toolActivity(name));setStreamText('');}
        if (event.type === 'tool.completed') {const name=event.name||'service',count=activeTools.get(name)||0;if(count>1)activeTools.set(name,count-1);else activeTools.delete(name);setStreamActivity(activeTools.size?toolActivity(activeTools.keys().next().value):'Preparing your reply');}
      });
    } finally { if (abortRef.current === controller) abortRef.current = null; }
  };

  const appendServerMessage = (item: any, requestId?: string) => {
    if (!item || typeof item.id !== 'string' || typeof item.content !== 'string') return;
    setMessages((current) => {
      const existing = item.role === 'user' && requestId ? current.filter(message => message.id !== `pending-${requestId}`) : current;
      return existing.some((message) => message.id === item.id) ? existing : [...existing, {
      id: item.id,
      sender: item.role === 'user' ? 'user' : 'agent',
      text: item.content,
      timestamp: new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      richResponse:readRichResponse(item.metadata?.richResponse)||undefined, createdAt: item.created_at || new Date().toISOString(), requestId,attachments:item.metadata?.attachments,
    }]; });
  };

  const performRequest = async (request: PendingRequest) => {
    if(owner!=='offline')void forgetConversation(owner).catch(()=>{});
    try {
      const data = await invokePending(request);
      if(data.userMessage?.id)setDrafts(rows=>rows.filter(row=>!request.attachmentIds?.includes(row.id)));
      setStreamText(''); setStreamActivity('');
      if (data.persisted === true) {
        setMessages((current) => current.filter((message) => message.id !== `unsaved-${request.requestId}`));
        appendServerMessage(data.userMessage, request.requestId);
        appendServerMessage(data.assistantMessage);
        setPendingRequest(null);
        setError('');
        setInputText((current) => current === request.message ? '' : current);
        if(owner!=='offline')void rememberConversation(owner,request.conversationId).catch(()=>{});
        return true;
      } else if (data.persisted === false && typeof data.output === 'string') {
        appendServerMessage(data.userMessage, request.requestId);
        setMessages((current) => current.some((message) => message.id === `unsaved-${request.requestId}`) ? current : [...current, {
          id: `unsaved-${request.requestId}`, sender: 'agent', text: data.output,
          createdAt: new Date().toISOString(), requestId: request.requestId,
          timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        }]);
        setPendingRequest({ ...request, action: 'persist-assistant', output: data.output });
        setError('TARS replied, but the reply is not saved yet. Retry saving it.');
      } else if (data.persistedUserMessage) {
        appendServerMessage(data.userMessage, request.requestId);
        setPendingRequest(request);
        setError(typeof data.message === 'string' ? data.message : 'Your message is saved, but TARS could not reply. Retry safely.');
      } else {
        throw new Error(typeof data.message === 'string' ? data.message : 'TARS could not finish that request. Your draft is still available.');
      }
    } catch (cause) {
      setPendingRequest(request);
      setError(cause instanceof Error && cause.name === 'AbortError' ? 'Generation stopped. Your saved message can be retried.' : cause instanceof Error ? cause.message : 'TARS could not finish that request. Retry safely.');
      setStreamActivity('');
    }
  };

  const handleSend = async () => {
    const text = inputText.trim() || (drafts.length?'Please help me with the attached files.':'');
    if (!text || sendingRef.current || sending) return;
    if (text.length > 12000) { showToast('Keep a message under 12,000 characters.'); return; }
    sendingRef.current = true; setSending(true);
    setError('');
    try {
      const conversationId=threadId||(await CreateNewThread(userEmail)).id;
      if(!threadId)setThreadId(conversationId);
      if(owner!=='offline')void rememberConversation(owner,conversationId).catch(()=>{});
      if (await shouldUseLocalChat()) {
        if(drafts.length)throw new Error('Sign in to send attachments.');
        const saved = await saveMessage(userEmail, conversationId, 'user', text, {});
        setMessages((current) => [...current, { id: saved.id, sender: 'user', text, timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }]);
        setInputText('');
        showToast('Saved on this device. Add Supabase and AI settings to enable replies.');
        return;
      }
      const refs:AttachmentRef[]=[];for(const draft of drafts)refs.push(draft.ref||await uploadDraft(draft,conversationId));
      const request: PendingRequest = { conversationId, requestId: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`, message: text, attachmentIds:refs.map(ref=>ref.id),action: 'send' };
      const createdAt = new Date().toISOString();
      setMessages(current => [...current, { id: `pending-${request.requestId}`, sender: 'user', text,attachments:refs, requestId: request.requestId, createdAt, timestamp: new Date(createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }]);
      setInputText('');
      nearBottom.current = true; setShowLatest(false);
      const saved=await performRequest(request);
      if(saved&&cleanStart)router.replace({pathname:'/(tabs)/chat',params:{thread_id:conversationId}});
    } catch(cause) {
      setError(cause instanceof Error?cause.message:'Your message could not be saved. Check the connection and try again.');showToast(cause instanceof Error?cause.message:'Message could not be saved.');
    } finally { sendingRef.current = false; setSending(false); }
  };

  const retry = async () => {
    if (!pendingRequest || sendingRef.current || sending) return;
    sendingRef.current = true; setSending(true);
    setError('');
    try { const saved=await performRequest(pendingRequest);if(saved&&cleanStart)router.replace({pathname:'/(tabs)/chat',params:{thread_id:pendingRequest.conversationId}}); }
    finally { sendingRef.current = false; setSending(false); }
  };

  const newConversation = async () => {
    try {
      const thread = await CreateNewThread(userEmail);
      setInputText('');
      router.replace({ pathname: '/(tabs)/chat', params: { thread_id: thread.id } });
    } catch {
      showToast('Could not start a new conversation.');
    }
  };

  return (
    <TabScreen style={styles.container}><ChatKeyboardFrame>
      <View style={styles.content}>
        <ScrollView onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; const next = contentSize.height - contentOffset.y - layoutMeasurement.height < 100; if (next !== nearBottom.current) { nearBottom.current = next; setShowLatest(!next); } }} scrollEventThrottle={100} onLayout={() => { if(nearBottom.current)scrollRef.current?.scrollToEnd({animated:false}); }} onContentSizeChange={() => { if (nearBottom.current) scrollRef.current?.scrollToEnd({ animated: false }); }} ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : Platform.OS === 'web' ? 'none' : 'on-drag'} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadConversation(true)} tintColor={Colors.primary} />}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}><View style={styles.inner}>

            {loading ? <View style={styles.state}><ActivityIndicator color={Colors.primary} /><Text style={styles.stateText}>Opening your conversation…</Text></View> : error && messages.length === 0 ? <View style={styles.state}><Text style={styles.stateTitle}>Conversation unavailable</Text><Text style={styles.stateText}>{error}</Text><Pressable onPress={() => loadConversation()} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable></View> : messages.length === 0 ? (
              <View style={styles.welcome}>
                <MascotAvatar size={56} />
                <Text style={styles.welcomeTitle}>What can I help with?</Text>
                <Text style={styles.welcomeCopy}>{!offlinePreview ? 'A useful next step, a clearer plan, or a little less on your plate.' : 'Your messages will stay on this device. Connect an account to get AI replies.'}</Text>
                {!offlinePreview ? <View style={{ width: '100%', maxWidth: 360, gap: 10, marginTop: 28 }}>{['Summarize my unread emails today', 'What is on my calendar tomorrow?', 'Find my project notes about TARS'].map(prompt => <Pressable key={prompt} onPress={() => setInputText(prompt)} accessibilityRole="button" style={{ minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border }}><Text style={{ color: Colors.textPrimary, fontSize: 15, lineHeight: 21 }}>{prompt}</Text></Pressable>)}</View> : null}
                <Pressable onPress={newConversation} style={styles.newChatButton} accessibilityRole="button"><HugeiconsIcon icon={Add01Icon} size={15} color={Colors.primaryLight} /><Text style={styles.newChatText}>Start another conversation</Text></Pressable>
              </View>
            ) : timeline.map((item) => {
              if (item.kind === 'execution') return <ExecutionCard key={item.execution.id} run={item.execution} />;
              const message = item.message;
              const isUser = message.sender === 'user';
              return <View key={message.id} style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}><View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}><>{isUser ? <View><Text selectable style={[styles.messageText, styles.userText]}>{message.text}</Text>{message.attachments?.length?<MessageAttachments items={message.attachments}/>:null}</View> : message.richResponse ? <RichResponseView response={message.richResponse}/> : <AssistantText text={message.text} color={Colors.textPrimary} linkColor={Colors.textLink} />}</>{!isUser ? <View style={{ flexDirection: 'row', gap: 12 }}><Pressable accessibilityRole="button" accessibilityLabel="Copy response" onPress={() => { void Clipboard.setStringAsync(message.text).then(() => showToast('Copied response')); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={styles.retryText}>Copy</Text></Pressable><ResponseShare text={message.text}/><Pressable disabled={sending} accessibilityRole="button" accessibilityLabel="Ask for a revised response" onPress={() => setInputText('Please give me another version of your last response.')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={styles.retryText}>Revise</Text></Pressable></View> : null}<Text style={[styles.time, isUser && styles.userTime]}>{message.timestamp}</Text></View></View>;
            })}
            {error && messages.length > 0 ? <View style={styles.errorNotice}><Text style={styles.errorText}>{error}</Text>{pendingRequest ? <Pressable onPress={retry} disabled={sending} accessibilityRole="button"><Text style={styles.retryText}>{sending ? 'Retrying…' : pendingRequest.action === 'persist-assistant' ? 'Retry save' : 'Retry'}</Text></Pressable> : null}</View> : null}
            {confirmations.map(action => <ConfirmationCard key={action.id} action={action} onChanged={() => setActionRevision(value => value + 1)} />)}
            {streamText ? <View style={[styles.bubble, styles.assistantBubble, { marginVertical: 8 }]}><AssistantText text={streamText} color={Colors.textPrimary} linkColor={Colors.textLink} /></View> : null}
            {sending ? <View style={styles.typing}><ActivityIndicator size="small" color={Colors.primary} /><Text style={styles.typingText}>{streamActivity || (streamText ? 'Writing your reply' : 'Thinking')}</Text><Pressable accessibilityRole="button" accessibilityLabel="Stop generation" onPress={() => abortRef.current?.abort()} style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' }}><Text style={styles.retryText}>Stop</Text></Pressable></View> : null}

          </View></TouchableWithoutFeedback>
        </ScrollView>
        {showLatest ? <Pressable accessibilityRole="button" onPress={() => { nearBottom.current = true; setShowLatest(false); scrollRef.current?.scrollToEnd({ animated: false }); }} style={{ alignSelf: 'center', padding: 12, backgroundColor: Colors.surfaceElevated, borderRadius: 20 }}><Text style={styles.retryText}>Latest messages</Text></Pressable> : null}<View style={[styles.composerWrap,{flexShrink:0}]}>{inputText.length>12000?<Pressable accessibilityRole="button" onPress={()=>{const value=inputText;if(value.length>120000){showToast('Split text longer than 120,000 characters. Nothing was truncated.');return;}const blob=new Blob([value],{type:'text/plain'});void makeAttachment({name:'Pasted text.txt',uri:'',blob,size:blob.size}).then(draft=>{if(addDrafts([draft]))setInputText('');}).catch(cause=>showToast(cause.message));}} style={{minHeight:44,justifyContent:'center'}}><Text style={styles.retryText}>Attach this long text ({inputText.length.toLocaleString()} characters)</Text></Pressable>:null}{drafts.length?<DraftAttachments drafts={drafts} onCancel={()=>uploadController.current?.abort()} onRetry={id=>{const draft=drafts.find(d=>d.id===id);if(draft&&!sending&&!uploadController.current)void uploadDraft(draft).catch(()=>{});}} onRemove={id=>{const draft=drafts.find(d=>d.id===id);if(draft&&!sending)void discardAttachment(draft).then(()=>setDrafts(rows=>rows.filter(row=>row.id!==id))).catch(cause=>showToast(cause.message));}}/>:null}<ComposerMedia onAdd={addDrafts} disabled={sending||loading||offlinePreview} onError={showToast} onLocation={origin=>setInputText(current=>`${current}${current?" ":""}My starting location: ${origin}`)}>{({attachmentButton,voiceButton})=><View style={styles.composer}>{attachmentButton}<ComposerInput value={inputText} onChangeText={setInputText} placeholder="Message TARS…" placeholderTextColor={Colors.textMuted} style={styles.input} editable={!sending && !loading} onFocus={() => { if (nearBottom.current) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100); }} accessibilityLabel="Message TARS" />{voiceButton}<Pressable style={({ pressed }) => [styles.sendButton, pressed && styles.pressed, ((!inputText.trim() && !drafts.length) || sending || loading) && styles.sendDisabled]} onPress={handleSend} disabled={(!inputText.trim() && !drafts.length) || sending || loading} accessibilityRole="button" accessibilityLabel="Send message">{sending ? <ActivityIndicator size="small" color={Colors.onPrimary} /> : <HugeiconsIcon icon={SentIcon} size={18} color={Colors.onPrimary} strokeWidth={2} />}</Pressable></View>}</ComposerMedia><Text style={styles.composerNote}>{offlinePreview ? 'Offline preview · Stored on this device' : 'AI can make mistakes. Review important details.'}</Text></View>
      </View>
    </ChatKeyboardFrame></TabScreen>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface }, content: { flex: 1, minHeight: 0, justifyContent: 'space-between' }, scroll: { flex: 1, minHeight: 0 }, scrollContent: { flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }, inner: { flexGrow: 1 }, day: { alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 6, marginVertical: 10, borderRadius: 12, backgroundColor: Colors.surface }, dayText: { color: Colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  welcome: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }, signal: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: Colors.primaryBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 15 }, signalDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.primary }, welcomeTitle: { color: Colors.textPrimary, fontSize: 28, fontWeight: '600', textAlign: 'center', letterSpacing: -0.7, marginTop: 20 }, welcomeCopy: { color: Colors.textSecondary, maxWidth: 320, fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 8 }, newChatButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 13, backgroundColor: Colors.primarySubtle }, newChatText: { color: Colors.primaryLight, fontSize: 12, fontWeight: '700' },
  state: { flex: 1, minHeight: 230, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 }, stateTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' }, stateText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center' }, retryButton: { marginTop: 6, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 12, backgroundColor: Colors.primarySubtle }, retryText: { color: Colors.primaryLight, fontSize: 15, fontWeight: '500' },
  messageRow: { width: '100%', flexDirection: 'row', marginVertical: 10 }, userRow: { justifyContent: 'flex-end' }, assistantRow: { justifyContent: 'flex-start' }, bubble: { maxWidth: '88%', borderRadius: 19, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 8, borderWidth: 1 }, userBubble: { backgroundColor: Colors.chatBubbleUser, borderColor: 'transparent', borderBottomRightRadius: 20 }, assistantBubble: { maxWidth: '100%', width: '100%', backgroundColor: 'transparent', borderColor: 'transparent', paddingHorizontal: 2, paddingVertical: 12 }, messageText: { fontSize: 17, lineHeight: 25, letterSpacing: -0.1 }, userText: { color: Colors.chatBubbleUserText }, assistantText: { color: Colors.textPrimary }, time: { alignSelf: 'flex-end', color: Colors.textMuted, fontSize: 11, marginTop: 6 }, userTime: { color: Colors.textSecondary }, typing: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }, typingText: { color: Colors.textMuted, fontSize: 15 }, errorNotice: { borderWidth: 1, borderColor: Colors.error, backgroundColor: Colors.errorLight, borderRadius: 13, padding: 12, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }, errorText: { flex: 1, color: Colors.error, fontSize: 11, lineHeight: 17 },
  composerWrap: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 7, paddingBottom: Platform.OS === 'ios' ? 10 : 8, backgroundColor: Colors.surface }, composer: { minHeight: 54, maxHeight: 132, flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, borderRadius: 26, padding: 6, gap: 8 }, input: { flex: 1, minWidth:0, minHeight: 40, maxHeight: 118, color: Colors.textPrimary, fontSize: 17, lineHeight: 24, paddingHorizontal: 10, paddingTop: Platform.OS === 'ios' ? 10 : 8, paddingBottom: 8 }, sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary }, sendDisabled: { opacity: 0.45 }, pressed: { opacity: 0.8 }, composerNote: { textAlign: 'center', color: Colors.textMuted, fontSize: 11, marginTop: 8, letterSpacing: 0.2 },
});
