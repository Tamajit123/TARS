import { initializeDeviceAlarms } from '@/services/deviceAlarms';
import {syncReminders,cancelReminderNotificationsOnSignOut,remindersSupported} from '@/services/reminders';
import * as Notifications from 'expo-notifications';
import {supabase} from '@/lib/supabase';
import {AppState} from 'react-native';
/**
 * RootLayout Component
 *
 * App-wide navigation shell:
 * - ThemeProvider: native navigation theme synchronization
 * - Stack Navigator: headerless screen transitions
 * - StatusBar: dark icons on clean white surface
 */

import React from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ToastProvider } from '@/context/ToastContext';
import { AppThemeProvider, useAppTheme } from '@/context/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MotionProvider, useMotionPreferences } from '@/context/MotionContext';
import {NavigationPersistence} from '@/components/common/NavigationPersistence';

export default function RootLayout() {
  React.useEffect(() => { initializeDeviceAlarms(); }, []);
  return <GestureHandlerRootView style={{ flex: 1 }}><AppThemeProvider><MotionProvider><NavigationShell /></MotionProvider></AppThemeProvider></GestureHandlerRootView>;
}

function NavigationShell() {
  const router=useRouter();
  React.useEffect(()=>{
    if(!remindersSupported)return;
    let owner:string|undefined;
    const sync=async()=>{const {data:{session}}=await supabase.auth.getSession();if(session)await syncReminders(false);};
    const handle=async(response:Notifications.NotificationResponse|null)=>{const data=response?.notification.request.content.data;if(!data?.tarsReminder)return;const {data:{session}}=await supabase.auth.getSession();if(session?.user.id===data.userId)router.push('/(tabs)/tasks');};
    void sync().catch(()=>{});void Notifications.getLastNotificationResponseAsync().then(handle).catch(()=>{});
    const response=Notifications.addNotificationResponseReceivedListener(value=>{void handle(value);});
    const foreground=AppState.addEventListener('change',state=>{if(state==='active')void sync().catch(()=>{});});
    const auth=supabase.auth.onAuthStateChange((_event,session)=>{const previous=owner;owner=session?.user.id;setTimeout(()=>{if(previous&&previous!==session?.user.id)void cancelReminderNotificationsOnSignOut(previous).catch(()=>{});if(session)void sync().catch(()=>{});},0);});
    return()=>{response.remove();foreground.remove();auth.data.subscription.unsubscribe();};
  },[router]);
  const { resolved, colors } = useAppTheme();
  const { reducedMotion } = useMotionPreferences();
  const navigationTheme = resolved === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider value={{ ...navigationTheme, colors: { ...navigationTheme.colors, background: colors.background, card: colors.surface, text: colors.textPrimary, border: colors.border, primary: colors.primary } }}>
      <ToastProvider>
        <NavigationPersistence/>
        <Stack screenOptions={{ headerShown: false, animation: reducedMotion ? 'none' : 'default', gestureEnabled: true, fullScreenGestureEnabled: true }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="home" options={{ headerShown: false }} />
          <Stack.Screen name="tools" options={{ headerShown: false, animation: reducedMotion ? 'none' : 'slide_from_right' }} />
        </Stack>
        <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      </ToastProvider>
    </ThemeProvider>
  );
}

