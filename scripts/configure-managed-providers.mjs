import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { Composio } from '@composio/core';
const local = parseEnv(fs.readFileSync('.env', 'utf8'));
process.env.COMPOSIO_API_KEY ||= local.COMPOSIO_API_KEY?.trim();
const audit = JSON.parse(fs.readFileSync('.database-audit/premium-provider-audit.json', 'utf8'));
const client = new Composio();
const results = [];
for (const toolkit of audit) {
  try {
    const existing = await client.authConfigs.list({ toolkit: toolkit.slug });
    if (existing.items.length) { results.push({ toolkit: toolkit.slug, status: 'existing', authConfigId: existing.items[0].id }); continue; }
    if (!toolkit.managedAuthSchemes?.length) { results.push({ toolkit: toolkit.slug, status: 'custom_oauth_required' }); continue; }
    if (!process.argv.includes('--apply')) { results.push({ toolkit: toolkit.slug, status: 'managed_auth_available' }); continue; }
    const config = await client.authConfigs.create(toolkit.slug, { type: 'use_composio_managed_auth', name: `TARS ${toolkit.slug}`, isEnabledForToolRouter: true });
    results.push({ toolkit: toolkit.slug, status: 'created', authConfigId: config.id });
  } catch (error) { results.push({ toolkit: toolkit.slug, status: 'failed', httpStatus: error.status || error.cause?.status || null, requestId: error.request_id || null }); }
}
fs.writeFileSync('.database-audit/managed-provider-setup.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
