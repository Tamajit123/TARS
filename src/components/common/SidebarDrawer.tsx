import { AccessibleModal as Modal } from '@/components/common/AccessibleModal';
/**
 * SidebarDrawer Component
 *
 * Fullscreen sliding drawer interface providing session management:
 * 1. Top bar: Agent title & right arrow dismissal button
 * 2. Recents: all conversations in chronological order
 * 3. Search, exact conversation selection and unread indicators
 * 4. Bottom Toolbar: Settings gear shortcut, search filter input, and compose new chat button
 */

import { useAppTheme } from '@/context/ThemeContext';
import type { ColorPalette } from '@/constants/colors';

import { showToast } from '@/context/ToastContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { CreateNewThread, DeleteThread, RenameThread, GetAllUserThreads } from '@/services/chatHistory';
import {KeyboardFormLayout} from './KeyboardFormLayout';
import { SideChatItem } from '@/types';
import {
  ArrowRight01Icon,
  Delete02Icon,
  Edit02Icon,
  Search01Icon,
  Settings01Icon,
} from '@/constants/icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MotionPanel } from './MotionPanel';

export interface SidebarDrawerProps {
  /** Visibility state of the drawer modal */
  visible: boolean;
  /** Callback fired to close the drawer */
  onClose: () => void;
  /** Callback fired to navigate directly to settings */
  onOpenSettings?: () => void;
}

/**
 * Slide-in Session History Drawer
 */
