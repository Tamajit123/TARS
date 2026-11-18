export type ExecutionPhase = 'planning' | 'running' | 'intermediate' | 'awaiting_confirmation' | 'completed' | 'failed' | 'cancelled' | 'timed_out' | 'partial';
import type {ServicePreview} from './servicePreview.ts';
export type MapRoute={origin:string;destination:string;originLabel?:string;destinationLabel?:string;mode:string;retrievedAt:string;trafficAware:boolean;source?:'google'|'composio'|'osrm';options:{distanceMeters:number;durationSeconds:number;staticDurationSeconds?:number;summary?:string;encodedPolyline?:string}[]};
export type MapPlaces={source?:'google'|'osm';retrievedAt:string;items:{id:string;name:string;address:string;latitude:number;longitude:number;url?:string;attributions?:{name:string;url?:string}[]}[]};
export type ExecutionResult = { title: string; url?: string; excerpt?: string; links?: { text: string; url: string }[]; columns?: string[]; rows?: string[][];route?:MapRoute;places?:MapPlaces;preview?:ServicePreview };
export type ExecutionState = {
  version: 1; phase: ExecutionPhase; activity: string; updatedAt: string;
  steps: { label: string; at: string }[];
  result?: ExecutionResult;
  browser?: { sessionId: string; available: boolean; liveUrl?: string; expiresAt: string };
  reason?: string;
};
export type ToolExecution = { id: string; action_name: string; status: string; created_at: string; started_at?: string | null; finished_at?: string | null; output_summary?: string | null; error_message?: string | null; metadata: Record<string, unknown> };
export function executionState(run: ToolExecution): ExecutionState | null {
  const value = run.metadata.execution as ExecutionState | undefined;
  return value?.version === 1 && typeof value.activity === 'string' && Array.isArray(value.steps) ? value : null;
}
export function availableBrowser(run: ToolExecution, now = Date.now()) {
  const state = executionState(run);
  if (!['running', 'completed'].includes(run.status) || !state?.browser?.available || !(Date.parse(state.browser.expiresAt) > now)) return null;
  try { const url = new URL(state.browser.liveUrl || ''); return url.protocol === 'https:' && /(^|\.)browserbase\.com$/.test(url.hostname) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function publicSourceUrl(value: string | undefined) {
  try { const url = new URL(value || ''); return url.protocol === 'https:' && !url.username && !url.password && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname) && !/(^|\.)(localhost|local|internal)$/.test(url.hostname) && !/^\d+\./.test(url.hostname) ? url : null; } catch { return null; }
}
