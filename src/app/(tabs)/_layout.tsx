import {useKeyboardViewport} from '@/hooks/useKeyboardViewport';
import { IOSTabs } from '@/components/common/IOSTabs';
/**
 * TabLayout Component ('/(tabs)/_layout.tsx')
 *
 * Master Tab Layout containing:
 * 1. AppHeader: 3D mascot avatar, agent name capsule pill, sidebar drawer and 3-dots actions
 * 2. Expo Router Tabs viewport for 5 routes:
 *    - /chat
 *    - /feed
 *    - /ideas
 *    - /tasks
 *    - /settings
 * 3. Native Expo Router Tab Bar with active pill capsule and keyboard auto-hide
 * 4. Modals: SidebarDrawer, SettingsMenuModal, EditAgentModal
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Comment01Icon,
  File01Icon,
  Idea01Icon,
  CheckmarkSquare02Icon,
  Settings02Icon,
} from '@/constants/icons';
import { useAppTheme } from '@/context/ThemeContext';
import type { ColorPalette } from '@/constants/colors';

import {
  AppHeader,
  SidebarDrawer,
  SettingsMenuModal,
  EditAgentModal,
} from '@/components/common';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { MaterialSurface } from '@/components/common/MaterialSurface';
import { NativeIcon } from '@/components/common/NativeIcon';
import { selectionFeedback } from '@/lib/haptics';

const PROFILE_KEY = 'tars:agent-profile:v1';
const OFFLINE_MODE_KEY = 'tars:offline-preview';
type AgentProfile = { name: string; subtitle: string; icon: string; color: string };

export default function TabLayout() {
  const { colors: Colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const keyboardViewport=useKeyboardViewport();
  const styles = createStyles(Colors, insets.bottom);
  const router = useRouter();
  const [accessState, setAccessState] = useState<'checking' | 'allowed'>('checking');

  useEffect(() => {
    let active = true;
    const checkAccess = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      const offline = await AsyncStorage.getItem(OFFLINE_MODE_KEY);
      if (!active) return;
      const googleUser = session?.user.app_metadata?.provider === 'google' || session?.user.identities?.some((identity) => identity.provider === 'google') || false;
      if (googleUser || (!session && offline === '1')) {
        if (active) setAccessState('allowed');
        return;
      }
      if (session) {
        await AsyncStorage.removeItem(OFFLINE_MODE_KEY);
        void supabase.auth.signOut();
      }
      if (active) {
        setAccessState('checking');
        router.replace('/');
      }
    };

    void supabase.auth.getSession().then(({ data }) => checkAccess(data.session)).catch(() => {
      if (active) router.replace('/');
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void checkAccess(session);
    });
    return () => { active = false; authListener.subscription.unsubscribe(); };
  }, [router]);

  // Agent mascot & profile state
  const [agentName, setAgentName] = useState('TARS');
  const [agentSubtitle, setAgentSubtitle] = useState('Autonomous Agent');
  const [mascotIcon, setMascotIcon] = useState('tars');
  const [mascotColor, setMascotColor] = useState<string>(Colors.primary);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const local = await AsyncStorage.getItem(`${PROFILE_KEY}:${user?.id || 'preview'}`);
        let profile: AgentProfile | null = local ? JSON.parse(local) as AgentProfile : null;
        if (isSupabaseConfigured && user) {
          const { data } = await supabase.from('profiles').select('agent_name,agent_role,agent_avatar,agent_color').eq('id', user.id).maybeSingle();
          if (data) profile = { name: data.agent_name, subtitle: data.agent_role, icon: data.agent_avatar, color: data.agent_color };
        }
        if (active && profile) {
          setAgentName(profile.name); setAgentSubtitle(profile.subtitle); setMascotIcon(profile.icon); setMascotColor(profile.color);
        }
      } catch { /* Keep the default TARS profile if no saved profile is available. */ }
    };
    void loadProfile();
    return () => { active = false; };
  }, []);

  // Modals state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isEditAgentOpen, setIsEditAgentOpen] = useState(false);

  if (accessState === 'checking') {
    return <View style={styles.accessLoading}><ActivityIndicator color={Colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* 1. Persistent App Header */}
      <AppHeader
        agentName={agentName}
        mascotIcon={mascotIcon}
        mascotColor={mascotColor}
        onOpenSidebar={() => setIsSidebarOpen(true)}
        onOpenSettings={() => setIsSettingsMenuOpen(true)}
        onMascotPress={() => setIsEditAgentOpen(true)}
      />

      {/* 2. Expo Router Tabs Viewport */}
      <View style={styles.contentContainer}>
        {Platform.OS === 'ios' ? <IOSTabs /> : <Tabs
          screenListeners={{ tabPress: () => selectionFeedback() }}
          screenOptions={{
            headerShown: false,
            animation: 'none',
            tabBarShowLabel: true,
            tabBarActiveTintColor: Colors.primary,
            tabBarInactiveTintColor: Colors.textMuted,
            tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: '500', marginTop: 0 },
            tabBarBackground: () => <MaterialSurface style={StyleSheet.absoluteFill} />,
            tabBarHideOnKeyboard: true,
            tabBarStyle: [styles.tabBar,Platform.OS==='web'&&keyboardViewport.open?{display:'none'}:undefined],
            tabBarItemStyle: styles.tabBarItem,
          }}>
          <Tabs.Screen
            name="index"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="chat"
            options={{
              title: 'Chat',
              tabBarIcon: ({ focused }) => (
                <View style={[styles.iconPill, focused && styles.activeIconPill]}>
                  <NativeIcon symbol="bubble.left.and.bubble.right" fallback={Comment01Icon} size={22} color={focused ? Colors.primary : Colors.textMuted} />
                </View>
              ),
            }}
          />
          <Tabs.Screen
            name="feed"
            options={{
              title: 'Feed',
              tabBarIcon: ({ focused }) => (
                <View style={[styles.iconPill, focused && styles.activeIconPill]}>
                  <NativeIcon symbol="tray" fallback={File01Icon} size={22} color={focused ? Colors.primary : Colors.textMuted} />
                </View>
              ),
            }}
          />
          <Tabs.Screen
            name="ideas"
            options={{
              title: 'Ideas',
              tabBarIcon: ({ focused }) => (
                <View style={[styles.iconPill, focused && styles.activeIconPill]}>
                  <NativeIcon symbol="lightbulb" fallback={Idea01Icon} size={22} color={focused ? Colors.primary : Colors.textMuted} />
                </View>
              ),
            }}
          />
          <Tabs.Screen
            name="tasks"
            options={{
              title: 'Tasks',
              tabBarIcon: ({ focused }) => (
                <View style={[styles.iconPill, focused && styles.activeIconPill]}>
                  <NativeIcon symbol="checkmark.circle" fallback={CheckmarkSquare02Icon} size={22} color={focused ? Colors.primary : Colors.textMuted} />
                </View>
              ),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Settings',
              tabBarIcon: ({ focused }) => (
                <View style={[styles.iconPill, focused && styles.activeIconPill]}>
                  <NativeIcon symbol="gearshape" fallback={Settings02Icon} size={22} color={focused ? Colors.primary : Colors.textMuted} />
                </View>
              ),
            }}
          />
        </Tabs>}
      </View>

      {/* 3. Left Sliding Sidebar Drawer */}
      <SidebarDrawer
        visible={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenSettings={() => {
          setIsSidebarOpen(false);
          router.replace('/(tabs)/settings' as any);
        }}
      />

      {/* 4. Right 3-Dots Action Sheet */}
      <SettingsMenuModal
        visible={isSettingsMenuOpen}
        onClose={() => setIsSettingsMenuOpen(false)}
        onEditAvatar={() => setIsEditAgentOpen(true)}
        onOpenSettings={() => router.push('/(tabs)/settings')}
      />

      {/* 5. Edit Mascot Avatar & Name Modal */}
      <EditAgentModal
        visible={isEditAgentOpen}
        initialName={agentName}
        initialSubtitle={agentSubtitle}
        initialIcon={mascotIcon}
        initialColor={mascotColor}
        onClose={() => setIsEditAgentOpen(false)}
        onSave={async (data) => {
          const profile: AgentProfile = { name: data.name, subtitle: data.subtitle, icon: data.icon, color: data.color };
          const { data: { user } } = await supabase.auth.getUser();
          if (isSupabaseConfigured && user) {
            const { error } = await supabase.from('profiles').update({ agent_name: profile.name, agent_role: profile.subtitle, agent_avatar: profile.icon, agent_color: profile.color }).eq('id', user.id).select('id').single();
            if (error) throw error;
          }
          await AsyncStorage.setItem(`${PROFILE_KEY}:${user?.id || 'preview'}`, JSON.stringify(profile));
          setAgentName(data.name);
          setAgentSubtitle(data.subtitle);
          setMascotIcon(data.icon);
          setMascotColor(data.color);
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (Colors: ColorPalette, bottom: number) => StyleSheet.create({
  accessLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    flex: 1,
    minHeight: 0,
    backgroundColor: Colors.background,
  },
  tabBar: {
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    height: 64 + Math.max(bottom, 4),
    paddingBottom: Math.max(bottom, 4),
    paddingTop: 4,
    paddingHorizontal: 12,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  iconPill: {
    width: 44,
    height: 24,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconPill: {
    backgroundColor: 'transparent',
  },
});
