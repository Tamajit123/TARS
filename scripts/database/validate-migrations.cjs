const fs = require('node:fs');
const { withClient } = require('./connection.cjs');
const { checkDatabase } = require('./checks.cjs');

withClient(async (client) => {
  await client.query('begin');
  try {
    const historyExists = (await client.query("select to_regclass('supabase_migrations.schema_migrations') is not null as present")).rows[0].present;
    const history = historyExists ? (await client.query('select version from supabase_migrations.schema_migrations')).rows.map((r) => r.version) : [];
    const files = fs.readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql') && !history.includes(f.split('_')[0])).sort();
    for (const file of files) {
      const sql = fs.readFileSync(`supabase/migrations/${file}`, 'utf8').replace(/^begin;\s*$/gmi, '').replace(/^commit;\s*$/gmi, '');
      await client.query(sql);
    }
    const checks = await checkDatabase(client);
    console.log(JSON.stringify({ status: 'PASS', pendingMigrations: files, checks, transaction: 'ROLLBACK; no schema or fixture changes retained' }, null, 2));
  } finally { await client.query('rollback'); }
}).catch((error) => { console.error(JSON.stringify({ status: 'FAIL', code: error.code, message: error.message,functions:error.where?.split('\n').filter(line=>line.startsWith('PL/pgSQL function')) })); process.exitCode = 1; });
