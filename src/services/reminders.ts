import * as Notifications from 'expo-notifications';
import {AndroidImportance} from 'expo-notifications';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import {supabase} from '@/lib/supabase';
import type {Database} from '@/types/database';
import {validateReminder,reminderClock,type ReminderDraft} from '../../supabase/functions/_shared/reminderPlan';
export type Reminder=Database['public']['Tables']['task_reminders']['Row'] & {device_state?:string};
export const remindersSupported=Platform.OS==='ios'||Platform.OS==='android';
let serial:Promise<unknown>=Promise.resolve();
const exclusive=<T,>(fn:()=>Promise<T>)=>{const next=serial.then(fn,fn);serial=next.catch(()=>{});return next;};
const user=async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Sign in to manage reminders.');return user.id;};
const device=async()=>{let id=await AsyncStorage.getItem('tars:reminder-device:v1');if(!id){id=Crypto.randomUUID();await AsyncStorage.setItem('tars:reminder-device:v1',id);}return id;};
export async function reminderPermission(){if(!remindersSupported)return {supported:false,granted:false,canAskAgain:false};return {supported:true,...await Notifications.getPermissionsAsync()};}
async function permit(sound:boolean,request:boolean){
  if(!remindersSupported)throw new Error('Saved in your account. Open the installed iPhone or Android app to enable device notifications.');
  let p=await Notifications.getPermissionsAsync();if(!p.granted&&p.canAskAgain&&request)p=await Notifications.requestPermissionsAsync({ios:{allowAlert:true,allowSound:true,allowBadge:false}});
  if(!p.granted)throw new Error('Reminder saved, but notifications are off. Enable TARS notifications in Settings.');
  if(sound&&p.ios?.allowsSound===false)throw new Error('Reminder saved, but notification sound is disabled in Settings.');
  if(Platform.OS==='android'){let exact=await Notifications.getExactAlarmPermissionsAsync();if(!exact.granted&&exact.canAskAgain&&request)exact=await Notifications.requestExactAlarmPermissionsAsync();if(!exact.granted)throw new Error('Reminder saved. Enable Alarms & reminders for accurate delivery times.');}
}
export async function listReminders(){const id=await user();const {data,error}=await supabase.from('task_reminders').select('*').eq('user_id',id).neq('status','cancelled').order('due_at');if(error)throw new Error('Reminders could not load.');const pending=remindersSupported?await Notifications.getAllScheduledNotificationsAsync():[];return (data||[]).map(row=>({...row,device_state:pending.some(item=>item.content.data?.tarsReminder===row.id&&item.identifier.endsWith(`:r${row.revision}`))?'Scheduled on this phone':pending.some(item=>item.content.data?.tarsReminder===row.id)?'Notification update pending':row.repeat==='once'&&Date.parse(row.due_at)<=Date.now()?'Time reached; delivery not verified':'Not scheduled on this device'}));}
export async function saveReminder(draft:ReminderDraft,previous?:Reminder){const plan=validateReminder(draft),id=await user();const values={title:plan.title,due_at:plan.dueAt,repeat:plan.repeat,timezone:plan.timezone,sound:plan.sound,status:'active',updated_at:new Date().toISOString()} as const;
  const result=previous?await supabase.from('task_reminders').update({...values,revision:previous.revision+1}).eq('id',previous.id).eq('user_id',id).eq('revision',previous.revision).select().single():await supabase.from('task_reminders').insert({...values,user_id:id}).select().single();
  if(result.error||!result.data)throw new Error('The reminder changed or could not save. Refresh and try again.');return result.data;
}
/** Once the account save succeeds, a device sync failure must not leave the
 * creation form in a retryable state that inserts the reminder a second time. */
