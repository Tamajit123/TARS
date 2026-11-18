// Serve the pinned module worker unchanged from our own origin. Metro cannot
// reliably preserve MapLibre's import.meta.url inside a transformed bundle.
const fs=require('node:fs'),path=require('node:path');
const root=path.dirname(require.resolve('maplibre-gl/package.json'));
const target=path.resolve('public/vendor');fs.mkdirSync(target,{recursive:true});
for(const [source,name] of [['dist/maplibre-gl-worker.mjs','maplibre-gl-worker.mjs'],['LICENSE.txt','maplibre-LICENSE.txt']]){
  const bytes=fs.readFileSync(path.join(root,source));const file=path.join(target,name);
  if(!fs.existsSync(file)||!bytes.equals(fs.readFileSync(file)))fs.writeFileSync(file,bytes);
}
