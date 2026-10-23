import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { ScheduleConfirmation, ScheduleRule } from '@/types';

export type ScheduledAgentTaskStatus = 'active' | 'paused' | 'cancelled';

export type ScheduledAgentTask = {
  id: string;
  title: string;
  original_prompt: string;
  schedule_rule: ScheduleRule;
  next_run_at: string;
  last_run_at: string | null;
  last_run_status: 'completed' | 'failed' | null;
  last_run_summary: string | null;
  last_run_error: string | null;
  status: ScheduledAgentTaskStatus;
  created_at: string;
  updated_at: string;
  runsCount: number;
};

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;
const LOCAL_TASKS_KEY = 'tars:local-tasks:v1';
const readLocalTasks = async (): Promise<ScheduledAgentTask[]> => JSON.parse(await AsyncStorage.getItem(LOCAL_TASKS_KEY) || '[]') as ScheduledAgentTask[];

function makeLocalTask(confirmation: ScheduleConfirmation): ScheduledAgentTask {
  const now = new Date().toISOString();
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: confirmation.title,
    original_prompt: confirmation.originalPrompt,
    schedule_rule: confirmation.scheduleRule,
    next_run_at: getNextRunAt(confirmation.scheduleRule).toISOString(),
    last_run_at: null,
    last_run_status: null,
    last_run_summary: null,
    last_run_error: null,
    status: 'active',
    created_at: now,
    updated_at: now,
    runsCount: 0,
  };
}

export async function createScheduledAgentTask(
  userId: string,
  confirmation: ScheduleConfirmation,
  options?: {
    sourceThreadId?: string | null;
  },
) {
  if (!isSupabaseConfigured) {
    const tasks = await readLocalTasks();
    const task = makeLocalTask(confirmation);
    await AsyncStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify([task, ...tasks]));
    return task;
  }
  const nextRunAt = getNextRunAt(confirmation.scheduleRule);
  const taskPayload = {
    ...confirmation.taskPayload,
    ...(options?.sourceThreadId ? { sourceThreadId: options.sourceThreadId } : {}),
  };

  const { data, error } = await supabase
    .from('scheduled_agent_tasks')
    .insert({
      user_id: userId,
      title: confirmation.title,
      original_prompt: confirmation.originalPrompt,
      task_type: confirmation.taskType,
      task_payload: taskPayload,
      schedule_rule: confirmation.scheduleRule,
      timezone: confirmation.timezone,
      delivery: confirmation.delivery,
      next_run_at: nextRunAt.toISOString(),
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    throw new Error(formatSupabaseError(error));
  }

  return data;
}

export async function fetchScheduledAgentTasks() {
  if (!isSupabaseConfigured) return readLocalTasks();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(formatSupabaseError(userError));
  }

  const userId = userData.user?.id;
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from('scheduled_agent_tasks')
    .select(
      'id,title,original_prompt,schedule_rule,next_run_at,last_run_at,last_run_status,last_run_summary,last_run_error,status,created_at,updated_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatSupabaseError(error));
  }

  const tasks = (data || []) as Omit<ScheduledAgentTask, 'runsCount'>[];
  return Promise.all(
    tasks.map(async (task) => ({
      ...task,
      runsCount: await fetchScheduledTaskRunCount(task.id),
    }))
  );
}

export async function updateScheduledAgentTaskStatus(
  taskId: string,
  isActive: boolean
) {
  const status: ScheduledAgentTaskStatus = isActive ? 'active' : 'paused';
  if (!isSupabaseConfigured) {
    const tasks = await readLocalTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error('Task not found.');
    const updated = { ...task, status, updated_at: new Date().toISOString() };
    await AsyncStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(tasks.map((item) => item.id === taskId ? updated : item)));
    return updated;
  }
  const { data, error } = await supabase
    .from('scheduled_agent_tasks')
    .update({ status })
    .eq('id', taskId)
    .select(
      'id,title,original_prompt,schedule_rule,next_run_at,last_run_at,last_run_status,last_run_summary,last_run_error,status,created_at,updated_at'
    )
    .single();

  if (error) {
    throw new Error(formatSupabaseError(error));
  }

  return {
    ...(data as Omit<ScheduledAgentTask, 'runsCount'>),
    runsCount: await fetchScheduledTaskRunCount(taskId),
  };
}

export async function runScheduledAgentTaskNow(taskId: string) {
  if (!isSupabaseConfigured) throw new Error('Connect Supabase and configure the agent-run function to execute tasks.');
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const userId = sessionData.session?.user?.id;

  const { data, error } = await supabase.functions.invoke('agent-run', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: {
      mode: 'run_scheduled_task',
      scheduledTaskId: taskId,
      userId,
    },
  });

  if (error) {
    throw new Error(error.message || 'Could not run schedule');
  }

  if (data?.ok === false) {
    throw new Error(data.error || 'Could not run schedule');
  }

  if (data?.id !== taskId || data?.status !== 'completed') {
    throw new Error(
      'Scheduled run did not update this goal. Deploy the latest agent-run Edge Function and try again.'
    );
  }

  return data;
}

async function fetchScheduledTaskRunCount(taskId: string) {
  const { count, error } = await supabase
    .from('agent_tool_runs')
    .select('id', { count: 'exact', head: true })
    .filter('metadata->>scheduled_task_id', 'eq', taskId);

  if (error) {
    return 0;
  }

  return count || 0;
}

function formatSupabaseError(error: {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
}) {
  return [
    error.message || 'Could not create schedule',
    error.details,
    error.hint ? `Hint: ${error.hint}` : null,
    error.code ? `Code: ${error.code}` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

export function formatScheduleRule(rule: ScheduleRule) {
  if (!rule?.time) {
    return 'Schedule pending';
  }

  const formattedTime = formatTime(rule.time);

  if (rule.frequency === 'weekly') {
    const weekday = rule.weekday ? capitalize(rule.weekday) : 'week';
    return `Every ${weekday} at ${formattedTime}`;
  }

  return `Every day at ${formattedTime}`;
}

function getNextRunAt(rule: ScheduleRule) {
  const [hour, minute] = rule.time.split(':').map(Number);
  const next = new Date();
  next.setHours(hour, minute, 0, 0);

  if (rule.frequency === 'weekly' && rule.weekday) {
    const targetDay = WEEKDAYS.indexOf(rule.weekday as (typeof WEEKDAYS)[number]);
    const currentDay = next.getDay();
    let daysUntilTarget = (targetDay - currentDay + 7) % 7;

    if (daysUntilTarget === 0 && next <= new Date()) {
      daysUntilTarget = 7;
    }

    next.setDate(next.getDate() + daysUntilTarget);
    return next;
  }

  if (next <= new Date()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function formatTime(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
