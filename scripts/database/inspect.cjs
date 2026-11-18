const fs = require('node:fs');
const path = require('node:path');
const { withClient, readPublicConfig, identifier } = require('./connection.cjs');

async function inspect(client) {
  await client.query('begin isolation level repeatable read read only');
  try {
    const result = { projectRef: readPublicConfig().projectRef, inspectedAt: new Date().toISOString() };
    const queries = {
      tables: `select c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as force_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname`,
      columns: `select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
      constraints: `select c.relname as table_name,k.conname,k.contype,k.convalidated,pg_get_constraintdef(k.oid) as definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,k.conname`,
      indexes: `select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname`,
      policies: `select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname`,
      grants: `select grantee,table_schema,table_name,privilege_type from information_schema.role_table_grants where table_schema in ('public','storage') and grantee in ('anon','authenticated','service_role') order by table_schema,table_name,grantee,privilege_type`,
      triggers: `select n.nspname as schema_name,c.relname as table_name,t.tgname as name,pn.nspname as function_schema,p.proname as function_name,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid join pg_namespace pn on pn.oid=p.pronamespace where not t.tgisinternal and n.nspname in ('public','auth') order by n.nspname,c.relname,t.tgname`,
      functions: `select n.nspname as schema_name,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef as security_definer,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by n.nspname,p.proname`,
      extensions: `select e.extname,e.extversion,n.nspname as schema_name from pg_extension e join pg_namespace n on n.oid=e.extnamespace order by e.extname`,
      buckets: `select id,name,public,file_size_limit,allowed_mime_types from storage.buckets order by id`,
      identityCounts: `select count(*)::int as users from auth.users`,
    };
    for (const [key, sql] of Object.entries(queries)) result[key] = (await client.query(sql)).rows;
    result.rows = [];
    for (const table of result.tables) {
      const fields = result.columns.filter((c) => c.table_name === table.name).map((c) => c.column_name);
      // Store hashes of original columns, never customer values. This lets a
      // later verification detect changes to pre-existing rows.
      const sql = `select count(*)::int as count,md5(coalesce(string_agg(row_hash,'' order by row_hash),'')) as fingerprint from (select md5(to_jsonb(original)::text) as row_hash from (select ${fields.map(identifier).join(',')} from public.${identifier(table.name)}) original) hashed`;
      result.rows.push({ table: table.name, columns: fields, ...(await client.query(sql)).rows[0] });
    }
    const historyExists = (await client.query("select to_regclass('supabase_migrations.schema_migrations') is not null as present")).rows[0].present;
    result.migrations = historyExists ? (await client.query('select version,name from supabase_migrations.schema_migrations order by version')).rows : [];
    const cronExists = result.extensions.some((e) => e.extname === 'pg_cron');
    result.cron = cronExists ? (await client.query("select jobid,jobname,schedule,active,command like '%agent-run%' as tars_dispatcher from cron.job order by jobid")).rows : [];
    await client.query('rollback');
    return result;
  } catch (error) { await client.query('rollback'); throw error; }
}

withClient(async (client) => {
  const result = await inspect(client);
  const outputName = process.env.TARS_AUDIT_SNAPSHOT || (process.argv.includes('--after') ? 'after.json' : 'before.json');
  if (!/^[a-zA-Z0-9_-]+\.json$/.test(outputName)) throw new Error('Use a snapshot filename inside .database-audit.');
  fs.mkdirSync('.database-audit', { recursive: true });
  fs.writeFileSync(path.join('.database-audit', outputName), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ projectRef: result.projectRef, tables: result.tables.map((t) => ({ ...t, rowCount: result.rows.find((r) => r.table === t.name).count })), migrations: result.migrations, bucketCount: result.buckets.length, cronJobs: result.cron.length, snapshot: `.database-audit/${outputName}` }, null, 2));
}).catch((error) => { console.error(JSON.stringify({ error: error.code || error.name, message: 'Database inspection failed; no changes were made.' })); process.exitCode = 1; });
