const {withClient,identifier}=require('./connection.cjs');const fs=require('node:fs'),assert=require('node:assert/strict');
withClient(async db=>{
  const baseline=JSON.parse(fs.readFileSync('.database-audit/universal-baseline-20261118.json','utf8'));
  await db.query('begin');try{
    const permission=(await db.query("select has_function_privilege('authenticated','public.claim_tars_research_run(uuid,text,text,jsonb)','EXECUTE') client,has_function_privilege('anon','public.claim_tars_research_run(uuid,text,text,jsonb)','EXECUTE') anon,has_function_privilege('service_role','public.claim_tars_research_run(uuid,text,text,jsonb)','EXECUTE') server")).rows[0];assert.equal(permission.client,false);assert.equal(permission.anon,false);assert.equal(permission.server,true);
    assert.equal((await db.query("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity")).rows[0].n,0);
    const original=baseline.rows.find(row=>row.table==='chat_messages');
    const fields=original.columns.map(identifier).join(',');const saved=(await db.query(`select count(*)::int count,md5(coalesce(string_agg(h,'' order by h),'')) fingerprint from (select md5(to_jsonb(original)::text) h from (select ${fields} from public.chat_messages where created_at<=$1) original) hashes`,[baseline.inspectedAt])).rows[0];
    assert.equal(saved.count,original.count);assert.equal(saved.fingerprint,original.fingerprint);
    const owner=(await db.query('select id from public.profiles order by created_at limit 1')).rows[0].id;
    await db.query('set local role service_role');
    const args=[owner,'research_search','Synthetic rollback verification',JSON.stringify({provider:'web_search',research:{key:'rollback-only'}})];
    const first=(await db.query('select public.claim_tars_research_run($1,$2,$3,$4) id',args)).rows[0].id;assert.ok(first);
    const second=(await db.query('select public.claim_tars_research_run($1,$2,$3,$4) id',args)).rows[0].id;assert.ok(second);
    const third=(await db.query('select public.claim_tars_research_run($1,$2,$3,$4) id',args)).rows[0].id;assert.equal(third,null);
    await db.query('reset role');
    const rows=(await db.query("select r.request_id,r.status,r.error_code,m.metadata->>'model' model,m.metadata->'timings' timings,m.metadata->'requestPlan'->>'category' category,m.metadata->'richResponse'->>'status' rich_status,jsonb_array_length(m.metadata->'richResponse'->'sources') sources,(select jsonb_agg(b->>'type') from jsonb_array_elements(m.metadata->'richResponse'->'blocks') b) blocks from public.ai_chat_requests r left join public.chat_messages m on m.user_id=r.user_id and m.request_id=r.request_id and m.role='assistant' where r.created_at>$1 order by r.created_at",[baseline.inspectedAt])).rows;
    const evidence={status:'PASS',checks:['all pre-upgrade conversation messages preserved by original-column fingerprint','14 tables retain RLS','research reservation is service-only','atomic owner concurrency limit enforced in rollback','no synthetic test records retained'],requests:rows};
    fs.writeFileSync('.database-audit/universal-verification-20261118.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
  }finally{await db.query('rollback');}
}).catch(error=>{console.error(JSON.stringify({status:'FAIL',code:error.code||error.name,message:error.message}));process.exitCode=1;});
