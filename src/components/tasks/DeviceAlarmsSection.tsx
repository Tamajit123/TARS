import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AccessibleModal as Modal } from '@/components/common/AccessibleModal';
import { KeyboardFormLayout } from '@/components/common/KeyboardFormLayout';
import { NativeIcon } from '@/components/common/NativeIcon';
import { Clock01Icon, Add01Icon } from '@/constants/icons';
import { useAppTheme } from '@/context/ThemeContext';
import { cancelDeviceAlarm, createDeviceAlarm, deviceAlarmsSupported, listDeviceAlarms } from '@/services/deviceAlarms';
import type { DeviceAlarm } from '@/lib/deviceAlarmPlan';

function Countdown({ dueAt }: { dueAt: string }) {
  const { colors } = useAppTheme();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(()=>setNow(Date.now()),1000); return ()=>clearInterval(timer); },[]);
  const seconds = Math.max(0,Math.ceil((Date.parse(dueAt)-now)/1000));
  return <Text style={{color:colors.textPrimary,fontSize:22,fontVariant:['tabular-nums'],marginTop:6}}>{Math.floor(seconds/3600).toString().padStart(2,'0')}:{Math.floor(seconds%3600/60).toString().padStart(2,'0')}:{(seconds%60).toString().padStart(2,'0')}</Text>;
}
export function DeviceAlarmsSection() {
  const { colors } = useAppTheme();
  const [alarms,setAlarms] = useState<DeviceAlarm[]>([]),[open,setOpen] = useState(false),[kind,setKind] = useState<'alarm'|'timer'>('timer');
  const [title,setTitle] = useState(''),[time,setTime] = useState('07:00'),[minutes,setMinutes] = useState('5'),[daily,setDaily] = useState(false);
  const [busy,setBusy] = useState(false),[error,setError] = useState('');
  const lock=useRef(false), mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const load=useCallback(async()=>{try{const rows=await listDeviceAlarms();if(mounted.current)setAlarms(rows);}catch{if(mounted.current)setError('Device alerts could not be checked. Reopen Tasks to try again.');}},[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state==='active')void load();});return()=>listener.remove();},[load]);
  const show=(next:'alarm'|'timer')=>{setKind(next);setTitle('');setError('');setOpen(true);};
  const save=async()=>{
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try {
      const duration=Number(minutes)*60;
      await createDeviceAlarm({kind,title:title.trim() || (kind==='timer'?'TARS timer':'TARS alarm'),time,durationSeconds:duration,repeatDaily:daily});
      if(mounted.current){setOpen(false);await load();}
    }catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'The phone could not schedule this alert.');}
    finally{lock.current=false;if(mounted.current)setBusy(false);}
  };
  const cancel=async(id:string)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await cancelDeviceAlarm(id);await load();}catch{setError('Cancellation was not confirmed. Refresh Tasks before trying again.');}finally{lock.current=false;setBusy(false);}};
  return <View style={{marginBottom:28}}>
    <View style={styles.heading}><NativeIcon symbol="alarm" fallback={Clock01Icon} size={22} color={colors.textPrimary}/><Text accessibilityRole="header" style={{color:colors.textPrimary,fontSize:22,fontWeight:'600'}}>Alarms & Timers</Text></View>
    <Text style={{color:colors.textSecondary,fontSize:15,lineHeight:22,marginVertical:10}}>{deviceAlarmsSupported?'Sound alerts scheduled on this phone, even when TARS is closed.':'Use the installed iPhone or Android app to schedule sound alerts. Browsers cannot reliably ring when closed.'}</Text>
    <View style={styles.actions}>{(['alarm','timer'] as const).map(value=><Pressable key={value} disabled={!deviceAlarmsSupported||busy} accessibilityRole="button" accessibilityLabel={`New ${value}`} onPress={()=>show(value)} style={[styles.action,{backgroundColor:colors.primarySubtle,opacity:deviceAlarmsSupported?1:0.6}]}><NativeIcon symbol="plus" fallback={Add01Icon} size={17} color={colors.textLink}/><Text style={{color:colors.textLink,fontSize:15,fontWeight:'600'}}>New {value}</Text></Pressable>)}</View>
    {alarms.filter(item=>item.state!=='cancelled').map(alarm=><View key={alarm.id} style={[styles.alarm,{borderColor:colors.border,backgroundColor:colors.surface}]}><View style={{flex:1}}><Text style={{color:colors.textPrimary,fontSize:17,fontWeight:'600'}}>{alarm.title}</Text><Text style={{color:colors.textSecondary,fontSize:13,lineHeight:20,marginTop:4}}>{alarm.repeatDaily?`Every day at ${String(alarm.hour).padStart(2,'0')}:${String(alarm.minute).padStart(2,'0')}`:new Date(alarm.dueAt).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'})} · {alarm.state==='scheduled'?'Scheduled on this phone':alarm.state==='elapsed'?'Time reached': 'Not scheduled — check phone permissions'}</Text>{alarm.kind==='timer'&&alarm.state==='scheduled'?<Countdown dueAt={alarm.dueAt}/>:null}</View>{alarm.state==='scheduled'||alarm.state==='unavailable'?<Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Cancel ${alarm.title}`} onPress={()=>void cancel(alarm.id)} style={styles.cancel}><Text style={{color:colors.error,fontSize:15}}>Cancel</Text></Pressable>:null}</View>)}
    {error&&!open?<Text accessibilityRole="alert" style={{color:colors.error,fontSize:15,lineHeight:22,marginTop:10}}>{error}</Text>:null}
    <Modal visible={open} transparent animationType="slide" onRequestClose={()=>{if(!lock.current)setOpen(false);}}><KeyboardFormLayout dismissDisabled={busy} onDismiss={()=>{if(!lock.current)setOpen(false);}} backdropStyle={{backgroundColor:colors.overlay}} cardStyle={{backgroundColor:colors.surfaceElevated,borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:24,paddingTop:20}} footer={<View style={[styles.actions,{marginVertical:12}]}><Pressable disabled={busy} onPress={()=>setOpen(false)} style={[styles.action,{backgroundColor:colors.surfaceMuted}]}><Text style={{color:colors.textPrimary,fontSize:17}}>Cancel</Text></Pressable><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={kind==='timer'?'Start timer':'Set alarm reminder'} onPress={()=>void save()} style={[styles.action,{backgroundColor:colors.primary}]}><Text style={{color:colors.onPrimary,fontSize:17,fontWeight:'600'}}>{busy?'Scheduling…':kind==='timer'?'Start Timer':'Set Alarm'}</Text></Pressable></View>}>
      <Text accessibilityRole="header" style={{color:colors.textPrimary,fontSize:28,fontWeight:'700',marginBottom:20}}>{kind==='timer'?'New Timer':'New Alarm'}</Text>
      <Text style={{color:colors.textSecondary,fontSize:15,marginBottom:8}}>Label</Text><TextInput accessibilityLabel="Alert label" value={title} onChangeText={setTitle} editable={!busy} maxLength={80} placeholder={kind==='timer'?'TARS timer':'TARS alarm'} placeholderTextColor={colors.textMuted} style={[styles.input,{backgroundColor:colors.surface,color:colors.textPrimary,borderColor:colors.border}]}/>
      <Text style={{color:colors.textSecondary,fontSize:15,marginBottom:8}}>{kind==='timer'?'Duration in minutes (0.1 = 6 seconds)':'Time on this phone (24-hour)'}</Text><TextInput accessibilityLabel={kind==='timer'?'Timer minutes':'Alarm time'} value={kind==='timer'?minutes:time} onChangeText={kind==='timer'?setMinutes:setTime} keyboardType={kind==='timer'?'decimal-pad':'numbers-and-punctuation'} editable={!busy} placeholder={kind==='timer'?'5':'07:00'} placeholderTextColor={colors.textMuted} style={[styles.input,{backgroundColor:colors.surface,color:colors.textPrimary,borderColor:colors.border}]}/>
      {kind==='alarm'?<View style={[styles.actions,{justifyContent:'space-between',alignItems:'center',marginBottom:16}]}><Text style={{color:colors.textPrimary,fontSize:17}}>Repeat every day</Text><Switch accessibilityLabel="Repeat alarm every day" value={daily} onValueChange={setDaily} disabled={busy}/></View>:null}
      <Text style={{color:colors.textSecondary,fontSize:15,lineHeight:22}}>The alert uses a 12-second sound. Check your phone volume and notification settings. iPhone Silent mode and Focus may silence it. This is a notification alert, not a continuous Clock alarm.</Text>
      <Text style={{color:colors.textMuted,fontSize:13,lineHeight:20,marginTop:10}}>Alerts stay on this device and are cancelled when you sign out. A rebuilt TARS app is required for its bundled sound and Android exact alarms.</Text>
      {error?<Text accessibilityRole="alert" style={{color:colors.error,fontSize:15,lineHeight:22,marginTop:14}}>{error}</Text>:null}
    </KeyboardFormLayout></Modal>
  </View>;
}
const styles=StyleSheet.create({heading:{flexDirection:'row',alignItems:'center',gap:10},actions:{flexDirection:'row',gap:10},action:{flex:1,minHeight:48,paddingHorizontal:12,paddingVertical:12,borderRadius:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},alarm:{borderWidth:StyleSheet.hairlineWidth,borderRadius:14,padding:16,marginTop:12,flexDirection:'row',alignItems:'center',gap:12},cancel:{minHeight:44,paddingHorizontal:8,justifyContent:'center'},input:{minHeight:50,borderRadius:12,borderWidth:StyleSheet.hairlineWidth,padding:14,fontSize:17,marginBottom:16}});
