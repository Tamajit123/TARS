import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidAudioUsage, AndroidAudioContentType, IosAuthorizationStatus } from 'expo-notifications';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { deviceAlarmState, planDeviceAlarm, type DeviceAlarm, type DeviceAlarmDraft } from '@/lib/deviceAlarmPlan';

const CHANNEL = 'tars-audible-alerts-v1';
const SOUND = 'tars-alert.wav';
let serial: Promise<unknown> = Promise.resolve();
const exclusive = <T,>(action: () => Promise<T>): Promise<T> => {
  const next = serial.then(action, action); serial = next.catch(() => undefined); return next;
};
const owner = async () => (await supabase.auth.getSession()).data.session?.user.id || 'offline-preview';
const key = (id: string) => `tars:device-alarms:v1:${id}`;
const read = async (id: string): Promise<DeviceAlarm[]> => JSON.parse(await AsyncStorage.getItem(key(id)) || '[]');
export const deviceAlarmsSupported = Platform.OS === 'ios' || Platform.OS === 'android';

export function initializeDeviceAlarms() {
  if (!deviceAlarmsSupported) return;
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
}
async function permissionForSound() {
  if (!deviceAlarmsSupported) throw new Error('Alarms and timers run in the installed iOS or Android app. A browser cannot reliably ring when closed.');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Alarms and timers', description: 'Audible alerts you schedule on this device', importance: AndroidImportance.MAX, sound: SOUND, vibrationPattern: [0,300,150,300], enableVibrate: true, audioAttributes: { usage: AndroidAudioUsage.ALARM, contentType: AndroidAudioContentType.SONIFICATION } });
  }
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  if (!permission.granted || (Platform.OS === 'ios' && (permission.ios?.status !== IosAuthorizationStatus.AUTHORIZED || permission.ios?.allowsSound === false))) throw new Error('Allow TARS notifications with sound in your phone settings before scheduling an alert.');
  if (Platform.OS === 'android') {
    let exact = await Notifications.getExactAlarmPermissionsAsync();
    if (!exact.granted && exact.canAskAgain) exact = await Notifications.requestExactAlarmPermissionsAsync();
    if (!exact.granted) throw new Error('Allow Alarms & reminders for TARS in Android settings. The alert was not scheduled approximately.');
    const channel = await Notifications.getNotificationChannelAsync(CHANNEL);
    if (!channel?.sound || channel.importance < AndroidImportance.DEFAULT) throw new Error('Enable sound for the TARS Alarms and timers notification channel.');
  }
}
export async function listDeviceAlarms(): Promise<DeviceAlarm[]> {
  if (!deviceAlarmsSupported) return [];
  const rows = await read(await owner());
  const ids = new Set((await Notifications.getAllScheduledNotificationsAsync()).map(item => item.identifier));
  return rows.map(item => ({ ...item, state: deviceAlarmState(item,ids) })).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
}
export const createDeviceAlarm = (draft: DeviceAlarmDraft) => exclusive(async () => {
  planDeviceAlarm(draft); // Validate before asking for any permission.
  await permissionForSound();
  const plan = planDeviceAlarm(draft); // Timer starts after permission is granted.
  const userId = await owner(), rows = await read(userId);
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  if (pending.length >= 60) throw new Error('Too many device alerts are scheduled. Cancel an existing alert first.');
  const id = Crypto.randomUUID();
  const notificationId = `tars:${userId}:${id}`;
  const delivery = Platform.OS === 'android' ? { channelId: CHANNEL, delivery: 'alarmClock' as const } : {};
  const trigger: Notifications.NotificationTriggerInput = plan.repeatDaily
    ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: plan.hour!, minute: plan.minute!, ...delivery }
    : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(plan.dueAt), ...delivery };
  let scheduled = false;
  try {
    const returned = await Notifications.scheduleNotificationAsync({ identifier: notificationId, content: { title: plan.title, body: plan.kind === 'timer' ? 'Your TARS timer has finished.' : 'Your TARS alarm reminder is due.', sound: SOUND, data: { tarsDeviceAlarm: id }, ...(Platform.OS === 'ios' ? { interruptionLevel: 'timeSensitive' as const } : { priority: Notifications.AndroidNotificationPriority.MAX }) }, trigger });
    scheduled = true;
    if (returned !== notificationId || !(await Notifications.getAllScheduledNotificationsAsync()).some(item=>item.identifier===notificationId)) throw new Error('The phone did not confirm this alert. Please try again.');
    const alarm: DeviceAlarm = { ...plan, id, notificationId, createdAt: new Date().toISOString(), state: 'scheduled' };
    await AsyncStorage.setItem(key(userId), JSON.stringify([alarm,...rows.filter(row=>pending.some(item=>item.identifier===row.notificationId)),...rows.filter(row=>!pending.some(item=>item.identifier===row.notificationId)).slice(0,40)]));
    return alarm;
  } catch (error) {
    if (scheduled) await Notifications.cancelScheduledNotificationAsync(notificationId);
    throw error;
  }
});
export const cancelDeviceAlarm = (alarmId: string) => exclusive(async () => {
  if (!deviceAlarmsSupported) return;
  const userId = await owner(), rows = await read(userId), alarm = rows.find(item=>item.id===alarmId);
  if (!alarm) throw new Error('This device alert is unavailable.');
  await Notifications.cancelScheduledNotificationAsync(alarm.notificationId);
  if ((await Notifications.getAllScheduledNotificationsAsync()).some(item=>item.identifier===alarm.notificationId)) throw new Error('The phone did not confirm cancellation. Refresh and try again.');
  await Notifications.dismissNotificationAsync(alarm.notificationId);
  await AsyncStorage.setItem(key(userId),JSON.stringify(rows.map(item=>item.id===alarmId?{...item,state:'cancelled'}:item)));
});
export const cancelOwnedDeviceAlarms = () => exclusive(async () => {
  if (!deviceAlarmsSupported) return;
  const userId = await owner(), rows = await read(userId);
  for (const alarm of rows.filter(item=>item.state!=='cancelled')) {
    await Notifications.cancelScheduledNotificationAsync(alarm.notificationId);
    await Notifications.dismissNotificationAsync(alarm.notificationId);
  }
  await AsyncStorage.setItem(key(userId),JSON.stringify(rows.map(item=>({...item,state:'cancelled'}))));
});
