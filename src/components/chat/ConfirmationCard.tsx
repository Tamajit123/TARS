import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/context/ThemeContext';
import { AssistantText } from './AssistantText';
import { supabase } from '@/lib/supabase';
import {syncReminders} from '@/services/reminders';
import type { Database } from '@/types/database';
type PendingAction = Database['public']['Tables']['pending_tool_actions']['Row'];
const label = (value: string) => value.replaceAll('_', ' ').replace(/^./, char => char.toUpperCase());
function details(value: unknown, prefix = '', depth = 0): { label: string; value: string }[] {
  if (depth > 4 || value === null || value === undefined) return [];
  if (typeof value !== 'object') return [{ label: label(prefix), value: String(value).slice(0, 5000) }];
  return Object.entries(value).flatMap(([key, item]) => details(item, prefix ? `${prefix} / ${key}` : key, depth + 1)).slice(0, 30);
}
export function ConfirmationCard({ action, onChanged }: { action: PendingAction; onChanged: () => void }) {
  const { colors } = useAppTheme();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [deviceNotice,setDeviceNotice]=useState('');
  const [expired, setExpired] = useState(() => Date.parse(action.expires_at) <= Date.now());
  const lock = useRef(false);
  useEffect(() => { const timer = setTimeout(() => setExpired(true), Math.max(0, Date.parse(action.expires_at) - Date.now())); return () => clearTimeout(timer); }, [action.expires_at]);
  const submit = async (cancel = false) => {
    if (lock.current || expired || action.status !== 'pending') return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await supabase.functions.invoke('agent-run', { body: { mode: cancel ? 'cancel_tool_action' : 'confirm_tool_action', actionId: action.id } });
      if (result.error || !result.data?.ok) {
        const failure = result.error?.context && typeof result.error.context.json === 'function' ? await result.error.context.json().catch(() => null) : result.data;
        throw new Error(failure?.message || 'This action could not be confirmed. Check its status before trying again.');
      }
      if(!cancel&&action.tool_slug==='TARS_CREATE_REMINDER'){const device=await syncReminders(true);setDeviceNotice(device.errors.join('\n')||'Reminder notification scheduled and verified on this phone.');}
      onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'This action could not be confirmed.'); onChanged(); }
    finally { lock.current = false; setBusy(false); }
  };
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{label(action.toolkit)} · {action.status === 'pending' ? expired ? 'Confirmation expired' : 'Review before executing' : label(action.status)}</Text><Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '600', marginTop: 8 }}>{label(action.tool_slug)}</Text>{details(action.arguments).map((item, index) => <View key={index} style={{ marginTop: 12 }}><Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.label}</Text><Text selectable style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 22, marginTop: 3 }}>{item.value}</Text></View>)}{action.status === 'pending' && !expired ? <><Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 16 }}>{action.tool_slug==='TARS_CREATE_REMINDER'?'Confirm saves the reminder and asks this phone to schedule it. Notification permission is required.':'Confirm will perform this action in your connected account. Review the destination and content first.'}</Text><View style={styles.actions}><Pressable disabled={busy} accessibilityRole="button" onPress={() => void submit(true)} style={[styles.button, { backgroundColor: colors.surfaceMuted }]}><Text style={{ color: colors.textPrimary }}>Cancel</Text></Pressable><Pressable disabled={busy} accessibilityRole="button" onPress={() => void submit()} style={[styles.button, { backgroundColor: colors.primary }]}><Text style={{ color: colors.onPrimary, fontWeight: '600' }}>{busy ? 'Submitting…' : 'Confirm action'}</Text></Pressable></View></> : null}{action.status === 'completed' && action.result ? <View style={{ marginTop: 16 }}><Text style={{ color: colors.success, fontWeight: '600' }}>Confirmed result</Text>{details(action.result).filter(item => !/log id/i.test(item.label)).map((item, index) => <View key={index} style={{ marginTop: 8 }}><Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.label}</Text><AssistantText text={item.value} color={colors.textPrimary} linkColor={colors.textLink} /></View>)}</View> : null}{action.status === 'failed' ? <Text style={{ color: colors.error, marginTop: 12, lineHeight: 20 }}>Execution could not be confirmed. Check the provider before preparing another attempt.</Text> : null}{deviceNotice?<Text accessibilityLiveRegion="polite" style={{color:colors.textSecondary,marginTop:12,lineHeight:22}}>{deviceNotice}</Text>:null}{action.tool_slug==='TARS_CREATE_REMINDER'&&action.status==='completed'?<Pressable accessibilityRole="button" onPress={()=>{void syncReminders(true).then(device=>setDeviceNotice(device.errors.join('\n')||'Scheduled and verified on this phone.')).catch(()=>setDeviceNotice('Device scheduling could not be verified. Open Tasks → Reminders.'));}} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.textLink}}>Enable / check on this phone</Text></Pressable>:null}{error ? <Text accessibilityRole="alert" style={{ color: colors.error, marginTop: 12 }}>{error}</Text> : null}</View>;
}
const styles = StyleSheet.create({ card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16, marginVertical: 8 }, actions: { flexDirection: 'row', gap: 10, marginTop: 16 }, button: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12 } });
