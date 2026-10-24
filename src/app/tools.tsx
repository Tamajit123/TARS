import { Colors } from '@/constants/colors';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function IntegrationsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [providers, setProviders] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        if (active) setStatus('unavailable');
        return;
      }
      const { data, error } = await supabase.functions.invoke('agent-run', { body: { mode: 'list_connections' } });
      if (!active) return;
      if (error || data?.ok !== true || !Array.isArray(data.providers)) {
        setStatus('unavailable');
        return;
      }
      setProviders(data.providers.filter((provider: unknown): provider is string => typeof provider === 'string'));
      setStatus('ready');
    };
    void load();
    return () => { active = false; };
  }, []);
  const stateTitle = status === 'loading' ? 'Checking connected services…' : status === 'unavailable' ? 'Connection status unavailable' : providers.length ? `${providers.length} service${providers.length === 1 ? '' : 's'} connected` : 'No services connected';
  const stateBody = status === 'unavailable'
    ? 'The secure connection service could not confirm account status. Check that the agent-run function and Composio server configuration are deployed.'
    : status === 'ready' && providers.length
      ? `Confirmed by the server: ${providers.join(', ')}. Connect and disconnect actions are not configured in this build.`
      : 'Connection setup is not available in this build. No provider is shown as connected unless the live account status confirms it.';
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <View style={styles.header}><Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back"><Text style={styles.back}>‹</Text></Pressable><Text style={styles.headerTitle}>Connections</Text><View style={styles.spacer} /></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>YOUR WORKSPACE</Text>
      <Text style={styles.title}>Connected services</Text>
      <Text style={styles.lead}>Connections let TARS work with services you choose. Each one needs a server-side OAuth flow and your explicit authorization.</Text>
      <View style={styles.card}><View style={styles.statusIcon}><View style={[styles.statusDot, status === 'ready' && providers.length > 0 && styles.connectedDot]} /></View><View style={styles.copy}><Text style={styles.cardTitle}>{stateTitle}</Text><Text style={styles.cardBody}>{stateBody}</Text></View></View>
      <View style={styles.note}><Text style={styles.noteTitle}>What is needed</Text><Text style={styles.noteText}>A trusted connection service, provider OAuth configuration, and a review of each provider’s permissions. API credentials belong on the server, never in this app.</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.background }, header: { height: 54, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { color: Colors.textPrimary, fontSize: 32, lineHeight: 36, width: 35 }, headerTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' }, spacer: { width: 35 }, content: { paddingHorizontal: 23, paddingTop: 22, paddingBottom: 40 }, kicker: { color: Colors.primaryLight, fontSize: 10, letterSpacing: 1.8, fontWeight: '700' }, title: { color: Colors.textPrimary, fontSize: 29, fontWeight: '700', marginTop: 9 }, lead: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22, marginTop: 10, marginBottom: 22 }, card: { flexDirection: 'row', gap: 13, padding: 17, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface }, statusIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }, statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.textMuted }, connectedDot: { backgroundColor: Colors.primaryLight }, copy: { flex: 1 }, cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' }, cardBody: { color: Colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 6 }, note: { marginTop: 18, paddingHorizontal: 3 }, noteTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' }, noteText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 6 } });
