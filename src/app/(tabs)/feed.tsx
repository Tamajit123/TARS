import { TabScreen } from '@/components/common/TabScreen';
import { ScreenHeading } from '@/components/common/ScreenHeading';
import { useAppTheme } from '@/context/ThemeContext';
import type { ColorPalette } from '@/constants/colors';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {readFeedActivity,type FeedActivity} from '@/lib/feedActivity';
import {publicSourceUrl} from '@/types/execution';

type Activity = FeedActivity & {id:string;created_at:string;mapRunId?:string};

export default function FeedScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const router=useRouter(),revision=useRef(0);

  const loadActivity = useCallback(async (refresh = false) => {
    const current=++revision.current;
    try {
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
    const [requests,runs]=await Promise.all([
      supabase.from('ai_chat_requests').select('id,activity,created_at').eq('user_id',user.id).not('activity','is',null).order('created_at',{ascending:false}).limit(60),
      supabase.from('agent_tool_runs').select('id,action_name,metadata,created_at').eq('user_id',user.id).not('metadata->activity','is',null).order('created_at',{ascending:false}).limit(40),
    ]);
    if(current!==revision.current)return;
    if(requests.error||runs.error)throw new Error('Could not load recent activity. Pull to refresh to try again.');
    const rows:Activity[]=[];
    for(const row of requests.data||[]){const activity=readFeedActivity(row.activity);if(activity)rows.push({...activity,id:`chat:${row.id}`,created_at:row.created_at});}
    for(const row of runs.data||[]){const metadata=row.metadata as Record<string,unknown>|null;if(row.action_name==='maps_search_places'&&['open_maps','google_maps'].includes(String(metadata?.provider)))continue;const activity=readFeedActivity(metadata?.activity);if(activity)rows.push({...activity,id:`run:${row.id}`,created_at:row.created_at,...(['open_maps','google_maps'].includes(String(metadata?.provider))?{mapRunId:row.id}:{})});}
    setItems(rows.sort((a,b)=>b.created_at.localeCompare(a.created_at)));
    } catch {if(current===revision.current){setItems([]);setError('Could not load recent activity. Pull to refresh to try again.');}}
    finally {if(current===revision.current){setLoading(false);setRefreshing(false);}}
  }, []);

  useFocusEffect(useCallback(() => { void loadActivity();return()=>{revision.current++;}; }, [loadActivity]));

  return (
    <TabScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadActivity(true)} tintColor={Colors.primary} />}>
        <ScreenHeading title="Feed" subtitle="Your searches, tasks and their results." />
        {loading ? <View style={styles.state}><ActivityIndicator color={Colors.primary} /><Text style={styles.stateText}>Loading activity…</Text></View> : error ? <View style={styles.state}><Text style={styles.emptyTitle}>Activity unavailable</Text><Text style={styles.stateText}>{error}</Text></View> : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.orbit}><View style={styles.orbitDot} /></View>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.stateText}>Searches and tasks will appear here with their real results and status.</Text>
          </View>
        ) : items.map((item) => (
          <View key={item.id} style={styles.item}>
            <View style={[styles.marker, item.status === 'failed' && styles.markerError]} />
            <View style={styles.itemBody}>
              <View style={styles.itemMeta}><Text style={styles.action}>{item.sources.join(' · ')}</Text><Text style={styles.time}>{new Date(item.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text></View>
              <Text style={styles.input} numberOfLines={3}>{item.query}</Text>
              <Text style={styles.output}>{item.summary}</Text>
              <Text style={[styles.status, item.status === 'failed' && styles.statusError]}>{item.status}</Text>
              <Pressable accessibilityRole="button" style={{minHeight:44,justifyContent:'center'}} onPress={()=>{if(item.conversationId)router.push({pathname:'/(tabs)/chat',params:{thread_id:item.conversationId}});else if(item.mapRunId)router.push({pathname:'/maps',params:{run_id:item.mapRunId}});else router.push('/(tabs)/tasks');}}><Text style={{color:Colors.textLink,fontSize:17}}>{item.conversationId?'Open conversation':item.mapRunId?'Open map result':'Open task'}</Text></Pressable>
              {publicSourceUrl(item.sourceUrl||undefined)?<Pressable accessibilityRole="link" style={{minHeight:44,justifyContent:'center'}} onPress={()=>{void Linking.openURL(publicSourceUrl(item.sourceUrl||undefined)!.href).catch(()=>setError('The original source could not open.'));}}><Text style={{color:Colors.textLink,fontSize:17}}>View original result</Text></Pressable>:null}
            </View>
          </View>
        ))}
      </ScrollView>
    </TabScreen>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 34 },
  eyebrow: { fontSize: 11, letterSpacing: 0.6, fontWeight: '700', color: Colors.textMuted },
  title: { fontSize: 30, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.7, marginTop: 8 },
  subtitle: { fontSize: 17, lineHeight: 25, color: Colors.textSecondary, marginTop: 6, marginBottom: 24 },
  state: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  stateText: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  emptyCard: { borderWidth: 0, backgroundColor: Colors.background, borderRadius: 0, paddingHorizontal: 28, paddingVertical: 34, alignItems: 'center' },
  orbit: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: Colors.primaryBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  orbitDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.primary },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  item: { flexDirection: 'row', gap: 14, paddingVertical: 18, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  marker: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.textMuted, marginTop: 5 },
  markerError: { backgroundColor: Colors.error },
  itemBody: { flex: 1 },
  itemMeta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
  action: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  time: { color: Colors.textMuted, fontSize: 11 },
  input: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 6 },
  output: { color: Colors.textPrimary, fontSize: 15, lineHeight: 22, marginTop: 8 },
  status: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 8, letterSpacing: 1 },
  statusError: { color: Colors.error },
});
