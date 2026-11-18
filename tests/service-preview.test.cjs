const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),test=require('node:test'),assert=require('node:assert/strict');
function load(name){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(`supabase/functions/_shared/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,Date,require:id=>load(id.slice(2,-3))});return exports;}
const preview=load('servicePreview'),now='2026-11-04T01:00:00Z';
test('provider previews project actual content and preserve empty results instead of inventing items',()=>{
  const jira=preview.servicePreview('jira',{issues:[]},now);assert.equal(jira.kind,'issues');assert.equal(jira.items.length,0);
  const prefs=preview.servicePreview('reddit',{language:'en',nightMode:false,access_token:'secret'},now);assert.equal(prefs.kind,'profile');assert.doesNotMatch(JSON.stringify(prefs),/secret|access_token|Votes/);
  const post=preview.servicePreview('reddit',{children:[{data:{title:'Native motion',author:'sample',subreddit:'reactnative',score:0,num_comments:2,permalink:'/r/reactnative/comments/real'}}]},now);assert.equal(post.items[0].metrics[0].value,'0');assert.match(post.items[0].url,/reddit.com\/r\//);
  const mail=preview.servicePreview('gmail',{messages:[{id:'real',payload:{headers:[{name:'Subject',value:'Design review'},{name:'From',value:'Sample Team'}]},labelIds:['UNREAD'],snippet:'Review starts at noon.'}]},now);assert.equal(mail.items[0].title,'Design review');assert.equal(mail.items[0].unread,true);assert.equal(mail.items[0].url,undefined);
});
test('preview validation rejects executable component types, wrong providers, malformed rows and off-service links',()=>{
  assert.equal(preview.readServicePreview({version:1,provider:'constructor',kind:'profile',title:'x',retrievedAt:now,items:[]}),null);
  assert.equal(preview.readServicePreview({version:1,provider:'jira',kind:'HTMLView',title:'x',retrievedAt:now,items:[]}),null);
  const result=preview.servicePreview('trello',{boards:[{name:'Actual board',url:'https://attacker.example/steal',client_secret:'secret'}]},now);assert.equal(result.items[0].url,undefined);assert.doesNotMatch(JSON.stringify(result),/secret|attacker/);
  assert.equal(preview.servicePreview('gmail',{messages:[null]},now),null);
  const event=preview.servicePreview('googlecalendar',{items:[{summary:'All-day event',start:{date:'2026-11-04'}}]},now);assert.equal(event.items[0].timestamp,'2026-11-04');
});
