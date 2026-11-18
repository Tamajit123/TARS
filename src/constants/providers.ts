import { providerLogos } from './providerLogos';

export const providers = {
  gmail: { name: 'Gmail', logo: providerLogos.gmail },
  slack: { name: 'Slack', logo: providerLogos.slack },
  googlecalendar: { name: 'Google Calendar', logo: providerLogos.googlecalendar },
  notion: { name: 'Notion', logo: providerLogos.notion },
  instagram: { name: 'Instagram', logo: providerLogos.instagram },
  reddit: { name: 'Reddit', logo: providerLogos.reddit },
  github: { name: 'GitHub', logo: providerLogos.github },
  twitter: { name: 'X (Twitter)', logo: providerLogos.twitter },
  trello: { name: 'Trello', logo: providerLogos.trello },
  jira: { name: 'Jira', logo: providerLogos.jira },
} as const;
const aliases: Record<string, keyof typeof providers> = { google_calendar: 'googlecalendar', 'google-calendar': 'googlecalendar', x: 'twitter', 'x-twitter': 'twitter', 'x (twitter)': 'twitter', 'google calendar': 'googlecalendar' };
export function getProvider(...identifiers: (string | null | undefined)[]) {
  for (const identifier of identifiers) {
    const slug = identifier?.trim().toLowerCase();
    if (!slug) continue;
    const key = aliases[slug] || slug;
    if (key in providers) return providers[key as keyof typeof providers];
  }
  return null;
}
