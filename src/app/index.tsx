import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/colors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const OFFLINE_MODE_KEY = 'tars:offline-preview';

export default function WelcomeScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [waitingForCode, setWaitingForCode] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([supabase.auth.getSession(), AsyncStorage.getItem(OFFLINE_MODE_KEY)]).then(([{ data }, offline]) => {
      if (mounted && (data.session || offline === '1')) router.replace('/(tabs)/chat');
    }).catch(() => {
      if (mounted) setError('Could not restore your session. You can continue in offline preview.');
    });
    return () => { mounted = false; };
  }, [router]);

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured) {
      setError('Add your Supabase URL and public key to .env to enable Google sign-in.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (authError) throw authError;
      if (!data.url) throw new Error('Google sign-in could not start. Check the provider setup.');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      if (result.type !== 'success') throw new Error('Google sign-in did not complete.');
      const hash = result.url.split('#')[1] || '';
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!accessToken || !refreshToken) throw new Error('The sign-in response was incomplete. Try again.');
      const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (sessionError) throw sessionError;
      router.replace('/(tabs)/chat');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google sign-in failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Add your Supabase URL and public key to .env to enable email sign-in.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithOtp({ email: normalizedEmail, options: { shouldCreateUser: true } });
    setLoading(false);
    if (authError) {
      setError('We could not send a sign-in code. Check your email settings and try again.');
      return;
    }
    setWaitingForCode(true);
  };

  const handleVerifyCode = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: authError } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setLoading(false);
    if (authError) {
      setError('That code is invalid or expired. Request a new one and try again.');
      return;
    }
    router.replace('/(tabs)/chat');
  };

  const continueOffline = async () => {
    await AsyncStorage.setItem(OFFLINE_MODE_KEY, '1');
    router.replace('/(tabs)/chat');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.topline}>
            <View style={styles.statusDot} />
            <Text style={styles.toplineText}>PERSONAL INTELLIGENCE</Text>
          </View>
          <View style={styles.hero}>
            <View style={styles.markFrame}>
              <Image source={require('../../TARS.png')} style={styles.mark} resizeMode="contain" accessibilityLabel="TARS mark" />
            </View>
            <Text style={styles.wordmark}>TARS</Text>
            <Text style={styles.tagline}>A calmer way to move things forward.</Text>
            <Text style={styles.intro}>Your personal AI command center for ideas, conversations, and the work that matters.</Text>
          </View>

          <View style={styles.actions}>
            {!showEmail ? (
              <>
                <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, loading && styles.disabled]} onPress={handleGoogleSignIn} disabled={loading} accessibilityRole="button">
                  {loading ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.primaryText}>Continue with Google</Text>}
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => { setShowEmail(true); setError(''); }} accessibilityRole="button">
                  <Text style={styles.secondaryText}>Continue with email</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.form}>
                <Text style={styles.formTitle}>{waitingForCode ? 'Check your inbox' : 'Sign in with email'}</Text>
                <Text style={styles.formHint}>{waitingForCode ? `Enter the 6-digit code sent to ${email.trim()}.` : 'We’ll email you a one-time sign-in code.'}</Text>
                {!waitingForCode ? (
                  <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={Colors.textMuted} keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={styles.input} accessibilityLabel="Email address" />
                ) : (
                  <TextInput value={code} onChangeText={setCode} placeholder="6-digit code" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" maxLength={6} style={styles.input} accessibilityLabel="Email verification code" />
                )}
                <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, loading && styles.disabled]} onPress={waitingForCode ? handleVerifyCode : handleSendCode} disabled={loading} accessibilityRole="button">
                  {loading ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.primaryText}>{waitingForCode ? 'Verify code' : 'Send sign-in code'}</Text>}
                </Pressable>
                {waitingForCode && <Pressable onPress={() => { setWaitingForCode(false); setCode(''); }}><Text style={styles.link}>Use a different email</Text></Pressable>}
              </View>
            )}
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            <Pressable onPress={continueOffline} style={styles.offlineButton} accessibilityRole="button">
              <Text style={styles.offlineText}>Explore offline preview</Text>
            </Pressable>
            <Text style={styles.offlineNote}>Preview data stays on this device. AI replies and cloud sync need setup.</Text>
          </View>
          <View style={styles.legalRow}>
            <Text style={styles.legal}>By continuing, you agree to our </Text>
            <Text style={styles.legalLink} onPress={() => router.push('/terms')}>Terms</Text>
            <Text style={styles.legal}> and </Text>
            <Text style={styles.legalLink} onPress={() => router.push('/privacy')}>Privacy</Text>
            <Text style={styles.legal}>.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, width: '100%', maxWidth: 460, alignSelf: 'center', paddingHorizontal: 26, paddingTop: 14, paddingBottom: 20 },
  topline: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },
  toplineText: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 2.1 },
  hero: { flex: 1, minHeight: 390, alignItems: 'center', justifyContent: 'center', paddingTop: 20 },
  markFrame: { width: 156, height: 156, borderRadius: 38, backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 136, height: 136, borderRadius: 30 },
  wordmark: { marginTop: 24, color: Colors.textPrimary, fontSize: 38, fontWeight: '800', letterSpacing: 7 },
  tagline: { marginTop: 15, color: Colors.primaryLight, fontSize: 19, fontWeight: '600', textAlign: 'center', letterSpacing: -0.3 },
  intro: { maxWidth: 330, marginTop: 10, color: Colors.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  actions: { width: '100%', gap: 12, paddingBottom: 20 },
  primaryButton: { minHeight: 54, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.6 },
  primaryText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  offlineButton: { alignItems: 'center', paddingTop: 8, minHeight: 42, justifyContent: 'center' },
  offlineText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  offlineNote: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16 },
  form: { gap: 12 },
  formTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  formHint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  input: { minHeight: 52, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceInput, color: Colors.textPrimary, borderRadius: 14, paddingHorizontal: 15, fontSize: 15 },
  link: { color: Colors.primaryLight, textAlign: 'center', fontSize: 13, padding: 6 },
  error: { color: Colors.error, textAlign: 'center', lineHeight: 19, fontSize: 13 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', paddingTop: 10 },
  legal: { color: Colors.textMuted, fontSize: 11 },
  legalLink: { color: Colors.textSecondary, fontSize: 11, textDecorationLine: 'underline' },
});
