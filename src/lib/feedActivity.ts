export type FeedActivity = {
  version: 1; query: string; title: string; summary: string; sources: string[];
  category?:string; status: 'completed' | 'partial' | 'failed' | 'cancelled'; conversationId: string | null; sourceUrl: string | null;
};

/** Only render the dedicated persisted projection, never arbitrary execution JSON. */
export function readFeedActivity(value: unknown): FeedActivity | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || !['completed','partial','failed','cancelled'].includes(String(v.status))) return null;
  for (const key of ['query','title','summary']) {
    if (typeof v[key] !== 'string' || !v[key].trim() || /^[\[{]/.test(v[key].trim()) || /Composio log/.test(v[key])) return null;
  }
  if ((v.query as string).length>12000||(v.title as string).length>120||(v.summary as string).length>900) return null;
  if (/^[A-Z][A-Z0-9]+(_[A-Z0-9]+)+$|^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v.title as string)) return null;
  const sources=['TARS','X','Google Calendar','Google Maps','OpenStreetMap','Gmail','GitHub','Web','Reddit','Slack','Notion','Jira','Trello','Instagram','Connected service','Scheduled task'];
  if (!Array.isArray(v.sources) || !v.sources.length || !v.sources.every(s=>typeof s==='string'&&sources.includes(s))) return null;
  return {
    category:typeof v.category==='string'?v.category:undefined,version: 1, query: v.query as string, title: v.title as string, summary: v.summary as string,
    sources: v.sources as string[], status: v.status as FeedActivity['status'],
    conversationId: typeof v.conversationId==='string'&&/^[0-9a-f-]{36}$/i.test(v.conversationId)?v.conversationId:null,
    sourceUrl: typeof v.sourceUrl==='string'?v.sourceUrl:null,
  };
}
