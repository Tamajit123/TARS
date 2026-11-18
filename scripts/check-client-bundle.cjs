const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const values = parseEnv(fs.readFileSync('.env', 'utf8'));
const names = ['COMPOSIO_API_KEY', 'BROWSERBASE_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter(name => values[name]);
const files = [];
function visit(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) visit(file); else files.push(file);
  }
}
visit('dist');
let leaked = false;
for (const file of files) {
  const content = fs.readFileSync(file);
  if (names.some(name => content.includes(Buffer.from(values[name])))) leaked = true;
}
console.log(JSON.stringify({ status: leaked ? 'FAIL' : 'PASS', filesScanned: files.length, serverSecretNamesChecked: names, serverSecretFound: leaked }));
if (leaked) process.exitCode = 1;
