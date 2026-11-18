const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsPolicy={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/keyboardViewport.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsPolicy});
const {keyboardViewport}=exportsPolicy;
test('mobile visual keyboard bounds exclude obscured space and restore on dismissal',()=>{
  for(const [full,visible,offset] of [[844,460,0],[667,340,20],[568,270,0],[390,220,0]]){const state=keyboardViewport(full,visible,offset,1,true);assert.equal(state.open,true);assert.equal(state.bottom,visible+offset);}
  assert.equal(keyboardViewport(844,844,0,1,true).open,false);assert.equal(keyboardViewport(844,460,0,1,false).open,false);
});
test('pinch zoom, browser toolbar changes and invalid viewport metrics are not mistaken for keyboards',()=>{
  assert.equal(keyboardViewport(844,400,0,2,true).open,false);assert.equal(keyboardViewport(844,800,0,1,true).open,false);assert.equal(keyboardViewport(844,NaN,0,1,true).open,false);
});
