const fs=require('node:fs');const path=require('node:path');
const env=require('node:util').parseEnv(fs.readFileSync('.env','utf8'));
const names=['COMPOSIO_API_KEY','BROWSERBASE_API_KEY','OPENAI_API_KEY','GEMINI_API_KEY','SUPABASE_SERVICE_ROLE_KEY'];
const known=names.filter(name=>env[name]&&env[name].length>=8);
const root=process.argv[2]||'.database-audit/tars-2-web';
let files=0,leaks=0;
function scan(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())scan(file);else if(/\.(js|hbc|html|json|map)$/.test(file)){files++;const body=fs.readFileSync(file);for(const name of known)if(body.includes(Buffer.from(env[name],'utf8')))leaks++;}}}
scan(root);console.log(JSON.stringify({status:leaks?'FAIL':'PASS',filesScanned:files,knownServerCredentialsChecked:known.length,credentialMatches:leaks}));if(leaks)process.exitCode=1;
