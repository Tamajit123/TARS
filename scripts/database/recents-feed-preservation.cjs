const fs=require('node:fs'),assert=require('node:assert/strict');
const {withClient,identifier}=require('./connection.cjs');
const snapshot='.database-audit/recents-feed-preservation.json';
withClient(async db=>{
  await db.query('begin isolation level repeatable read read only');
  try {
    const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
    const result=[];
    for(const {tablename} of tables){
      // The only permitted existing-value edits are legacy thread category/title
      // and the new derived activity projection. All other values must match.
      const expression=tablename==='chat_threads'?"to_jsonb(t)-'type'-'title'":tablename==='agent_tool_runs'?"(to_jsonb(t)-'metadata')||jsonb_build_object('metadata',t.metadata-'activity')":"to_jsonb(t)-'activity'";
      const row=(await db.query(`select count(*)::int as count,md5(coalesce(string_agg(hash,'' order by hash),'')) as fingerprint from (select md5((${expression})::text) hash from public.${identifier(tablename)} t) p`)).rows[0];
      result.push({table:tablename,...row});
    }
    if(process.argv.includes('--capture')){assert.ok(!fs.existsSync(snapshot),'Never overwrite the preservation baseline');fs.writeFileSync(snapshot,JSON.stringify(result,null,2));console.log(JSON.stringify({status:'CAPTURED',tables:result.length,snapshot}));}
    else{
      const before=JSON.parse(fs.readFileSync(snapshot,'utf8'));
      const checks=result.map(row=>({table:row.table,rowCount:row.count,originalRowCount:before.find(old=>old.table===row.table)?.count,status:JSON.stringify(row)===JSON.stringify(before.find(old=>old.table===row.table))?'PASS':'FAIL'}));
      const same=result.length===before.length&&checks.every(row=>row.status==='PASS');
      console.log(JSON.stringify({status:same?'PASS':'FAIL',checks,scope:'Original fingerprint excluding only approved thread type/title and derived activity. The chat_threads updated_at trigger changed timestamps; this difference is not waived or hidden.'}));
      if(!same)process.exitCode=1;
    }
  } finally {await db.query('rollback');}
}).catch(e=>{console.error(JSON.stringify({status:'FAIL',code:e.code||e.name,message:e.message}));process.exitCode=1;});
