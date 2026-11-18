// Read-only metadata audit. Credentials stay in the ignored local environment.
const fs = require('node:fs');
const local = require('node:util').parseEnv(fs.readFileSync('.env', 'utf8'));
const base = 'https://backend.composio.dev/api/v3.1/';
const slugs = ['gmail','slack','googlecalendar','notion','instagram','reddit','github','twitter','trello','jira'];
(async () => {
  const results = [];
  for (const slug of slugs) {
    const response = await fetch(base + 'toolkits/' + slug, { headers: { 'x-api-key': local.COMPOSIO_API_KEY }, signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    results.push({ slug, status: response.status, fields: Object.keys(data), authSchemes: data.auth_schemes, managedAuthSchemes: data.composio_managed_auth_schemes, authConfigDetails: data.auth_config_details });
  }
  fs.mkdirSync('.database-audit', { recursive: true });
  fs.writeFileSync('.database-audit/premium-provider-audit.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(JSON.stringify({ status: 'FAIL', reason: error.name })); process.exitCode = 1; });
