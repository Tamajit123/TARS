import { DeviceAlarmsSection } from '@/components/tasks/DeviceAlarmsSection';
import {RemindersSection} from '@/components/tasks/RemindersSection';
import { TabScreen } from '@/components/common/TabScreen';
import { AccessibleModal as Modal } from '@/components/common/AccessibleModal';
import { ScreenHeading } from '@/components/common/ScreenHeading';
import { MotionPressable } from '@/components/common/MotionPressable';
/**
 * Tasks Tab Screen ('/(tabs)/tasks')
 *
 * Minimalist Autonomous Agent Scheduler & Goal Manager:
 * - Simple, clean UI displaying scheduled routines and goals
 * - Lists the user's real scheduled agent tasks from Supabase
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Pressable,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Add01Icon,
  Target01Icon,
  Clock01Icon,
  PlayIcon,
} from '@/constants/icons';
import { useAppTheme } from '@/context/ThemeContext';
import type { ColorPalette } from '@/constants/colors';

import {
  fetchScheduledAgentTasks,
  formatScheduleRule,
  runScheduledAgentTaskNow,
  ScheduledAgentTask,
  updateScheduledAgentTaskStatus,
  createScheduledAgentTask,
  editScheduledAgentTask,
  removeScheduledAgentTask,
  fetchScheduledTaskHistory,
} from '@/lib/scheduledTasks';
import { showToast } from '@/context/ToastContext';
import { ScheduleConfirmation, ScheduleRule } from '@/types';
import { supabase } from '@/lib/supabase';
import { KeyboardFormLayout } from '@/components/common/KeyboardFormLayout';

export default function TasksScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  const [tasks, setTasks] = useState<ScheduledAgentTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [createError, setCreateError] = useState('');
  const [editing, setEditing] = useState<ScheduledAgentTask | null>(null);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [weekday, setWeekday] = useState('monday');
  const [historyTask, setHistoryTask] = useState<ScheduledAgentTask | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof fetchScheduledTaskHistory>>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [taskAction,setTaskAction] = useState<{task:ScheduledAgentTask;kind:'run'|'remove'} | null>(null);

  const openEditor = (task: ScheduledAgentTask | null) => {
    setEditing(task); setNewTitle(task?.title || ''); setNewPrompt(task?.original_prompt || '');
    setNewTime(task?.schedule_rule.time || '09:00'); setFrequency(task?.schedule_rule.frequency || 'daily');
    setWeekday(task?.schedule_rule.weekday || 'monday'); setCreateError(''); setCreateOpen(true);
  };
  const openHistory = async (task: ScheduledAgentTask) => {
    setHistoryTask(task); setHistory([]); setHistoryError(''); setHistoryLoading(true);
    try { setHistory(await fetchScheduledTaskHistory(task.id)); }
    catch (error) { setHistoryError(getErrorMessage(error, 'Could not load execution history.')); }
    finally { setHistoryLoading(false); }
  };
  const loadTasks = useCallback(async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const scheduledTasks = await fetchScheduledAgentTasks();
      setTasks(scheduledTasks);
    } catch (error) {
      console.error('Failed to load scheduled tasks:', error);
      showToast(getErrorMessage(error, 'Could not load scheduled goals'));
    } finally {
      if (refreshing) setIsRefreshing(false);
      else setIsLoading(false);
    }
  }, []);

  const removeTask = (task: ScheduledAgentTask) => setTaskAction({task,kind:'remove'});
  const applyTaskAction = async () => {
    const action=taskAction; if(!action)return; setTaskAction(null);
    if(action.kind==='run'){await runTaskNow(action.task);return;}
    const task=action.task;
      try { await removeScheduledAgentTask(task.id); await loadTasks(true); showToast('Task removed'); }
      catch (error) { showToast(getErrorMessage(error, 'Could not remove task.')); }
  };

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleToggle = async (task: ScheduledAgentTask, nextIsActive: boolean) => {
    setUpdatingTaskId(task.id);
    const previousTasks = tasks;
    const nextStatus = nextIsActive ? 'active' : 'paused';

    setTasks((prev) =>
      prev.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item))
    );

    try {
      const updatedTask = await updateScheduledAgentTaskStatus(task.id, nextIsActive);
      setTasks((prev) =>
        prev.map((item) => (item.id === task.id ? updatedTask : item))
      );
      showToast(`${task.title} is now ${nextIsActive ? 'active' : 'inactive'}`);
    } catch (error) {
      console.error('Failed to update scheduled task status:', error);
      setTasks(previousTasks);
      showToast(getErrorMessage(error, 'Could not update goal status'));
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const confirmRunTask = (task: ScheduledAgentTask) => {
    setTaskAction({task,kind:'run'});
  };

  const runTaskNow = async (task: ScheduledAgentTask) => {
    setRunningTaskId(task.id);

    try {
      const result = await runScheduledAgentTaskNow(task.id);
      if (result.status !== 'completed') throw new Error('The server did not confirm that the task completed.');
      await loadTasks(true);
      showToast(`${task.title} ran successfully`);
    } catch (error) {
      console.error('Failed to run scheduled task:', error);
      showToast(getErrorMessage(error, 'Could not run scheduled goal'));
    } finally {
      setRunningTaskId(null);
    }
  };

  const createTask = async () => {
    if (creatingRef.current) return;
    const title = newTitle.trim();
    const prompt = newPrompt.trim();
    if (!title || !prompt) { setCreateError('Add a title and a clear task description.'); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime)) { setCreateError('Use 24-hour time, such as 09:30.'); return; }
    creatingRef.current = true;
    setCreating(true);
    setCreateError('');
    try {
      const rule: ScheduleRule = { frequency, time: newTime, ...(frequency === 'weekly' ? { weekday } : {}) };
      if (editing) {
        await editScheduledAgentTask(editing.id, { title, original_prompt: prompt, schedule_rule: rule, timezone: editing.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
        setCreateOpen(false); await loadTasks(true); showToast('Task updated'); return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const confirmation: ScheduleConfirmation = {
        title,
        originalPrompt: prompt,
        taskType: 'generic_prompt',
        taskPayload: { task: prompt, prompt },
        scheduleRule: rule,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        delivery: 'chat',
        summary: `TARS will prepare this task ${frequency === 'weekly' ? `every ${weekday}` : 'every day'} at ${newTime}.`,
      };
      await createScheduledAgentTask(user?.id || '', confirmation);
      setCreateOpen(false);
      setNewTitle(''); setNewPrompt('');
      await loadTasks();
      showToast('Task saved');
    } catch (error) {
      setCreateError(getErrorMessage(error, 'Could not save this task.'));
    } finally { creatingRef.current = false; setCreating(false); }
  };

  return (
    <TabScreen style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadTasks(true)}
            tintColor={Colors.primary}
          />
        }>
        {/* Page Title & "+ New" Button */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}><ScreenHeading title="Automations" subtitle="Scheduled agents and goals." action={<MotionPressable haptic style={styles.newGoalBtn} onPress={() => openEditor(null)} accessibilityRole="button" accessibilityLabel="New scheduled task"><HugeiconsIcon icon={Add01Icon} size={18} color={Colors.onPrimary} /><Text style={styles.newGoalText}>New</Text></MotionPressable>} />
        <DeviceAlarmsSection />
        <RemindersSection />
        <Text accessibilityRole="header" style={{color:Colors.textPrimary,fontSize:22,fontWeight:'600',marginBottom:8}}>Scheduled Agents</Text>
        <Text style={{color:Colors.textSecondary,fontSize:15,lineHeight:22,marginBottom:14}}>Run in the cloud even when TARS is closed. Results appear in Chat and Feed. Connected accounts must remain authorized.</Text>
        <View style={{gap:8,marginBottom:20}}>{[
          {title:'Morning briefing',prompt:'Summarize my unread Gmail emails from today and list my Google Calendar events for today in my timezone. Use real read-only connected tools. Highlight important next steps and cite sources when available.'},
          {title:'Task roundup',prompt:'Show my open assigned Jira issues and my Trello cards using real read-only connected tools. Group by provider and include due dates and links when returned. Do not change anything.'},
          {title:'Web digest',prompt:'Use Browserbase to search the web for recent AI developer news. Summarize three useful updates with real source links and retrieval dates. Do not invent results if search is blocked.'}
        ].map(template=><MotionPressable key={template.title} accessibilityRole="button" accessibilityLabel={`Schedule ${template.title}`} onPress={()=>{openEditor(null);setNewTitle(template.title);setNewPrompt(template.prompt);}} style={{minHeight:48,padding:14,borderRadius:12,backgroundColor:Colors.surface,borderWidth:StyleSheet.hairlineWidth,borderColor:Colors.border}}><Text style={{color:Colors.textLink,fontSize:17}}>{template.title} →</Text></MotionPressable>)}</View>
