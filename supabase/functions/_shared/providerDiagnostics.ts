type Data=Record<string,any>;
const clean=(text:unknown,key:string)=>typeof text==='string'?(key?text.split(key).join('[redacted]'):text).replace(/(?:AIza[\w-]+|sk-[\w-]+|Bearer\s+\S+)/g,'[redacted]').replace(/projects\/\d+/g,'projects/[redacted]').slice(0,600):null;
/** Scheduler-authenticated diagnostics only. Never return prompts, credentials,
 * response content or complete provider payloads to the mobile application. */
export async function diagnoseProviders(selected?:string){
  const model=Deno.env.get('AI_MODEL')||Deno.env.get('GEMINI_MODEL')||'gemini-3.5-flash-lite';
  const key=Deno.env.get('GEMINI_API_KEY');
  const deadline=Date.now()+105000;
  const run=async(name:string,url:string,headers:Record<string,string>,body?:Data,secret='')=>{
    const start=Date.now();let httpStatus:number|null=null;try{
      const response=await fetch(url,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(Math.max(1000,Math.min(selected?90000:name==='text'?60000:30000,deadline-Date.now())))});
      httpStatus=response.status;
      const raw=await response.text();let data:Data={};try{data=JSON.parse(raw);}catch{}
      const frames=name==='stream'?raw.split('\n').filter(line=>line.startsWith('data:')).flatMap(line=>{try{return [JSON.parse(line.slice(5))];}catch{return [];}}):[data];
      const candidates=frames.flatMap(frame=>frame.candidates||[]),parts=candidates.flatMap(c=>c.content?.parts||[]),text=parts.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('');
      const contentValid=name==='models'?undefined:name==='text'?/OK/i.test(text):name==='multi_turn'?text.includes('CEDAR-931'):name==='structured'?(()=>{try{return JSON.parse(text).ok===true;}catch{return false;}})():name==='function_call'?parts.some(p=>p.functionCall?.name==='diagnostic_echo'&&p.functionCall?.args?.message==='test'):name==='long'?text.length>=600:name==='stream'?text.length>0&&frames.length>0:undefined;
      return {name,httpStatus:response.status,durationMs:Date.now()-start,code:clean(data.error?.status||data.error?.code,secret),message:clean(data.error?.message,secret),candidates:candidates.length,finishReason:candidates.findLast(c=>c.finishReason)?.finishReason||null,textParts:parts.filter(p=>typeof p.text==='string').length||0,streamChunks:name==='stream'?frames.length:0,contentValid,modelAvailable:Array.isArray(data.models)?data.models.some((m:Data)=>m.name===`models/${model}`):undefined,models:Array.isArray(data.models)?data.models.filter((m:Data)=>m.supportedGenerationMethods?.includes('generateContent')).map((m:Data)=>({name:m.name,inputTokenLimit:m.inputTokenLimit,outputTokenLimit:m.outputTokenLimit})).slice(0,60):undefined};
    }catch{return {name,httpStatus,durationMs:Date.now()-start,code:httpStatus===null?'provider_connection_timeout':'provider_body_timeout',message:httpStatus===null?'No provider HTTP headers were received before the diagnostic deadline.':'Provider headers arrived, but its response body did not finish before the deadline.'};}
  };
  const gemini:Data[]=[];
  if(key&&/^[a-z0-9._-]+$/i.test(model)){
    const headers={'Content-Type':'application/json','x-goog-api-key':key};
    gemini.push(await run('models','https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',headers,undefined,key));
    const base={contents:[{role:'user',parts:[{text:'Reply with OK.'}]}],generationConfig:{maxOutputTokens:256}};
    const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`;
    if(!selected||selected==='text')gemini.push(await run('text',endpoint+':generateContent',headers,base,key));
    if(!selected||selected==='stream')gemini.push(await run('stream',endpoint+':streamGenerateContent?alt=sse',headers,base,key));
    if(selected==='long')gemini.push(await run('long',endpoint+':generateContent',headers,{...base,contents:[{role:'user',parts:[{text:'Explain how to plan a productive week in eight detailed paragraphs.'}]}],generationConfig:{maxOutputTokens:4096,thinkingConfig:model.startsWith('gemini-2.5')?{thinkingBudget:0}:{thinkingLevel:'low'}}},key));
    if(selected||gemini[1]?.httpStatus===200){
      if(!selected||selected==='multi_turn')
      gemini.push(await run('multi_turn',endpoint+':generateContent',headers,{...base,contents:[{role:'user',parts:[{text:'Remember code CEDAR-931.'}]},{role:'model',parts:[{text:'I will remember CEDAR-931.'}]},{role:'user',parts:[{text:'What is the code?'}]}]},key));
      if(!selected||selected==='structured')
      gemini.push(await run('structured',endpoint+':generateContent',headers,{...base,contents:[{role:'user',parts:[{text:'Return {"ok":true}.'}]}],generationConfig:{...base.generationConfig,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{ok:{type:'BOOLEAN'}},required:['ok']}}},key));
      if(!selected||selected==='function_call')
      gemini.push(await run('function_call',endpoint+':generateContent',headers,{...base,contents:[{role:'user',parts:[{text:'Call diagnostic_echo with message test.'}]}],tools:[{functionDeclarations:[{name:'diagnostic_echo',parameters:{type:'OBJECT',properties:{message:{type:'STRING'}},required:['message']}}]}],toolConfig:{functionCallingConfig:{mode:'ANY'}}},key));
    }
  }
  const openaiKey=Deno.env.get('OPENAI_API_KEY'),openaiModel=Deno.env.get('OPENAI_MODEL');
  const openai=openaiKey?await run('openai_models','https://api.openai.com/v1/models',{Authorization:`Bearer ${openaiKey}`},undefined,openaiKey):{name:'openai_models',code:'not_configured'};
  return {model,geminiConfigured:Boolean(key),gemini,openai,openaiModelConfigured:Boolean(openaiModel),freeTier:'Account limits/billing must be verified in AI Studio; model listing alone does not establish the account tier.'};
}
