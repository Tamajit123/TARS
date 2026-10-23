import { Colors } from '@/constants/colors';
import { showToast } from '@/context/ToastContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { CreateNewThread, getThread, LoadMessages, saveMessage } from '@/services/chatHistory';
import { ChatMessage } from '@/types';
import { SentIcon, Add01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RequestMessage = { role: 'user' | 'assistant'; content: string };

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ thread_id?: string | string[] }>();
  const routeThreadId = Array.isArray(params.thread_id) ? params.thread_id[0] : params.thread_id;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userReady, setUserReady] = useState(!isSupabaseConfigured);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [retryMessages, setRetryMessages] = useState<RequestMessage[] | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const headerOffset = Platform.OS === 'ios' ? insets.top + 92 : 0;

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserEmail(data.session?.user.email || '');
      setUserReady(true);
    }).catch(() => { if (active) setUserReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email || '');
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const loadConversation = useCallback(async (refresh = false) => {
    if (!userReady) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      let thread = await getThread(routeThreadId || '', userEmail);
      if (!routeThreadId && !thread) thread = await CreateNewThread(userEmail, 'main', 'Main conversation');
      if (!thread) throw new Error('Conversation not found or no longer available.');
      setThreadId(thread.id);
      const rows = await LoadMessages(thread.id);
      setMessages((rows || []).map((row: any) => ({
        id: row.id,
        sender: row.role === 'user' ? 'user' : 'agent',
        text: row.content,
        timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      })));
    } catch {
      setError('Could not load this conversation. Check your connection and try again.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [routeThreadId, userEmail, userReady]);

  useEffect(() => { void loadConversation(); }, [loadConversation]);
  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [messages]);
  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const subscription = Keyboard.addListener(event, () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100));
    return () => subscription.remove();
  }, []);

  const requestReply = async (conversation: RequestMessage[]) => {
    const { data, error: invokeError } = await supabase.functions.invoke('chat', { body: { messages: conversation } });
    if (invokeError) throw invokeError;
    if (typeof data?.output !== 'string' || !data.output.trim()) throw new Error('TARS could not produce a reply. Try again.');
    return data.output.trim();
  };

  const saveAndAppendReply = async (conversation: RequestMessage[]) => {
    try {
      const answer = await requestReply(conversation);
      if (!threadId) throw new Error('Conversation is not ready.');
      const saved = await saveMessage(userEmail, threadId, 'assistant', answer, {});
      setMessages((current) => [...current, { id: saved.id, sender: 'agent', text: answer, timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }]);
      setRetryMessages(null);
      setError('');
    } catch {
      setRetryMessages(conversation);
      setError('TARS could not reply. Your message is saved; check the connection and retry.');
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    if (text.length > 12000) { showToast('Keep a message under 12,000 characters.'); return; }
    setSending(true);
    setError('');
    try {
      if (!threadId) throw new Error('Conversation is still opening.');
      const saved = await saveMessage(userEmail, threadId, 'user', text, {});
      const message: ChatMessage = { id: saved.id, sender: 'user', text, timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) };
      const history: RequestMessage[] = [...messages, message].map((item) => ({ role: item.sender === 'user' ? 'user' : 'assistant', content: item.text }));
      setMessages((current) => [...current, message]);
      setInputText('');
      if (!isSupabaseConfigured) {
        showToast('Saved on this device. Add Supabase and AI settings to enable replies.');
        return;
      }
      await saveAndAppendReply(history);
    } catch {
      setError('Your message could not be saved. Check the connection and try again.');
    } finally { setSending(false); }
  };

  const retry = async () => {
    if (!retryMessages || sending) return;
    setSending(true);
    setError('');
    await saveAndAppendReply(retryMessages);
    setSending(false);
  };

  const newConversation = async () => {
    try {
      const thread = await CreateNewThread(userEmail, 'side', 'New conversation');
      setInputText('');
      router.replace({ pathname: '/(tabs)/chat', params: { thread_id: thread.id } });
    } catch {
      showToast('Could not start a new conversation.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerOffset}>
      <View style={styles.content}>
        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadConversation(true)} tintColor={Colors.primary} />}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}><View style={styles.inner}>
            <View style={styles.day}><Text style={styles.dayText}>TODAY</Text></View>
            {loading ? <View style={styles.state}><ActivityIndicator color={Colors.primary} /><Text style={styles.stateText}>Opening your conversation…</Text></View> : error && messages.length === 0 ? <View style={styles.state}><Text style={styles.stateTitle}>Conversation unavailable</Text><Text style={styles.stateText}>{error}</Text><Pressable onPress={() => loadConversation()} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable></View> : messages.length === 0 ? (
              <View style={styles.welcome}>
                <View style={styles.signal}><View style={styles.signalDot} /></View>
                <Text style={styles.welcomeTitle}>What’s on your mind?</Text>
                <Text style={styles.welcomeCopy}>{isSupabaseConfigured ? 'Ask TARS to help you think, plan, or get a first draft moving.' : 'Your messages will stay on this device. Connect a backend to get AI replies.'}</Text>
                <Pressable onPress={newConversation} style={styles.newChatButton} accessibilityRole="button"><HugeiconsIcon icon={Add01Icon} size={15} color={Colors.primaryLight} /><Text style={styles.newChatText}>Start another conversation</Text></Pressable>
              </View>
            ) : messages.map((message) => {
              const isUser = message.sender === 'user';
              return <View key={message.id} style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}><View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}><Text selectable style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>{message.text}</Text><Text style={[styles.time, isUser && styles.userTime]}>{message.timestamp}</Text></View></View>;
            })}
            {error && messages.length > 0 ? <View style={styles.errorNotice}><Text style={styles.errorText}>{error}</Text>{retryMessages ? <Pressable onPress={retry} disabled={sending} accessibilityRole="button"><Text style={styles.retryText}>{sending ? 'Retrying…' : 'Retry'}</Text></Pressable> : null}</View> : null}
            {sending ? <View style={styles.typing}><ActivityIndicator size="small" color={Colors.primary} /><Text style={styles.typingText}>TARS is thinking</Text></View> : null}
          </View></TouchableWithoutFeedback>
        </ScrollView>
        <View style={styles.composerWrap}><View style={styles.composer}><TextInput value={inputText} onChangeText={setInputText} placeholder="Message TARS…" placeholderTextColor={Colors.textMuted} style={styles.input} multiline maxLength={12000} editable={!sending && !loading} onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)} accessibilityLabel="Message TARS" /><Pressable style={({ pressed }) => [styles.sendButton, pressed && styles.pressed, (!inputText.trim() || sending || loading) && styles.sendDisabled]} onPress={handleSend} disabled={!inputText.trim() || sending || loading} accessibilityRole="button" accessibilityLabel="Send message">{sending ? <ActivityIndicator size="small" color={Colors.background} /> : <HugeiconsIcon icon={SentIcon} size={18} color={Colors.background} strokeWidth={2} />}</Pressable></View><Text style={styles.composerNote}>{isSupabaseConfigured ? 'AI can make mistakes. Review important details.' : 'Offline preview · Stored on this device'}</Text></View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background }, content: { flex: 1, justifyContent: 'space-between' }, scroll: { flex: 1 }, scrollContent: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 20 }, inner: { flexGrow: 1 }, day: { alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 6, marginVertical: 10, borderRadius: 12, backgroundColor: Colors.surface }, dayText: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 1.4 },
  welcome: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }, signal: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: Colors.primaryBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 15 }, signalDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.primary }, welcomeTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700', textAlign: 'center', letterSpacing: -0.4 }, welcomeCopy: { color: Colors.textSecondary, maxWidth: 290, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 }, newChatButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 13, backgroundColor: Colors.primarySubtle }, newChatText: { color: Colors.primaryLight, fontSize: 12, fontWeight: '700' },
  state: { flex: 1, minHeight: 230, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 }, stateTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' }, stateText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center' }, retryButton: { marginTop: 6, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 12, backgroundColor: Colors.primarySubtle }, retryText: { color: Colors.primaryLight, fontSize: 12, fontWeight: '700' },
  messageRow: { width: '100%', flexDirection: 'row', marginVertical: 5 }, userRow: { justifyContent: 'flex-end' }, assistantRow: { justifyContent: 'flex-start' }, bubble: { maxWidth: '88%', borderRadius: 19, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 8, borderWidth: 1 }, userBubble: { backgroundColor: Colors.chatBubbleUser, borderColor: Colors.primaryBorder, borderBottomRightRadius: 5 }, assistantBubble: { backgroundColor: Colors.chatBubbleAi, borderColor: Colors.chatBubbleAiBorder, borderBottomLeftRadius: 5 }, messageText: { fontSize: 15, lineHeight: 22, letterSpacing: -0.1 }, userText: { color: Colors.chatBubbleUserText }, assistantText: { color: Colors.textPrimary }, time: { alignSelf: 'flex-end', color: Colors.textMuted, fontSize: 9, marginTop: 5 }, userTime: { color: '#C9AD94' }, typing: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }, typingText: { color: Colors.textMuted, fontSize: 12 }, errorNotice: { borderWidth: 1, borderColor: Colors.error, backgroundColor: Colors.errorLight, borderRadius: 13, padding: 12, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }, errorText: { flex: 1, color: Colors.error, fontSize: 11, lineHeight: 17 },
  composerWrap: { paddingHorizontal: 15, paddingTop: 7, paddingBottom: Platform.OS === 'ios' ? 10 : 8, backgroundColor: Colors.background }, composer: { minHeight: 54, maxHeight: 132, flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, borderRadius: 20, padding: 6, gap: 8 }, input: { flex: 1, minHeight: 40, maxHeight: 118, color: Colors.textPrimary, fontSize: 14, lineHeight: 20, paddingHorizontal: 10, paddingTop: Platform.OS === 'ios' ? 10 : 8, paddingBottom: 8 }, sendButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary }, sendDisabled: { opacity: 0.45 }, pressed: { opacity: 0.8 }, composerNote: { textAlign: 'center', color: Colors.textMuted, fontSize: 9, marginTop: 7, letterSpacing: 0.2 },
});