</View>

        {/* Task Rows */}
        {isLoading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.stateText}>Loading scheduled goals...</Text>
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.stateContainer}>
            <View style={styles.emptyIcon}>
              <HugeiconsIcon icon={Target01Icon} size={22} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No scheduled goals yet</Text>
            <Text style={styles.emptyText}>
              Confirm a schedule from chat and it will appear here.
            </Text>
          </View>
        ) : (
          tasks.map((task, index) => {
          const isActive = task.status === 'active';
          const isUpdating = updatingTaskId === task.id;
          const isRunning = runningTaskId === task.id;

          return (
            <View key={task.id}>
              <TouchableOpacity
                style={styles.taskRow}
                onPress={() => void openHistory(task)}
                activeOpacity={0.75}>
                {/* Left Target Icon Badge */}
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: isActive ? Colors.primarySubtle : Colors.surfaceMuted },
                  ]}>
                  <HugeiconsIcon
                    icon={Target01Icon}
                    size={20}
                    color={isActive ? Colors.primary : Colors.textMuted}
                    strokeWidth={2}
                  />
                </View>

                {/* Center Content */}
                <View style={styles.textContainer}>
                  <Text style={[styles.taskTitle, !isActive && styles.pausedText]}>
                    {task.title}
                  </Text>

                  <View style={styles.metaRow}>
                    <View style={styles.scheduleItem}>
                      <HugeiconsIcon icon={Clock01Icon} size={12} color={Colors.textMuted} />
                      <Text style={styles.taskSchedule}>
                        {formatScheduleRule(task.schedule_rule)}
                      </Text>
                    </View>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.executionsText}>{task.runsCount} runs</Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.executionsText}>
                      {isActive ? 'Active' : 'Inactive'}
                    </Text>
                    {task.last_run_at ? (
                      <>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.executionsText}>
                          Last run {formatLastRun(task.last_run_at)}
                        </Text>
                      </>
                    ) : null}
                  </View>
                  {task.last_run_summary || task.last_run_error ? (
                    <View
                      style={[
                        styles.latestRunBox,
                        task.last_run_status === 'failed' && styles.latestRunErrorBox,
                      ]}>
                      <Text
                        style={[
                          styles.latestRunLabel,
                          task.last_run_status === 'failed' && styles.latestRunErrorLabel,
                        ]}>
                        {task.last_run_status === 'failed' ? 'Last run failed' : 'Last result'}
                      </Text>
                      <Text style={styles.latestRunText} numberOfLines={4}>
                        {task.last_run_status === 'failed'
                          ? task.last_run_error
                          : task.last_run_summary}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Right Controls: Switch & Run Button */}
                <View style={styles.actionsCol}>
                  <Switch
                    value={isActive}
                    onValueChange={(value) => handleToggle(task, value)}
                    disabled={isUpdating}
                    trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                    thumbColor={isActive ? Colors.primary : Colors.surfaceMuted}
                  />

                  <TouchableOpacity
                    style={[styles.runManualBtn, isRunning && styles.disabledAction]}
                    onPress={() => confirmRunTask(task)}
                    disabled={isRunning}
                    activeOpacity={0.75}>
                    {isRunning ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <HugeiconsIcon
                        icon={PlayIcon}
                        size={12}
                        color={Colors.primary}
                        strokeWidth={2.4}
                      />
                    )}
                    <Text style={styles.runManualText}>{isRunning ? 'Running' : 'Run'}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
              <View style={[styles.metaRow, { paddingHorizontal: 20, paddingBottom: 12, gap: 20 }]}>
                <Pressable onPress={() => openEditor(task)} accessibilityRole="button"><Text style={styles.runManualText}>Edit</Text></Pressable>
                <Pressable onPress={() => void openHistory(task)} accessibilityRole="button"><Text style={styles.runManualText}>History</Text></Pressable>
                <Pressable onPress={() => removeTask(task)} accessibilityRole="button"><Text style={{ color: Colors.error }}>Remove</Text></Pressable>
              </View>

              {index < tasks.length - 1 && <View style={styles.divider} />}
            </View>
          );
          })
        )}
      </ScrollView>
      <Modal visible={Boolean(taskAction)} transparent animationType="fade" onRequestClose={()=>setTaskAction(null)}>
        <View style={styles.modalBackdrop}><View accessibilityViewIsModal style={styles.modalCard}>
          <Text accessibilityRole="header" style={styles.modalTitle}>{taskAction?.kind==='remove'?'Remove task?':'Run now?'}</Text>
          <Text style={styles.modalHint}>{taskAction?.kind==='remove'?`Stop future runs of “${taskAction.task.title}”? Execution history is kept. A run already in progress may finish.`:`Run “${taskAction?.task.title}” immediately?`}</Text>
          <View style={styles.modalActions}><Pressable accessibilityRole="button" style={styles.modalCancel} onPress={()=>setTaskAction(null)}><Text style={styles.modalCancelText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" style={[styles.modalSave,taskAction?.kind==='remove'&&{backgroundColor:Colors.error}]} onPress={()=>void applyTaskAction()}><Text style={styles.modalSaveText}>{taskAction?.kind==='remove'?'Remove':'Run task'}</Text></Pressable></View>
        </View></View>
      </Modal>
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => { if (!creatingRef.current) setCreateOpen(false); }}>
        <KeyboardFormLayout onDismiss={() => { if (!creatingRef.current) setCreateOpen(false); }} dismissDisabled={creating} backdropStyle={styles.modalBackdrop} cardStyle={styles.modalCard} footer={
          <View style={styles.modalActions}><Pressable onPress={() => setCreateOpen(false)} disabled={creating} style={styles.modalCancel} accessibilityRole="button"><Text style={styles.modalCancelText}>Cancel</Text></Pressable><Pressable onPress={createTask} disabled={creating} style={styles.modalSave} accessibilityRole="button">{creating ? <ActivityIndicator color={Colors.onPrimary} /> : <Text style={styles.modalSaveText}>Save task</Text>}</Pressable></View>
        }>
          <Text style={styles.modalEyebrow}>A REPEATABLE ROUTINE</Text>
          <Text style={styles.modalTitle}>{editing ? 'Edit task' : 'New task'}</Text>
          <Text style={styles.modalHint}>Choose when TARS should run this task. Results are saved to your activity and chat.</Text>
          <TextInput value={newTitle} onChangeText={setNewTitle} placeholder="Task name" placeholderTextColor={Colors.textMuted} style={styles.modalInput} maxLength={160} accessibilityLabel="Task name" />
          <TextInput value={newPrompt} onChangeText={setNewPrompt} placeholder="What should TARS do?" placeholderTextColor={Colors.textMuted} style={[styles.modalInput, styles.promptInput]} multiline textAlignVertical="top" maxLength={10000} accessibilityLabel="Task instructions" />
          <TextInput value={newTime} onChangeText={setNewTime} placeholder="09:00" placeholderTextColor={Colors.textMuted} style={styles.modalInput} keyboardType="numbers-and-punctuation" maxLength={5} accessibilityLabel="Daily run time" />
          <View style={[styles.metaRow, { gap: 20, marginBottom: 12 }]}>{(['daily', 'weekly'] as const).map(value => <Pressable key={value} onPress={() => setFrequency(value)} accessibilityRole="radio" aria-checked={frequency === value} accessibilityState={{ checked: frequency === value }}><Text style={{ color: frequency === value ? Colors.primary : Colors.textMuted }}>{value === 'daily' ? 'Every day' : 'Every week'}</Text></Pressable>)}</View>
          {frequency === 'weekly' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>{['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(day => <Pressable key={day} onPress={() => setWeekday(day)} accessibilityRole="radio" aria-checked={weekday === day} accessibilityState={{ checked: weekday === day }} style={{ padding: 8 }}><Text style={{ color: weekday === day ? Colors.primary : Colors.textMuted }}>{day.slice(0, 3)}</Text></Pressable>)}</ScrollView> : null}
          <Text style={styles.modalHint}>Time zone: {editing?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}</Text>
          {createError ? <Text style={styles.createError}>{createError}</Text> : null}
        </KeyboardFormLayout>
      </Modal>
      <Modal visible={Boolean(historyTask)} transparent animationType="slide" onRequestClose={() => setHistoryTask(null)}>
        <View style={styles.modalBackdrop}><View style={[styles.modalCard, { maxHeight: '85%' }]}>
          <Text style={styles.modalTitle}>Execution history</Text><Text style={styles.modalHint}>{historyTask?.title} · Latest 50 runs</Text>
          {historyLoading ? <ActivityIndicator color={Colors.primary} /> : <ScrollView>{historyError ? <Text style={styles.createError}>{historyError}</Text> : !history.length ? <Text style={styles.modalHint}>No executions yet.</Text> : history.map(run => <View key={run.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border }}><Text style={{ color: Colors.textPrimary, fontWeight: '700' }}>{run.status} · {new Date(run.created_at).toLocaleString()}</Text><Text style={styles.modalHint}>{run.manual ? 'Manual' : 'Scheduled'} · Attempt {run.attempt}</Text><Text selectable style={{ color: run.error_message ? Colors.error : Colors.textPrimary }}>{run.error_message || run.output_summary || 'Waiting for the server result.'}</Text></View>)}</ScrollView>}
          <Pressable style={styles.modalCancel} onPress={() => setHistoryTask(null)}><Text style={styles.modalCancelText}>Close</Text></Pressable>
        </View></View>
      </Modal>
    </TabScreen>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatLastRun(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }

  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.iconDark,
    letterSpacing: -0.5,
    flex: 1,
    paddingRight: 12,
  },
  newGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 4,
  },
  newGoalText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 14,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.iconDark,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  pausedText: {
    color: Colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskSchedule: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  metaDot: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  executionsText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  latestRunBox: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  latestRunErrorBox: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.error,
  },
  latestRunLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 3,
  },
  latestRunErrorLabel: {
    color: Colors.error,
  },
  latestRunText: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  actionsCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  runManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  runManualText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  disabledAction: {
    opacity: 0.7,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 20,
  },
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 72,
  },
  stateText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySubtle,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.iconDark,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: Colors.textSecondary,
  },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  modalCard: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 34, backgroundColor: Colors.surfaceElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: Colors.border },
  modalEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: Colors.primaryLight },
  modalTitle: { color: Colors.textPrimary, fontSize: 23, fontWeight: '700', marginTop: 8 },
  modalHint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 7, marginBottom: 15 },
  modalInput: { minHeight: 48, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, color: Colors.textPrimary, borderRadius: 13, paddingHorizontal: 14, fontSize: 17, marginBottom: 10 },
  promptInput: { height: 96, paddingTop: 12 },
  createError: { color: Colors.error, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 5 },
  modalCancel: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: Colors.textPrimary, fontWeight: '700' },
  modalSave: { flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalSaveText: { color: Colors.onPrimary, fontWeight: '800' },
});