export async function saveAndSyncReminder(draft:ReminderDraft,previous?:Reminder){
  const reminder=await saveReminder(draft,previous);
  try{return {reminder,...await syncReminders(true)};}
  catch{return {reminder,scheduled:0,errors:['Saved in your account. Device notification scheduling could not be verified. Use Enable / check this phone to retry scheduling.']};}
}
export const syncReminders=(requestPermission=false)=>exclusive(async()=>{
  const owner=await user();if(!remindersSupported)return {scheduled:0,errors:['Saved in your account. Notifications require the installed iPhone or Android app.']};
  const deviceId=await device();const result=await supabase.from('task_reminders').select('*').eq('user_id',owner);if(result.error)throw new Error('Reminders could not sync.');
  const mappings=await supabase.from('reminder_notifications').select('*').eq('user_id',owner).eq('device_id',deviceId);if(mappings.error)throw new Error('Device notification records could not load.');
  const pending=await Notifications.getAllScheduledNotificationsAsync();const errors:string[]=[];let scheduled=0;
  for(const row of result.data||[]){
    const previous=mappings.data?.find(item=>item.reminder_id===row.id),notificationId=`tars-reminder:${owner}:${row.id}:${deviceId}:r${row.revision}`;
    const desired=row.status==='active'&&(row.repeat!=='once'||Date.parse(row.due_at)>Date.now());
    const owned=pending.filter(item=>item.identifier.startsWith(`tars-reminder:${owner}:${row.id}:${deviceId}:`));
    const cancelled=owned.filter(item=>!desired||item.identifier!==notificationId);
    for(const item of cancelled)await Notifications.cancelScheduledNotificationAsync(item.identifier);
    if(cancelled.length&&(await Notifications.getAllScheduledNotificationsAsync()).some(item=>cancelled.some(old=>old.identifier===item.identifier)))throw new Error('The phone did not confirm notification cancellation. Open Tasks and retry syncing.');
    if(!desired){await Notifications.dismissNotificationAsync(previous?.notification_id||notificationId);if(previous)await supabase.from('reminder_notifications').update({state:'cancelled',updated_at:new Date().toISOString()}).eq('reminder_id',row.id).eq('device_id',deviceId);continue;}
    if(owned.some(item=>item.identifier===notificationId)&&previous?.state==='scheduled'){scheduled++;continue;}
    try{
      await permit(row.sound,requestPermission);
      const channelId=row.sound?'tars-reminders-v1':'tars-reminders-silent-v1';
      if(Platform.OS==='android'){await Notifications.setNotificationChannelAsync(channelId,{name:row.sound?'Reminders with sound':'Silent reminders',importance:AndroidImportance.DEFAULT,sound:row.sound?'default':null});const channel=await Notifications.getNotificationChannelAsync(channelId);if(!channel||channel.importance===AndroidImportance.NONE||row.sound&&!channel.sound)throw new Error('The reminder notification channel or its sound is disabled in Settings.');}
      const clock=reminderClock(row.due_at,row.timezone);
      const trigger:Notifications.NotificationTriggerInput=row.repeat==='once'?{type:Notifications.SchedulableTriggerInputTypes.DATE,date:new Date(row.due_at),channelId}:row.repeat==='daily'?{type:Notifications.SchedulableTriggerInputTypes.DAILY,hour:clock.hour,minute:clock.minute,channelId}:{type:Notifications.SchedulableTriggerInputTypes.WEEKLY,hour:clock.hour,minute:clock.minute,weekday:clock.weekday,channelId};
      await Notifications.scheduleNotificationAsync({identifier:notificationId,content:{title:row.title,body:'Your TARS reminder is due.',sound:row.sound?'default':false,data:{tarsReminder:row.id,userId:owner}},trigger});
      if(!(await Notifications.getAllScheduledNotificationsAsync()).some(item=>item.identifier===notificationId))throw new Error('The phone did not confirm scheduling.');
      const saved=await supabase.from('reminder_notifications').upsert({reminder_id:row.id,user_id:owner,device_id:deviceId,notification_id:notificationId,revision:row.revision,state:'scheduled',updated_at:new Date().toISOString()},{onConflict:'reminder_id,device_id'});
      if(saved.error){await Notifications.cancelScheduledNotificationAsync(notificationId);throw new Error('The notification record could not save; the new alert was cancelled.');}scheduled++;
    }catch(error){errors.push(`${row.title}: ${error instanceof Error?error.message:'Scheduling failed.'}`);}
  }
  return {scheduled,errors};
});
export async function setReminderStatus(row:Reminder,status:'completed'|'cancelled'){const id=await user();const {error}=await supabase.from('task_reminders').update({status,revision:row.revision+1,updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',id).eq('revision',row.revision).select('id').single();if(error)throw new Error('This reminder changed. Refresh before trying again.');return syncReminders();}
export async function snoozeReminder(row:Reminder){await user();const {error}=await supabase.rpc('snooze_tars_reminder',{p_id:row.id,p_revision:row.revision});if(error)throw new Error('The reminder changed or could not be snoozed. Refresh and retry; the original is preserved if saving failed.');return syncReminders(true);}
export async function cancelReminderNotificationsOnSignOut(previousOwner?:string){if(!remindersSupported)return;const owner=previousOwner||(await supabase.auth.getSession()).data.session?.user.id;if(!owner)return;for(const item of await Notifications.getAllScheduledNotificationsAsync())if(item.identifier.startsWith(`tars-reminder:${owner}:`))await Notifications.cancelScheduledNotificationAsync(item.identifier);}
