const path = require('node:path');
const { spawn } = require('node:child_process');
const { readConnection } = require('./connection.cjs');

try {
  const config = readConnection();
  const args = process.argv.slice(2).filter((arg) => arg !== '--use-vscode-connection');
  if (!args.length || args.includes('--debug')) throw new Error('Provide a CLI command without debug logging.');
  const child = spawn(process.execPath, [require.resolve('supabase/dist/supabase.js'), ...args], {
    env: { ...process.env, SUPABASE_DB_PASSWORD: config.password, PGPASSWORD: config.password,
      PGSSLROOTCERT: path.resolve(process.env.TARS_DATABASE_CA || '.database-audit/supabase-root.crt'), PGSSLMODE: 'verify-full' },
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  const redact = (data) => data.toString().split(config.password).join('[REDACTED]');
  child.stdout.on('data', (data) => process.stdout.write(redact(data)));
  child.stderr.on('data', (data) => process.stderr.write(redact(data)));
  child.on('exit', (code) => { process.exitCode = code || 0; });
} catch (error) {
  console.error('Database CLI could not start. Verify the saved project connection and installed development tools.');
  process.exitCode = 1;
}
