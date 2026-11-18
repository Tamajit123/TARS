// The SDK 58 development static-renderer cache can lose route module IDs
// after rebuilding. Use the supported SPA shell for Metro development only;
// production exports retain app.json's static output and every native option.
const {spawn}=require('node:child_process');
require('./prepare-map-worker.cjs');
const cli=require.resolve('expo/bin/cli');
const child=spawn(process.execPath,[cli,'start',...process.argv.slice(2)],{
  stdio:'inherit',env:{...process.env,TARS_DEV_WEB_SPA:'1'},
});
child.on('error',error=>{console.error('Expo could not start:',error.message);process.exitCode=1;});
child.on('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
