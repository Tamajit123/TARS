const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),test=require('node:test'),assert=require('node:assert/strict');
test('provider artwork retains rendering data while removing invalid editor DOM props',()=>{
  const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/providerSvg.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});
  const raw='<svg xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:version="1" sodipodi:docname="logo.svg" viewBox="0 0 10 10"><path fill="#123456" d="M0 0h10v10z"/></svg>';
  const clean=exports.providerSvg(raw);assert.doesNotMatch(clean,/inkscape|sodipodi|xmlns:svg/);assert.match(clean,/viewBox="0 0 10 10"/);assert.match(clean,/<path fill="#123456" d="M0 0h10v10z"\/>/);
});
