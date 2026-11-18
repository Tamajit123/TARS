const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { withClient, readPublicConfig } = require('./connection.cjs');

function runCLI(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [require.resolve('supabase/dist/supabase.js'), ...args], {
      env: { ...process.env, NODE_USE_SYSTEM_CA: '1', NODE_EXTRA_CA_CERTS: path.resolve('.npm-system-roots.pem') },
      stdio: ['ignore','pipe','pipe'],
    });
    let output = '';
    child.stdout.on('data', (part) => { output += part.toString(); });
    child.stderr.on('data', () => {});
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(output) : reject(new Error('Supabase Management API operation failed. No secret values are logged.')));
  });
}

withClient(async (client) => {
  const { projectRef, url, publicKey } = readPublicConfig();
  const existing = (await client.query("select decrypted_secret from vault.decrypted_secrets where name='tars_scheduler_secret'")).rows;
  if (existing.length > 1) throw new Error('Duplicate scheduler vault entries need review.');
  const schedulerSecret = existing[0]?.decrypted_secret || crypto.randomBytes(48).toString('base64url');
  const secrets = { SCHEDULER_SECRET: schedulerSecret };
  // Forward an explicitly configured server-only Browserbase key, if present.
  const localConfig = require('node:util').parseEnv(fs.readFileSync('.env', 'utf8'));
  for (const name of process.argv.includes('--sync-provider-keys') ? ['BROWSERBASE_API_KEY', 'COMPOSIO_API_KEY'] : []) {
    if (localConfig[name]?.trim()) secrets[name] = localConfig[name].trim();
  }
  fs.mkdirSync('.database-audit', { recursive: true });
  const secretFile = path.resolve('.database-audit/server-secrets.env');
  try {
    fs.writeFileSync(secretFile, Object.entries(secrets).map(([name,value]) => `${name}=${value}`).join('\n'), { mode: 0o600 });
    await runCLI(['secrets','set','--project-ref',projectRef,'--env-file',secretFile]);
  } finally { if (fs.existsSync(secretFile)) fs.unlinkSync(secretFile); }
  await client.query('begin');
  try {
    for (const [name,value] of Object.entries({ tars_scheduler_secret: schedulerSecret, tars_agent_project_url: url, tars_supabase_anon_key: publicKey })) {
      const rows = (await client.query('select id from vault.secrets where name=$1', [name])).rows;
      if (rows.length > 1) throw new Error('Duplicate TARS vault entries need review.');
      if (rows.length) await client.query('select vault.update_secret($1,$2,$3)', [rows[0].id,value,name]);
      else await client.query('select vault.create_secret($1,$2)', [value,name]);
    }
    if (process.argv.includes('--install-cron')) await client.query('select private.install_tars_dispatcher()');
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; }
  console.log(JSON.stringify({ status: 'PASS', projectRef, serverSecretNames: Object.keys(secrets), vaultConfigured: true, cronInstalled: process.argv.includes('--install-cron'), localSecretFileRemoved: true }));
}).catch((error) => { console.error(JSON.stringify({ status: 'FAIL', code: error.code || error.name, message: 'Server configuration failed; no credentials are logged.' })); process.exitCode = 1; });
