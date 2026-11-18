export type DeviceAlarmDraft = { kind: 'alarm' | 'timer'; title: string; time?: string; durationSeconds?: number; repeatDaily?: boolean };
export type DeviceAlarmPlan = { kind: 'alarm' | 'timer'; title: string; dueAt: string; repeatDaily: boolean; hour?: number; minute?: number };
export type DeviceAlarm = DeviceAlarmPlan & { id: string; notificationId: string; createdAt: string; state: 'scheduled' | 'elapsed' | 'cancelled' | 'unavailable' };
export function planDeviceAlarm(draft: DeviceAlarmDraft, now = new Date()): DeviceAlarmPlan {
  const title = draft.title.trim();
  if (!title || title.length > 80) throw new Error('Use a label between 1 and 80 characters.');
  if (!Number.isFinite(now.getTime())) throw new Error('The device clock is unavailable.');
  if (draft.kind === 'timer') {
    const seconds = draft.durationSeconds;
    if (!Number.isInteger(seconds) || !seconds || seconds < 1 || seconds > 604800) throw new Error('Set a timer between 1 second and 7 days.');
    return { kind: 'timer', title, dueAt: new Date(now.getTime() + seconds * 1000).toISOString(), repeatDaily: false };
  }
  if (draft.kind !== 'alarm' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time || '')) throw new Error('Use a 24-hour alarm time, such as 07:30.');
  const [hour, minute] = draft.time!.split(':').map(Number);
  const next = new Date(now); next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return { kind: 'alarm', title, dueAt: next.toISOString(), repeatDaily: Boolean(draft.repeatDaily), hour, minute };
}
export function deviceAlarmState(alarm: DeviceAlarm, scheduledIds: Set<string>, now = Date.now()): DeviceAlarm['state'] {
  if (alarm.state === 'cancelled') return 'cancelled';
  if (scheduledIds.has(alarm.notificationId)) return 'scheduled';
  return !alarm.repeatDaily && Date.parse(alarm.dueAt) <= now ? 'elapsed' : 'unavailable';
}
