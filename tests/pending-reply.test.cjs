const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exports_={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/pendingReply.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exports_});
const recover=exports_.recoverFailedReply;
test('reopening a failed reply restores the same request and attachment IDs without creating another message',()=>{
  const messages=[{role:'user',content:'Synthetic read-only check',request_id:'same-request',metadata:{attachmentIds:['file-id']}}];
  const result=recover('owned-thread',messages,{request_id:'same-request',status:'provider_failed',error_code:'provider_unavailable',response_text:null});
  assert.equal(result.request.requestId,'same-request');assert.equal(result.request.attachmentIds[0],'file-id');assert.match(result.notice,/high demand/);assert.equal(messages.length,1);
});
test('completed, mismatched and older failed turns are never offered as replayable requests',()=>{
  const user={role:'user',content:'Check',request_id:'one'};
  for(const [messages,request] of [
    [[user],{request_id:'two',status:'provider_failed'}],
    [[user],{request_id:'one',status:'completed'}],
    [[user,{role:'assistant',content:'Saved answer'}],{request_id:'one',status:'provider_failed'}],
  ])assert.equal(recover('thread',messages,request),null);
});
