import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { Composio } from '@composio/core';
const local = parseEnv(fs.readFileSync('.env','utf8'));
process.env.COMPOSIO_API_KEY ||= local.COMPOSIO_API_KEY?.trim();
const identity = JSON.parse(fs.readFileSync('.database-audit/composio-session.json','utf8'));
const api = new Composio();
const session = await api.sessions.use(identity.sessionId);
if (process.argv.includes('--links')) {
  const links = [];
  for (const toolkit of ['slack','notion','instagram','reddit','twitter','trello','jira']) {
    try { const link = await session.authorize(toolkit); links.push({ toolkit, url: link.redirectUrl, connectionId: link.connectedAccountId }); }
    catch (error) { links.push({ toolkit, status: 'failed', code: error.name, httpStatus: error.status || error.cause?.status || null }); }
  }
  fs.writeFileSync('.database-audit/premium-connect-links.json', JSON.stringify(links,null,2));
  console.log(JSON.stringify(links,null,2));
} else {
  const queries = {
    gmail: 'Retrieve the latest unread emails with their content for summarization',
    googlecalendar: 'List upcoming calendar events and create a calendar event',
    github: 'List my repositories and issues',
    slack: 'Read workspace channels and send a message to a channel',
    notion: 'Search authorized pages and create a page',
    instagram: 'Read my Instagram profile and media',
    reddit: 'Read my Reddit profile and posts',
    twitter: 'Read my X Twitter profile and recent posts',
    trello: 'List my Trello boards and cards and create a card',
    jira: 'Search Jira issues and create an issue',
  };
  const discovered = [];
  for (const [toolkit, query] of Object.entries(queries)) {
    try {
      const result = await session.search({ query, toolkits: [toolkit] });
      discovered.push({ toolkit, primary: result.results?.flatMap(result => result.primaryToolSlugs || []), schemas: result.toolSchemas });
      console.log(JSON.stringify({ toolkit, primary: discovered.at(-1).primary, fullSchemas: Object.values(result.toolSchemas || {}).filter(schema=>schema.hasFullSchema).length }));
    } catch (error) { console.log(JSON.stringify({ toolkit, error: error.name })); }
  }
  fs.writeFileSync('.database-audit/premium-tool-discovery.json',JSON.stringify(discovered,null,2));
}
