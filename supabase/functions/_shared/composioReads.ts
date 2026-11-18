// Narrow read-only declarations reviewed against live Composio schemas.
// No discovery result can grant additional execution permissions.
type Data = Record<string, any>;
export const composioReadTools = [
  { name: 'GITHUB_GET_THE_AUTHENTICATED_USER', toolkit: 'github', description: 'Read the connected GitHub user profile.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'GMAIL_LIST_LABELS', toolkit: 'gmail', description: 'List connected Gmail labels.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'GOOGLECALENDAR_LIST_CALENDARS', toolkit: 'googlecalendar', description: 'List connected Google calendars.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'REDDIT_GET_ME_PREFS', toolkit: 'reddit', description: 'Read the authenticated Reddit account language and night-mode preferences. Proves access to the connected account; does not retrieve posts or a public profile.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'TWITTER_USER_LOOKUP_ME', toolkit: 'twitter', description: 'Read the authenticated X (Twitter) profile: user ID, username and display name.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER', toolkit: 'trello', description: 'List the authenticated Trello user’s boards with IDs, names, URLs and closed status. Empty boards is a valid result.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'JIRA_SEARCH_ISSUES', toolkit: 'jira', description: 'Read Jira issues visible to the connected user with JQL. Defaults to issues assigned to the current user. Empty issues is a valid result.', parameters: { type: 'OBJECT', properties: { jql: { type: 'STRING', description: 'Read-only Jira JQL query, for example assignee = currentUser() ORDER BY updated DESC.' }, max_results: { type: 'INTEGER', minimum: 1, maximum: 20 } } } },
];

export function readArguments(name: string, args: unknown): Data {
  if (!composioReadTools.some(tool => tool.name === name) || !args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Unsupported read operation.');
  const input = args as Data;
  if (name === 'JIRA_SEARCH_ISSUES') {
    if (Object.keys(input).some(key => !['jql', 'max_results'].includes(key)) || (input.jql !== undefined && (typeof input.jql !== 'string' || !input.jql.trim() || input.jql.length > 1500)) || (input.max_results !== undefined && (!Number.isInteger(input.max_results) || input.max_results < 1 || input.max_results > 20))) throw new Error('Use a JQL query and a result limit between 1 and 20.');
    return { jql: input.jql || 'assignee = currentUser() ORDER BY updated DESC', max_results: input.max_results || 5, fields: ['summary', 'status'] };
  }
  if (Object.keys(input).length) throw new Error('This read operation takes no arguments.');
  if (name === 'REDDIT_GET_ME_PREFS') return { fields: 'lang,nightmode' };
  if (name === 'TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER') return { idMember: 'me', fields: 'name,url,closed', lists: 'none' };
  return {};
}

export function readResult(name: string, result: Data): { data: Data; count: number } {
  const envelope = result.data?.response || result.data || {};
  const status = Number(envelope.status_code || envelope.statusCode || result.data?.status_code || 0);
  if (result.result_type !== 'completed' || result.error || !result.log_id || status >= 400 || envelope.http_error || envelope.error || envelope.successful === false || result.data?.successful === false) throw new Error(status >= 400 ? `Provider read failed (HTTP ${status}).` : 'The provider did not confirm a successful read.');
  const value = envelope.data || envelope;
  if (name === 'GITHUB_GET_THE_AUTHENTICATED_USER' && typeof value.login === 'string') return { data: { login: value.login, name: value.name, url: value.html_url, publicRepositories: value.public_repos }, count: 1 };
  if (name === 'GMAIL_LIST_LABELS' && Array.isArray(value.labels)) return { data: { labels: value.labels.slice(0,100).map((item: Data) => ({ id: item.id, name: item.name, type: item.type })) }, count: value.labels.length };
  const calendars = value.calendars || value.items;
  if (name === 'GOOGLECALENDAR_LIST_CALENDARS' && Array.isArray(calendars)) return { data: { calendars: calendars.slice(0,100).map((item: Data) => ({ id: item.id, summary: item.summary, timeZone: item.timeZone, primary: item.primary })) }, count: calendars.length };
  if (name === 'REDDIT_GET_ME_PREFS' && typeof value.lang === 'string' && typeof value.nightmode === 'boolean') return { data: { language: value.lang, nightMode: value.nightmode }, count: 1 };
  if (name === 'TWITTER_USER_LOOKUP_ME' && typeof value.id === 'string' && typeof value.username === 'string') return { data: { id: value.id, username: value.username, name: value.name }, count: 1 };
  const boards = Array.isArray(value) ? value : value.details || value.boards;
  if (name === 'TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER' && Array.isArray(boards)) return { data: { boards: boards.slice(0,20).map((item: Data) => ({ id: item.id, name: item.name, url: item.url, closed: item.closed })), returned: boards.length, truncated: boards.length > 20 }, count: boards.length };
  if (name === 'JIRA_SEARCH_ISSUES' && Array.isArray(value.issues)) return { data: { issues: value.issues.slice(0,20).map((item: Data) => ({ id: item.id, key: item.key, summary: item.fields?.summary, status: item.fields?.status?.name })), total: value.total ?? value.issues.length }, count: value.issues.length };
  throw new Error('The provider returned an unexpected read result.');
}
