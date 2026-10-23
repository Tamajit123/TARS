import { Colors } from '@/constants/colors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

type Activity = { id: string; action_name: string; input_summary: string; output_summary: string | null; status: string; created_at: string };

export default function FeedScreen() {
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadActivity = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    if (!isSupabaseConfigured) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const { data, error: queryError } = await supabase.from('agent_tool_runs').select('id,action_name,input_summary,output_summary,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(40);
    if (queryError) setError('Could not load recent activity. Pull to refresh to try again.');
    setItems((data || []) as Activity[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void loadActivity(); }, [loadActivity]);
  useFocusEffect(useCallback(() => { void loadActivity(true); }, [loadActivity]));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadActivity(true)} tintColor={Colors.primary} />}>
        <Text style={styles.eyebrow}>YOUR WORKSPACE</Text>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.subtitle}>A quiet record of what TARS has actually done.</Text>
        {loading ? <View style={styles.state}><ActivityIndicator color={Colors.primary} /><Text style={styles.stateText}>Loading activity…</Text></View> : error ? <View style={styles.state}><Text style={styles.emptyTitle}>Activity unavailable</Text><Text style={styles.stateText}>{error}</Text></View> : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.orbit}><View style={styles.orbitDot} /></View>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.stateText}>Completed agent runs will appear here with their time and result.</Text>
          </View>
        ) : items.map((item) => (
          <View key={item.id} style={styles.item}>
            <View style={[styles.marker, item.status === 'failed' && styles.markerError]} />
            <View style={styles.itemBody}>
              <View style={styles.itemMeta}><Text style={styles.action}>{item.action_name.replaceAll('_', ' ')}</Text><Text style={styles.time}>{new Date(item.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text></View>
              <Text style={styles.input}>{item.input_summary}</Text>
              {item.output_summary ? <Text style={styles.output}>{item.output_summary}</Text> : null}
              <Text style={[styles.status, item.status === 'failed' && styles.statusError]}>{item.status}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 34 },
  eyebrow: { fontSize: 10, letterSpacing: 2, fontWeight: '700', color: Colors.textMuted },
  title: { fontSize: 30, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.7, marginTop: 8 },
  subtitle: { fontSize: 14, lineHeight: 21, color: Colors.textSecondary, marginTop: 6, marginBottom: 24 },
  state: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  stateText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  emptyCard: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, borderRadius: 20, paddingHorizontal: 28, paddingVertical: 34, alignItems: 'center' },
  orbit: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: Colors.primaryBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  orbitDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.primary },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  item: { flexDirection: 'row', gap: 14, paddingVertical: 18, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  marker: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.success, marginTop: 5 },
  markerError: { backgroundColor: Colors.error },
  itemBody: { flex: 1 },
  itemMeta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
  action: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  time: { color: Colors.textMuted, fontSize: 11 },
  input: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 },
  output: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  status: { color: Colors.success, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 8, letterSpacing: 1 },
  statusError: { color: Colors.error },
});
