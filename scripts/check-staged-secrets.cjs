const {execFileSync}=require('node:child_process'),fs=require('node:fs');
const local=fs.existsSync('.env')?require('node:util').parseEnv(fs.readFileSync('.env','utf8')):{};
const known=Object.entries(local).filter(([name,value])=>!name.startsWith('EXPO_PUBLIC_')&&/KEY|TOKEN|SECRET|PASSWORD/.test(name)&&value.length>=10).map(([,value])=>value);
const files=execFileSync('git',['diff','--cached','--name-only','--diff-filter=ACMR','-z']).toString().split('\0').filter(Boolean);const failures=[];
for(const file of files){
  if(/(^|\/)(\.env(?:\.|$)|credentials\.json$)|\.(?:pem|key|p12|p8|keystore)$/i.test(file)&&!file.endsWith('.env.example')){failures.push({file,reason:'credential file'});continue;}
  const bytes=execFileSync('git',['show',`:${file}`],{maxBuffer:32*1024*1024});const text=bytes.toString('utf8');
  if(known.some(secret=>bytes.includes(Buffer.from(secret)))||/\b(?:AIza[\w-]{30,}|sk-(?:proj-)?[\w-]{20,}|ck_[\w-]{20,})\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))failures.push({file,reason:'credential pattern or known server secret'});
}
console.log(JSON.stringify({status:failures.length?'FAIL':'PASS',filesScanned:files.length,knownServerSecretsChecked:known.length,failures}));if(failures.length)process.exitCode=1;