export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  visible,
  onClose,
  onOpenSettings,
}) => {
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter()
  const params=useGlobalSearchParams<{thread_id?:string|string[]}>();
  const selected=Array.isArray(params.thread_id)?params.thread_id[0]:params.thread_id;
  const [chats, setChats] = useState<SideChatItem[]>([]);
  const [loading,setLoading]=useState(false),[error,setError]=useState('');
  const [deleteTarget,setDeleteTarget]=useState<SideChatItem|null>(null);
  const [renameTarget,setRenameTarget]=useState<SideChatItem|null>(null),[renameTitle,setRenameTitle]=useState(''),[renameError,setRenameError]=useState('');
  const [busy,setBusy]=useState(false),lock=useRef(false);
  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );


  useEffect(() => {
    if(!visible)return;
    let active=true;
    setLoading(true);setError('');setChats([]);
    void GetAllUserThreads('').then(data=>{
      if(!active)return;
      setChats(data.map((thread: any) => ({
        id: thread.id,
        title: thread.title || 'New conversation',
        hasUnreadDot: thread.has_unread_updates ?? false
      })) as SideChatItem[]);
    }).catch(()=>{if(active)setError('Conversations could not load. Close Recents and try again.');}).finally(()=>{if(active)setLoading(false);});
    const listener=isSupabaseConfigured?supabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'&&active){setChats([]);onClose();}}):null;
    return()=>{active=false;listener?.data.subscription.unsubscribe();};
  }, [visible,onClose]);

  const createConversation = async () => {
    if(lock.current)return;lock.current=true;setBusy(true);
    try {
    const thread = await CreateNewThread('');
    router.replace({
      pathname: '/(tabs)/chat',
      params: {
        thread_id: thread.id,
      }
    })
    onClose();
    } catch {
      showToast('Could not start a new conversation.');
    } finally {lock.current=false;setBusy(false);}
  }

  const deleteThread = async (threadId: string) => {
    if(lock.current)return;lock.current=true;setBusy(true);
    try {
      await DeleteThread(threadId);
      setChats(rows=>rows.filter(row=>row.id!==threadId));setDeleteTarget(null);
      if(selected===threadId)router.replace('/(tabs)/chat');
    } catch {
      showToast('Could not delete this conversation.');
    } finally {lock.current=false;setBusy(false);}
  }

  const rename=async()=>{
    if(lock.current||!renameTarget)return;lock.current=true;setBusy(true);setRenameError('');
    try{await RenameThread(renameTarget.id,renameTitle);setChats(rows=>rows.map(row=>row.id===renameTarget.id?{...row,title:renameTitle.replace(/\s+/g,' ').trim()}:row));setRenameTarget(null);}
    catch(cause){setRenameError(cause instanceof Error?cause.message:'The conversation could not be renamed.');}
    finally{lock.current=false;setBusy(false);}
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.modalContainer}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss conversations" />
        <MotionPanel onDismiss={onClose} style={{ flex: 1, width: '90%', maxWidth: 390, backgroundColor: Colors.background }}>
        {/* Fullscreen white sidebar with safe area */}
        <SafeAreaView style={styles.safeContainer} edges={['top', 'bottom', 'left', 'right']}>
          {/* Top Bar: Center Name + Right Arrow Button */}
          <View style={styles.header}>
            <View style={styles.headerSideSpacer} />

            <Text style={styles.headerTitle}>Recents</Text>

            <TouchableOpacity accessibilityRole="button"
              style={styles.circleBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Close sidebar">
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={22}
                color={Colors.iconDark}
                strokeWidth={2.2}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {loading?<ActivityIndicator accessibilityLabel="Loading conversations" color={Colors.primary}/>:null}
            {error?<Text accessibilityRole="alert" style={styles.noChats}>{error}</Text>:null}
            {filteredChats.map((chat) => (
              <View key={chat.id} style={[styles.chatRow,selected===chat.id&&{backgroundColor:Colors.surfaceMuted}]}>
                <TouchableOpacity accessibilityRole="button"
                  style={{flex:1,minHeight:44,justifyContent:'center'}}
                  aria-pressed={selected===chat.id} accessibilityState={{selected:selected===chat.id}}
                  accessibilityLabel={`Open conversation: ${chat.title}`}
                  onPress={() => {
                    router.replace({
                      pathname: '/(tabs)/chat',
                      params: {
                        thread_id: chat.id,
                      }
                    })
                    onClose();
                  }}
                  activeOpacity={0.7}>
                  <Text style={styles.chatRowText} numberOfLines={1}>
                    {chat.title}
                  </Text>
                </TouchableOpacity>
                  <View style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    {/* Blue Indicator Dot if unread */}
                    {chat.hasUnreadDot && <View style={styles.blueDot} />}
                    <TouchableOpacity accessibilityRole="button" style={styles.trashBtn} disabled={busy} accessibilityLabel={`Rename conversation: ${chat.title}`} onPress={event=>{event.stopPropagation();setRenameTarget(chat);setRenameTitle(chat.title);setRenameError('');}}><HugeiconsIcon icon={Edit02Icon} size={18} color={Colors.iconMuted}/></TouchableOpacity>
                    <TouchableOpacity accessibilityRole="button"
                      style={styles.trashBtn}
                      disabled={busy}
                      onPress={(event) => { event.stopPropagation();setDeleteTarget(chat); }}
                      activeOpacity={0.7}
                      accessibilityLabel={`Delete conversation: ${chat.title}`}>
                      <HugeiconsIcon
                        icon={Delete02Icon}
                        size={20}
                        color={Colors.iconMuted}
                        strokeWidth={1.8}
                      />
                    </TouchableOpacity>
                  </View>
              </View>
            ))}
            {!loading&&!error&&filteredChats.length === 0 ? <Text style={styles.noChats}>{searchQuery ? 'No conversations match your search.' : 'Your conversations will appear here.'}</Text> : null}
          </ScrollView>

          {/* Bottom Toolbar: Settings Gear (Left) + Search (Center) + Compose (Right) */}
          <View style={styles.bottomToolbar}>
            {/* Settings Gear Button */}
            <TouchableOpacity accessibilityRole="button"
              style={styles.circleBtn}
              onPress={() => {
                showToast('Settings');
                onClose();
                onOpenSettings?.();
              }}
              activeOpacity={0.7}
              accessibilityLabel="Settings">
              <HugeiconsIcon
                icon={Settings01Icon}
                size={22}
                color={Colors.iconDark}
                strokeWidth={2}
              />
            </TouchableOpacity>

            {/* Search Capsule Input */}
            <View style={styles.searchCapsule}>
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                color={Colors.iconMuted}
                strokeWidth={2}
              />
              <TextInput
                style={styles.searchInput}
                accessibilityLabel="Search conversations" placeholder="Search"
                placeholderTextColor={Colors.iconMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* New Chat Compose Button */}
            <TouchableOpacity accessibilityRole="button"
              style={styles.circleBtn}
              disabled={busy}
              onPress={() => { void createConversation(); }}
              activeOpacity={0.7}
              accessibilityLabel="New chat">
              <HugeiconsIcon
                icon={Edit02Icon}
                size={20}
                color={Colors.iconDark}
                strokeWidth={2}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        </MotionPanel>
        <Modal visible={Boolean(renameTarget)} transparent animationType="slide" onRequestClose={()=>{if(!busy)setRenameTarget(null);}}>
          <KeyboardFormLayout dismissDisabled={busy} onDismiss={()=>setRenameTarget(null)} backdropStyle={{backgroundColor:Colors.overlay}} cardStyle={{backgroundColor:Colors.surface,padding:24,borderTopLeftRadius:24,borderTopRightRadius:24}} footer={<View style={{flexDirection:'row',justifyContent:'space-between'}}><Pressable accessibilityRole="button" disabled={busy} onPress={()=>setRenameTarget(null)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:Colors.textLink,fontSize:17}}>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={()=>void rename()} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:Colors.textLink,fontSize:17}}>{busy?'Saving…':'Save name'}</Text></Pressable></View>}>
            <Text accessibilityRole="header" style={{color:Colors.textPrimary,fontSize:24,marginBottom:16}}>Rename conversation</Text>
            <TextInput accessibilityLabel="Conversation name" value={renameTitle} onChangeText={setRenameTitle} maxLength={120} editable={!busy} style={{color:Colors.textPrimary,fontSize:17,padding:14,borderWidth:1,borderColor:Colors.border,borderRadius:12}}/>
            {renameError?<Text accessibilityRole="alert" style={{color:Colors.error,marginTop:12}}>{renameError}</Text>:null}
          </KeyboardFormLayout>
        </Modal>
        <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={()=>{if(!busy)setDeleteTarget(null);}}>
          <View style={{flex:1,backgroundColor:Colors.overlay,justifyContent:'center',padding:24}}><View style={{backgroundColor:Colors.surface,padding:24,borderRadius:20,gap:16}}>
            <Text accessibilityRole="header" style={{color:Colors.textPrimary,fontSize:20,fontWeight:'600'}}>Delete conversation?</Text>
            <Text style={{color:Colors.textSecondary,fontSize:17,lineHeight:24}}>“{deleteTarget?.title}” and its messages will be deleted.</Text>
            <Pressable disabled={busy} onPress={()=>setDeleteTarget(null)} style={{minHeight:44,justifyContent:'center'}} accessibilityRole="button"><Text style={{color:Colors.textLink,fontSize:17}}>Cancel</Text></Pressable>
            <Pressable disabled={busy} onPress={()=>{if(deleteTarget)void deleteThread(deleteTarget.id);}} style={{minHeight:44,justifyContent:'center'}} accessibilityRole="button"><Text style={{color:Colors.error,fontSize:17}}>{busy?'Deleting…':'Delete'}</Text></Pressable>
          </View></View>
        </Modal>
      </GestureHandlerRootView>
    </Modal>
  );
};

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  safeContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerSideSpacer: {
    width: 48,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.iconDark,
    letterSpacing: -0.2,
  },
  circleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      },
    }),
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    width: '100%',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.iconMuted, // #8E8E93 / #9E9E9E
  },
  trashBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  chatRowText: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.iconDark,
    flex: 1,
    paddingRight: 10,
  },
  blueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  bottomToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 12 : 16,
    backgroundColor: Colors.background,
  },
  searchCapsule: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceInput,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginHorizontal: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.iconDark,
    paddingVertical: 0,
  },
  noChats: { paddingHorizontal: 20, paddingVertical: 18, color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
});

export default SidebarDrawer;
