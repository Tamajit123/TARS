import type { ChatMessage } from '@/types';
import type { ToolExecution } from '@/types/execution';
export function chatTimeline(messages: ChatMessage[], executions: ToolExecution[]) {
  const items = [
    ...messages.map((message, index) => ({ kind: 'message' as const, message, at: Date.parse(message.createdAt || '') || index })),
    ...executions.map(execution => ({ kind: 'execution' as const, execution, at: Date.parse(execution.started_at || execution.created_at) || 0 })),
  ];
  return items.sort((a, b) => a.at - b.at);
}
