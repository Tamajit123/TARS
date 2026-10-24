import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/colors';
import { provisionProfile } from '@/lib/auth';
import { completeAuthRedirect } from '@/lib/authRedirect';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();

const OFFLINE_MODE_KEY = 'tars:offline-preview';

function hasGoogleIdentity(user: { identities?: { provider?: string }[] | null; app_metadata?: { provider?: string } }) {
  return user.app_metadata?.provider === 'google' || Boolean(user.identities?.some((identity) => identity.provider === 'google'));
}

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (/cancel|dismiss/.test(message)) return 'Sign-in was cancelled.';
  if (/network|fetch/.test(message)) return 'Could not reach Google or Supabase. Check your connection and try again.';
  if (/supabase is not configured/.test(message)) return 'Add the Supabase project URL and public key to .env before signing in.';
  if (/redirect|callback|code verifier|expired/.test(message)) return 'The Google sign-in link expired or was invalid. Start again.';
  if (/provider is not enabled|unsupported provider/.test(message)) return 'Google sign-in is not enabled for this Supabase project yet.';
  return 'Google sign-in could not be completed. Check the provider setup and try again.';
}

export default function WelcomeScreen() {
  const router = useRouter();
  const busyRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([supabase.auth.getSession(), AsyncStorage.getItem(OFFLINE_MODE_KEY)])
      .then(async ([{ data }, offline]) => {
        const user = data.session?.user;
        if (active && user && hasGoogleIdentity(user)) {
          try { await provisionProfile(user.id, user.user_metadata?.display_name || ''); }
          catch (cause) { console.warn('[auth] profile provisioning will retry after session restore', cause instanceof Error ? cause.name : 'unknown'); }
          await AsyncStorage.removeItem(OFFLINE_MODE_KEY);
          router.replace('/(tabs)/chat');
        } else if (active && user) {
          await supabase.auth.signOut();
          await AsyncStorage.removeItem(OFFLINE_MODE_KEY);
        } else if (active && offline === '1') {
          router.replace('/(tabs)/chat');
        }
      })
      .catch(() => { if (active) setError('Could not restore your session. Check your connection and try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  const googleSignIn = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
      });
      if (oauthError) throw oauthError;
      if (!data.url) throw new Error('Google sign-in did not return an authorization URL.');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      if (result.type !== 'success') throw new Error('Google sign-in did not complete.');
      const { session } = await completeAuthRedirect(result.url);
      if (!session || !hasGoogleIdentity(session.user)) {
        await supabase.auth.signOut();
        throw new Error('The returned account does not have a Google identity.');
      }
      await provisionProfile(session.user.id, session.user.user_metadata?.full_name || session.user.user_metadata?.name || '');
      await AsyncStorage.removeItem(OFFLINE_MODE_KEY);
      router.replace('/(tabs)/chat');
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const continueOffline = async () => {
    await AsyncStorage.setItem(OFFLINE_MODE_KEY, '1');
    router.replace('/(tabs)/chat');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topline}><View style={styles.dot} /><Text style={styles.kicker}>PERSONAL INTELLIGENCE</Text></View>
        <View style={styles.hero}>
          <View style={styles.markFrame}><Image source={require('../../TARS.png')} style={styles.mark} resizeMode="contain" accessibilityLabel="TARS mark" /></View>
          <Text style={styles.title}>TARS</Text>
          <Text style={styles.tagline}>A calmer way to move things forward.</Text>
        </View>
        <View style={styles.actions}>
          {loading ? <ActivityIndicator color={Colors.primary} /> : <Pressable style={[styles.googleButton, busy && styles.disabled]} onPress={() => void googleSignIn()} disabled={busy} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#fff" /> : <><Text style={styles.googleG}>G</Text><Text style={styles.googleText}>Continue with Google</Text></>}
          </Pressable>}
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Pressable onPress={() => void continueOffline()} style={styles.offlineButton} accessibilityRole="button"><Text style={styles.offlineText}>Explore offline preview</Text></Pressable>
          <Text style={styles.offlineNote}>Preview data stays on this device. This does not create or sign in to an account.</Text>
        </View>
        <View style={styles.legal}><Text style={styles.legalText}>By continuing, you agree to our </Text><Text style={styles.legalLink} onPress={() => router.push('/terms')}>Terms</Text><Text style={styles.legalText}> and </Text><Text style={styles.legalLink} onPress={() => router.push('/privacy')}>Privacy</Text><Text style={styles.legalText}>.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 460, alignSelf: 'center', paddingHorizontal: 26, paddingTop: 16, paddingBottom: 22, justifyContent: 'space-between' },
  topline: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },
  kicker: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 2.1 },
  hero: { minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  markFrame: { width: 116, height: 116, borderRadius: 30, backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 100, height: 100, borderRadius: 24 },
  title: { marginTop: 18, color: Colors.textPrimary, fontSize: 30, fontWeight: '800', letterSpacing: 4 },
  tagline: { marginTop: 8, color: Colors.primaryLight, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  actions: { width: '100%', gap: 13, paddingBottom: 18 },
  googleButton: { minHeight: 54, borderRadius: 15, backgroundColor: '#4285F4', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  disabled: { opacity: 0.7 },
  googleG: { color: '#fff', fontSize: 18, fontWeight: '800' },
  googleText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  error: { color: Colors.error, textAlign: 'center', lineHeight: 19, fontSize: 12 },
  offlineButton: { alignItems: 'center', paddingTop: 4, minHeight: 34, justifyContent: 'center' },
  offlineText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  offlineNote: { color: Colors.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 15 },
  legal: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', paddingTop: 8 },
  legalText: { color: Colors.textMuted, fontSize: 10 },
  legalLink: { color: Colors.textSecondary, fontSize: 10, textDecorationLine: 'underline' },
});
