// Exercise the actual TARS browser reader with Node runtime shims.
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const dns = require('node:dns/promises');
const env = require('node:util').parseEnv(fs.readFileSync('.env','utf8'));
function load(name){const exports={};const source=ts.transpileModule(fs.readFileSync(`supabase/functions/_shared/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(source,{exports,require:id=>load(id.slice(2,-3)),URL,AbortSignal,WebSocket,setTimeout,clearTimeout,fetch,Deno:{env:{get:name=>env[name]},resolveDns:host=>dns.resolve4(host)}});return exports;}
const exports_=load('browser');
(async()=>{
  const start=Date.now();const page=await exports_.searchPublicWeb('Browserbase documentation live view');
  if (page.text.length < 300 || page.links.length === 0) throw new Error('No usable search results were verified.');
  fs.writeFileSync('.database-audit/browser-search-public-content.json',JSON.stringify({title:page.title,text:page.text,links:page.links},null,2));
  const result={status:'PASS',title:page.title,url:page.url,characters:page.text.length,links:page.links.length,durationMs:Date.now()-start};
  fs.writeFileSync('.database-audit/browser-search-result.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
})().catch(error=>{console.error(JSON.stringify({status:'FAIL',reason:error.reason||error.name,message:error.message}));process.exitCode=1;});
