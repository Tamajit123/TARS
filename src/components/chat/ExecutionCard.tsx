import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/context/ThemeContext';
import { availableBrowser, executionState, publicSourceUrl, type ToolExecution } from '@/types/execution';
import { LiveBrowserView } from './LiveBrowserView';
import {RouteCard} from './RouteCard';
import {ServiceResultPreview} from './ServiceResultPreview';
import {readServicePreview} from '../../../supabase/functions/_shared/servicePreview';
import {PlaceResults} from './PlaceResults';

export function ExecutionCard({ run, now: suppliedNow }: { run: ToolExecution; now?: number }) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const [browserUrl, setBrowserUrl] = useState('');
  const [freshExpiry,setFreshExpiry] = useState('');
  const [opening,setOpening] = useState(false);
  const [openError, setOpenError] = useState('');
  const [clock, setClock] = useState(() => Date.now());
  const state = executionState(run);
  const preview=readServicePreview(state?.result?.preview);
  const expiresAt = state?.browser?.expiresAt;
  useEffect(() => {
    if (suppliedNow !== undefined || !expiresAt || Date.parse(expiresAt) <= clock) return;
    const timer = setTimeout(() => setClock(Date.now()), Math.max(0, Date.parse(expiresAt) - clock) + 20);
    return () => clearTimeout(timer);
  }, [suppliedNow, expiresAt, clock]);
  const liveUrl = availableBrowser(run, suppliedNow ?? clock);
  const terminal = ['completed','failed','cancelled','timed_out','partial'].includes(run.status);
  const stale = !terminal && Date.parse(state?.updatedAt || run.created_at) + 120000 < (suppliedNow ?? clock);
  const running = run.status === 'running' && !stale;
  const cancelled=state?.phase==='cancelled';
  const failed = (run.status === 'failed'&&!cancelled) || state?.phase === 'timed_out';
  const provider = run.metadata.provider === 'web_search' ? 'Web search' : run.metadata.provider === 'open_maps' ? 'OpenStreetMap' : run.metadata.provider === 'google_maps' ? 'Google Maps' : run.metadata.provider === 'browserbase' ? 'Browserbase' : typeof run.metadata.toolkit === 'string' ? run.metadata.toolkit === 'twitter' ? 'X' : run.metadata.toolkit.replace(/^./, c => c.toUpperCase()) : 'Connected service';
  const title = preview?.title || state?.result?.title || state?.activity || run.action_name.replaceAll('_',' ');
  const status = cancelled?'Cancelled':stale ? 'Status unavailable' : running ? 'In progress' : failed ? 'Needs attention' : run.status === 'completed' ? 'Completed' : run.status.replaceAll('_',' ');
  const open = (url: string) => { setOpenError(''); void Linking.openURL(url).catch(() => setOpenError('The source could not open. Please try again.')); };
  const source = publicSourceUrl(state?.result?.url);
  const openBrowser = async () => {
    if (opening) return;
    if (liveUrl) { setFreshExpiry(expiresAt || ''); setBrowserUrl(liveUrl); return; }
    setOpening(true); setOpenError('');
    try {
      const {data,error} = await supabase.functions.invoke('agent-run',{body:{mode:'browser_preview',runId:run.id}});
      const preview = data?.preview;
      const candidate: ToolExecution = {...run,status:'completed',metadata:{...run.metadata,execution:{...state,browser:{available:true,...preview}}}};
      const url = preview && availableBrowser(candidate);
      if (error || !data?.ok || !url) throw new Error('The live browser could not reopen. Please try again in a moment.');
      setFreshExpiry(preview.expiresAt);setBrowserUrl(url);
    } catch(cause) {setOpenError(cause instanceof Error?cause.message:'The live browser could not reopen.');}
    finally {setOpening(false);}
  };

  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityLabel={`${provider} execution ${status}`}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${status}. ${expanded ? 'Hide' : 'View'} activity`} aria-expanded={expanded} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.header}>
      <View style={[styles.mark, { backgroundColor: failed ? colors.errorLight : colors.surfaceMuted }]}>{running ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={{ color: failed ? colors.error : colors.textSecondary, fontSize: 17 }}>{failed ? '!' : run.status === 'completed' ? '✓' : '•'}</Text>}</View>
      <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={expanded ? undefined : 2} style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '500' }}>{title}</Text><Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 2 }}>{provider} · {status}</Text></View>
      <Text style={{ color: colors.textMuted, fontSize: 17 }}>{expanded ? '−' : '+'}</Text>
    </Pressable>
    {state?.result?.route?<RouteCard route={state.result.route} onError={setOpenError}/>:null}
    {state?.result?.places?<PlaceResults places={state.result.places} onError={setOpenError}/>:null}
    {preview?<ServiceResultPreview preview={preview} onError={setOpenError}/>:null}
    {expanded ? <View style={styles.details}>
      {state?.steps.slice(-5).map((step,index) => <Text key={`${step.at}-${index}`} style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 21, marginBottom: 4 }}>• {step.label}</Text>)}
      {!preview&&state?.result?.excerpt ? <Text selectable numberOfLines={8} style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 23, marginTop: 10 }}>{state.result.excerpt}</Text> : null}
      {source ? <Pressable accessibilityRole="link" onPress={() => open(source.href)} style={styles.source}><Text style={{ color: colors.textLink, fontSize: 15 }}>{source.hostname} ↗</Text></Pressable> : null}
      {state?.result?.rows?.slice(0,8).map((row,index) => <View key={index} style={[styles.row,{borderColor:colors.border}]}>{row.slice(0,3).map((cell,col) => <View key={col} style={{flex:1,minWidth:0}}>{index === 0 && state.result?.columns?.[col] ? <Text style={{color:colors.textSecondary,fontSize:12,marginBottom:4}}>{state.result.columns[col]}</Text> : null}<Text selectable style={{color:colors.textPrimary,fontSize:14,lineHeight:21}}>{cell}</Text></View>)}</View>)}
      {state?.result?.links?.slice(0,4).map((link,index) => { const url=publicSourceUrl(link.url); return url ? <Pressable key={index} accessibilityRole="link" onPress={() => open(url.href)} style={styles.source}><Text style={{color:colors.textLink,fontSize:15,lineHeight:22}}>{link.text || url.hostname} ↗</Text></Pressable> : null; })}
      {!state && run.output_summary ? <Text selectable style={{color:colors.textPrimary,fontSize:15,lineHeight:23}}>{run.output_summary}</Text> : null}
      {typeof run.metadata.logId === 'string' ? <Text selectable style={{color:colors.textMuted,fontSize:11,marginTop:12}}>Log: {run.metadata.logId}</Text> : null}
    </View> : null}
    {run.error_message || state?.reason || openError ? <Text accessibilityRole="alert" style={[styles.error,{color:colors.error}]}>{run.error_message || state?.reason || openError}</Text> : null}
    {run.metadata.provider === 'browserbase' ? <View style={styles.browser}><Pressable disabled={opening || (!liveUrl && run.status!=='completed')} accessibilityRole="button" accessibilityLabel={liveUrl ? 'Open Browser' : 'Open fresh browser preview'} accessibilityState={{disabled:opening || (!liveUrl && run.status!=='completed'),busy:opening}} onPress={()=>void openBrowser()} style={[styles.browserButton,{backgroundColor:colors.primarySubtle}]}><Text style={{color:colors.textLink,fontSize:15,fontWeight:'600'}}>{opening?'Opening browser…':liveUrl?'Open Live Browser ↗':run.status==='completed'?'Open Fresh Browser ↗':running?'Starting browser…':'Browser Unavailable'}</Text></Pressable></View> : null}
    {browserUrl && freshExpiry ? <LiveBrowserView url={browserUrl} expiresAt={freshExpiry} onClose={() => setBrowserUrl('')} /> : null}
  </View>;
}
const styles = StyleSheet.create({card:{borderWidth:StyleSheet.hairlineWidth,borderRadius:14,marginVertical:6,overflow:'hidden'},header:{minHeight:68,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:14,paddingVertical:12},mark:{width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center'},details:{paddingHorizontal:16,paddingBottom:14},source:{minHeight:44,justifyContent:'center'},row:{flexDirection:'row',gap:12,borderTopWidth:StyleSheet.hairlineWidth,paddingVertical:10},error:{paddingHorizontal:16,paddingBottom:14,fontSize:15,lineHeight:22},browser:{paddingHorizontal:14,paddingBottom:14},browserButton:{minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:12,paddingHorizontal:12}});
