import { Colors } from '@/constants/colors';
import { completeAuthRedirect } from '@/lib/authRedirect';
import { provisionProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [error, setError] = useState('');
  const handledUrls = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    const finish = async (url: string) => {
      if (handledUrls.current.has(url)) return;
      handledUrls.current.add(url);
      try {
        const { session } = await completeAuthRedirect(url);
        if (!session || (session.user.app_metadata?.provider !== 'google' && !session.user.identities?.some((identity) => identity.provider === 'google'))) {
          await supabase.auth.signOut();
          throw new Error('This app accepts Google sign-in only. Start again with your Google account.');
        }
        try { await provisionProfile(session.user.id, session.user.user_metadata?.display_name || ''); }
        catch (cause) { console.warn('[auth] profile provision recovery needed', cause instanceof Error ? cause.name : 'unknown'); }
        if (active) router.replace('/(tabs)/chat');
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not finish Google sign-in. Start again.');
      }
    };

    Linking.getInitialURL().then((url) => { if (url) void finish(url); else if (active) setError('No Google sign-in callback was received. Return to TARS and try again.'); });
    const subscription = Linking.addEventListener('url', ({ url }) => { void finish(url); });
    return () => { active = false; subscription.remove(); };
  }, [router]);

  return <View style={styles.container}>{error ? <><Text style={styles.title}>Sign-in link unavailable</Text><Text style={styles.copy}>{error}</Text><Text style={styles.link} onPress={() => router.replace('/')}>Return to sign in</Text></> : <><ActivityIndicator color={Colors.primary} /><Text style={styles.copy}>Finishing secure sign-in…</Text></>}</View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }, title: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' }, copy: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 }, link: { color: Colors.primaryLight, padding: 8 } });
