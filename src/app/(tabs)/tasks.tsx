/**
 * Tasks Tab Screen ('/(tabs)/tasks')
 *
 * Minimalist Autonomous Agent Scheduler & Goal Manager:
 * - Simple, clean UI displaying scheduled routines and goals
 * - Lists the user's real scheduled agent tasks from Supabase
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Add01Icon,
  Target01Icon,
  Clock01Icon,
  PlayIcon,
} from '@hugeicons/core-free-icons';
import { Colors } from '@/constants/colors';
import {
  fetchScheduledAgentTasks,
  formatScheduleRule,
  runScheduledAgentTaskNow,
  ScheduledAgentTask,
  updateScheduledAgentTaskStatus,
  createScheduledAgentTask,
} from '@/lib/scheduledTasks';
import { showToast } from '@/context/ToastContext';
import { ScheduleConfirmation } from '@/types';
import { supabase } from '@/lib/supabase';

export default function TasksScreen() {
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
  const [createError, setCreateError] = useState('');

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
    Alert.alert(
      'Run now?',
      `Run "${task.title}" immediately?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run',
          onPress: () => runTaskNow(task),
        },
      ],
      { cancelable: true }
    );
  };

  const runTaskNow = async (task: ScheduledAgentTask) => {
    setRunningTaskId(task.id);

    try {
      await runScheduledAgentTaskNow(task.id);
      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id
            ? {
                ...item,
                last_run_at: new Date().toISOString(),
                last_run_status: 'completed',
                runsCount: item.runsCount + 1,
              }
            : item
        )
      );
      showToast(`${task.title} ran successfully`);
      await loadTasks(true);
    } catch (error) {
      console.error('Failed to run scheduled task:', error);
      showToast(getErrorMessage(error, 'Could not run scheduled goal'));
    } finally {
      setRunningTaskId(null);
    }
  };

  const createTask = async () => {
    const title = newTitle.trim();
    const prompt = newPrompt.trim();
    if (!title || !prompt) { setCreateError('Add a title and a clear task description.'); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime)) { setCreateError('Use 24-hour time, such as 09:30.'); return; }
    setCreating(true);
    setCreateError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const confirmation: ScheduleConfirmation = {
        title,
        originalPrompt: prompt,
        taskType: 'generic_prompt',
        taskPayload: { task: prompt, prompt, useOpenAi: true },
        scheduleRule: { frequency: 'daily', time: newTime },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        delivery: 'chat',
        summary: `TARS will prepare this task every day at ${newTime}.`,
      };
      await createScheduledAgentTask(user?.id || '', confirmation);
      setCreateOpen(false);
      setNewTitle(''); setNewPrompt('');
      await loadTasks();
      showToast('Daily task saved');
    } catch (error) {
      setCreateError(getErrorMessage(error, 'Could not save this task.'));
    } finally { setCreating(false); }
  };

  return (
    <View style={styles.container}>
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
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Scheduled Agents & Goals</Text>
          <TouchableOpacity
            style={styles.newGoalBtn}
            onPress={() => { setCreateError(''); setCreateOpen(true); }}
            activeOpacity={0.8}>
            <HugeiconsIcon icon={Add01Icon} size={15} color={Colors.white} strokeWidth={2.4} />
            <Text style={styles.newGoalText}>New</Text>
          </TouchableOpacity>
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
                onPress={() => showToast(task.title)}
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

              {index < tasks.length - 1 && <View style={styles.divider} />}
            </View>
          );
          })
        )}
      </ScrollView>
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}>
          <Text style={styles.modalEyebrow}>A REPEATABLE ROUTINE</Text>
          <Text style={styles.modalTitle}>New daily task</Text>
          <Text style={styles.modalHint}>Set a task and time. TARS will only run it after you save it and the scheduled service is configured.</Text>
          <TextInput value={newTitle} onChangeText={setNewTitle} placeholder="Task name" placeholderTextColor={Colors.textMuted} style={styles.modalInput} maxLength={160} accessibilityLabel="Task name" />
          <TextInput value={newPrompt} onChangeText={setNewPrompt} placeholder="What should TARS do?" placeholderTextColor={Colors.textMuted} style={[styles.modalInput, styles.promptInput]} multiline textAlignVertical="top" maxLength={10000} accessibilityLabel="Task instructions" />
          <TextInput value={newTime} onChangeText={setNewTime} placeholder="09:00" placeholderTextColor={Colors.textMuted} style={styles.modalInput} keyboardType="numbers-and-punctuation" maxLength={5} accessibilityLabel="Daily run time" />
          {createError ? <Text style={styles.createError}>{createError}</Text> : null}
          <View style={styles.modalActions}><Pressable onPress={() => setCreateOpen(false)} style={styles.modalCancel}><Text style={styles.modalCancelText}>Cancel</Text></Pressable><Pressable onPress={createTask} disabled={creating} style={styles.modalSave}>{creating ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.modalSaveText}>Save task</Text>}</Pressable></View>
        </View></View>
      </Modal>
    </View>
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

const styles = StyleSheet.create({
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
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 4,
  },
  newGoalText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
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
    fontSize: 15.5,
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
  modalEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.7, color: Colors.primaryLight },
  modalTitle: { color: Colors.textPrimary, fontSize: 23, fontWeight: '700', marginTop: 8 },
  modalHint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 7, marginBottom: 15 },
  modalInput: { minHeight: 48, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, color: Colors.textPrimary, borderRadius: 13, paddingHorizontal: 14, fontSize: 14, marginBottom: 10 },
  promptInput: { height: 96, paddingTop: 12 },
  createError: { color: Colors.error, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 5 },
  modalCancel: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: Colors.textPrimary, fontWeight: '700' },
  modalSave: { flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalSaveText: { color: Colors.white, fontWeight: '800' },
});
