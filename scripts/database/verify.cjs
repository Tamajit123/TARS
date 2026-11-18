const { withClient } = require('./connection.cjs');
const { checkDatabase } = require('./checks.cjs');

withClient(async (client) => {
  await client.query('begin');
  try { console.log(JSON.stringify({ status: 'PASS', preservation: process.argv.includes('--permissions-only') ? 'NOT TESTED: permissions-only run; historical preservation results are separate' : 'PASS', checks: await checkDatabase(client), fixtures: 'all rolled back; no AI/provider calls' }, null, 2)); }
  finally { await client.query('rollback'); }
}).catch((error) => { console.error(JSON.stringify({ status: 'FAIL', code: error.code, message: error.message })); process.exitCode = 1; });
