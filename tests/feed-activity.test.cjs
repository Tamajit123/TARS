const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsForTest={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/feedActivity.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsForTest});
const valid={version:1,query:'Find my assigned Jira issues',title:'Find my assigned Jira issues',summary:'No issues are assigned to you.',sources:['Jira'],status:'completed',conversationId:'8951a060-b880-4e55-80a4-6b61b390eceb',sourceUrl:null};
test('Feed accepts real empty results and preserves failed/cancelled status without raw payload fallbacks',()=>{
  const read=exportsForTest.readFeedActivity;
  assert.equal(read(valid).summary,valid.summary);
  for(const status of ['failed','cancelled'])assert.equal(read({...valid,status}).status,status);
  for(const patch of [{summary:'{"data":[]}'},{query:'[]'},{title:'REDDIT_GET_ME_PREFS'},{title:'8951a060-b880-4e55-80a4-6b61b390eceb'},{summary:'Composio log log_123'},{status:'running'},{sources:['INTERNAL_TOOL']},{summary:'x'.repeat(901)}])assert.equal(read({...valid,...patch}),null);
  assert.equal(read({action_name:'DEBUG',input_summary:'raw args'}),null);
});
