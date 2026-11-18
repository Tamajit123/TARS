/** User-facing activity for a tool that has actually started; never a guessed step. */
export function toolActivity(name?: string): string {
  const tool = (name || '').toUpperCase();
  const providers: [string, string][] = [
    ['REDDIT_', 'Reddit'], ['TWITTER_', 'X'], ['TRELLO_', 'Trello'],
    ['JIRA_', 'Jira'], ['GMAIL_', 'Gmail'], ['SLACK_', 'Slack'],
    ['NOTION_', 'Notion'], ['GITHUB_', 'GitHub'],
    ['GOOGLECALENDAR_', 'Google Calendar'], ['GOOGLE_MAPS_', 'Google Maps'],
    ['MAPS_', 'Google Maps'],
    ['INSTAGRAM_', 'Instagram'],
  ];
  const provider = providers.find(([prefix]) => tool.startsWith(prefix));
  if (provider) return `Checking ${provider[1]}`;
  if(tool==='CLASSIFY_REQUEST')return 'Understanding your request';
  if(tool==='FETCH_PAGE')return 'Reading source pages';
  if(tool==='COMPOSE_RESPONSE')return 'Preparing your answer';
  if (tool === 'BROWSE_PAGE' || tool === 'SEARCH_WEB') return 'Browsing the web';
  return 'Working on your request';
}
