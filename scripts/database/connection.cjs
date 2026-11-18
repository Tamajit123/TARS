// Administrative Node tooling only. Never import this module into the app.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function readPublicConfig() {
  const values = require('node:util').parseEnv(fs.readFileSync(path.resolve('.env'), 'utf8'));
  const url = new URL(values.EXPO_PUBLIC_SUPABASE_URL);
  const projectRef = url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
  const linkedRef = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
  if (!projectRef || projectRef !== linkedRef) throw new Error('App URL and linked Supabase project must match before database access.');
  return { projectRef, url: url.origin, publicKey: values.EXPO_PUBLIC_SUPABASE_ANON_KEY };
}

function readConnection() {
  const { projectRef } = readPublicConfig();
  if (!process.argv.includes('--use-vscode-connection')) {
    throw new Error('Database tooling requires explicit --use-vscode-connection.');
  }
  // Read only the database extension state, and select only the already linked
  // TARS project. Credentials remain in memory and are never written or logged.
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(process.env.APPDATA, 'Code/User/globalStorage/state.vscdb'), { readOnly: true });
  let connections;
  try {
    const row = db.prepare('select value from ItemTable where key = ?').get('cweijan.vscode-database-client2');
    connections = JSON.parse(row?.value || '{}')['database.connections'] || {};
  } finally {
    db.close();
  }
  const linkedPooler = new URL(fs.readFileSync('supabase/.temp/pooler-url', 'utf8').trim());
  const matches = Object.entries(connections)
    .filter(([, c]) => c.host === linkedPooler.hostname && c.user === `postgres.${projectRef}` && c.database === 'postgres' && c.password)
    .sort(([a], [b]) => Number(b) - Number(a));
  if (!matches.length) throw new Error('No saved VS Code PostgreSQL connection matches the app and linked Supabase project.');
  const saved = matches[0][1];
  let password = saved.password;
  if (password.startsWith('dbclient_a$')) {
    // Database Client 9.x uses this documented-in-source storage encoding.
    // Decode only the selected project connection, in memory. These constants
    // are the extension's public format constants, not account credentials.
    const decipher = crypto.createDecipheriv('aes-128-cbc', 'BDFHJLNPpnljhfdb', 'qeO9xrUlSC7bK2s3');
    password = Buffer.concat([decipher.update(Buffer.from(password.slice('dbclient_a$'.length), 'base64')), decipher.final()]).toString('utf8');
  }
  const rootCertPath = path.resolve(process.env.TARS_DATABASE_CA || '.database-audit/supabase-root.crt');
  if (!fs.existsSync(rootCertPath)) throw new Error('Set TARS_DATABASE_CA to the Supabase database root certificate downloaded from Database Settings.');
  return {
    host: saved.host, port: Number(saved.port || 5432), user: saved.user,
    password, database: saved.database,
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(rootCertPath, 'utf8') },
    connectionTimeoutMillis: 15000, statement_timeout: 20000,
    query_timeout: 25000, application_name: 'tars-schema-maintenance',
  };
}

async function withClient(run) {
  const { Client } = require('pg');
  const client = new Client(readConnection());
  try { await client.connect(); return await run(client); }
  finally { await client.end().catch(() => {}); }
}

const identifier = (value) => '"' + value.replaceAll('"', '""') + '"';
module.exports = { readPublicConfig, readConnection, withClient, identifier };
