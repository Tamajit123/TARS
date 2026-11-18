// Read the operator-supplied credential from stdin, never a command argument.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { readPublicConfig } = require('./connection.cjs');
(async () => {
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  let input = '';
  for await (const part of process.stdin) { input += part; if (/[\r\n]/.test(input)) break; }
  const key = input.trim();
  if (!key || /[\r\n]/.test(key)) throw new Error('Invalid credential input.');
  const response = await fetch('https://backend.composio.dev/api/v3.1/auth_configs?limit=100', { headers: { 'x-api-key': key }, signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { console.log(JSON.stringify({ provider: 'composio', httpStatus: response.status, configured: false })); process.exitCode = 1; return; }
  const secretFile = path.resolve('.database-audit/composio-secret.env');
  try {
    fs.writeFileSync(secretFile, `COMPOSIO_API_KEY=${key}\n`, { mode: 0o600 });
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [require.resolve('supabase/dist/supabase.js'), 'secrets', 'set', '--project-ref', readPublicConfig().projectRef, '--env-file', secretFile], { env: { ...process.env, NODE_USE_SYSTEM_CA: '1', NODE_EXTRA_CA_CERTS: path.resolve('.npm-system-roots.pem') }, stdio: 'ignore' });
      child.on('error', reject); child.on('close', (code) => code === 0 ? resolve() : reject(new Error('Server secret configuration failed.')));
    });
    console.log(JSON.stringify({ provider: 'composio', httpStatus: response.status, configured: true, authConfigs: (data.items || []).map((item) => ({ id: item.id, toolkit: item.toolkit?.slug, enabled: item.is_enabled })) }));
  } finally { if (fs.existsSync(secretFile)) fs.unlinkSync(secretFile); }
})().catch(() => { console.error('Composio configuration failed; no credential values are logged.'); process.exitCode = 1; });
