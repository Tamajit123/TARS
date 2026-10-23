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
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Comment01Icon,
  File01Icon,
  Idea01Icon,
  CheckmarkSquare02Icon,
  Settings02Icon,
} from '@hugeicons/core-free-icons';
import { Colors } from '@/constants/colors';
import {
  AppHeader,
  SidebarDrawer,
  SettingsMenuModal,
  EditAgentModal,
} from '@/components/common';
import { showToast } from '@/context/ToastContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const PROFILE_KEY = 'tars:agent-profile:v1';
type AgentProfile = { name: string; subtitle: string; icon: string; color: string };

export default function TabLayout() {
  const router = useRouter();

  // Agent mascot & profile state
  const [agentName, setAgentName] = useState('TARS');
  const [agentSubtitle, setAgentSubtitle] = useState('Autonomous Agent');
  const [mascotIcon, setMascotIcon] = useState('tars');
  const [mascotColor, setMascotColor] = useState<string>(Colors.primary);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const local = await AsyncStorage.getItem(PROFILE_KEY);
        const { data: { user } } = await supabase.auth.getUser();
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
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarHideOnKeyboard: true,
            tabBarStyle: styles.tabBar,
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
                  <HugeiconsIcon
                    icon={Comment01Icon}
                    size={23}
                    color={Colors.iconDark}
                    strokeWidth={2}
                  />
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
                  <HugeiconsIcon
                    icon={File01Icon}
                    size={23}
                    color={Colors.iconDark}
                    strokeWidth={2}
                  />
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
                  <HugeiconsIcon
                    icon={Idea01Icon}
                    size={23}
                    color={Colors.iconDark}
                    strokeWidth={2}
                  />
                </View>
              ),
            }}
          />
          <Tabs.Screen
            name="tasks"
            options={{
              title: 'Task / Goal',
              tabBarIcon: ({ focused }) => (
                <View style={[styles.iconPill, focused && styles.activeIconPill]}>
                  <HugeiconsIcon
                    icon={CheckmarkSquare02Icon}
                    size={23}
                    color={Colors.iconDark}
                    strokeWidth={2}
                  />
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
                  <HugeiconsIcon
                    icon={Settings02Icon}
                    size={23}
                    color={Colors.iconDark}
                    strokeWidth={2}
                  />
                </View>
              ),
            }}
          />
        </Tabs>
      </View>

      {/* 3. Left Sliding Sidebar Drawer */}
      <SidebarDrawer
        visible={isSidebarOpen}
        activeChatId="chat-1"
        agentName={agentName}
        onClose={() => setIsSidebarOpen(false)}
        onSelectChat={(chatTitle) => {
          setIsSidebarOpen(false);
          router.replace('/(tabs)/chat' as any);
        }}
        onNewChat={() => {
          setIsSidebarOpen(false);
          router.replace('/(tabs)/chat' as any);
        }}
        onOpenSettings={() => {
          setIsSidebarOpen(false);
          router.replace('/(tabs)/settings' as any);
        }}
        onClearSideChats={() => {
          showToast('Side chats cleared');
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
        onSave={(data) => {
          setAgentName(data.name);
          setAgentSubtitle(data.subtitle);
          setMascotIcon(data.icon);
          setMascotColor(data.color);
          const profile: AgentProfile = { name: data.name, subtitle: data.subtitle, icon: data.icon, color: data.color };
          void AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
          if (isSupabaseConfigured) {
            void supabase.auth.getUser().then(({ data: { user } }) => user
              ? supabase.from('profiles').upsert({ id: user.id, agent_name: profile.name, agent_role: profile.subtitle, agent_avatar: profile.icon, agent_color: profile.color }, { onConflict: 'id' })
              : null).then((result) => { if (result && 'error' in result && result.error) showToast('Saved here. Cloud sync could not complete.'); });
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabBar: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F2',
    height: Platform.OS === 'ios' ? 84 : 70,
    paddingBottom: Platform.OS === 'ios' ? 22 : 10,
    paddingTop: 8,
    paddingHorizontal: 12,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  iconPill: {
    width: 58,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconPill: {
    backgroundColor: Colors.tabActiveBg, // Soft #E6E8EA capsule
  },
});
