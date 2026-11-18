import {ProviderError} from './providerError.ts';
import type {ModelTurnRequest,ModelTurnResult} from './providerTransport.ts';
type Data=Record<string,any>;
function jsonSchema(value:Data):Data{return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='type'&&typeof item==='string'?item.toLowerCase():Array.isArray(item)?item.map(v=>v&&typeof v==='object'?jsonSchema(v):v):item&&typeof item==='object'?jsonSchema(item):item]));}
export function openaiMessages(items:Data[]){return items.map(item=>{
  if(item.openaiMessage)return item.openaiMessage;
  if(item.type==='function_call_output')return {role:'tool',tool_call_id:item.call_id,content:item.output};
  if(item.geminiContent)throw new ProviderError('provider_configuration_error');
  if(item.parts){const content=item.parts.map((part:Data)=>{
    if(typeof part.text==='string')return {type:'text',text:part.text};
    if(part.inlineData&&/^image\/(jpeg|png|webp|gif)$/.test(part.inlineData.mimeType))return {type:'image_url',image_url:{url:`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}};
    throw new ProviderError('provider_media_unsupported');
  });return {role:item.role,content};}
  return {role:item.role,content:item.content};
});}
/** Optional explicit adapter. Never selected on Gemini failure or without config. */
export async function requestOpenAITurn(request:ModelTurnRequest,model:string):Promise<ModelTurnResult>{
  const key=Deno.env.get('OPENAI_API_KEY');if(!key)throw new ProviderError('provider_not_configured');
  const tools=request.tools?.map(tool=>({type:'function',function:{name:tool.name,description:tool.description,parameters:jsonSchema(tool.parameters||tool.parametersJsonSchema)}}));
  const body=JSON.stringify({model,store:false,messages:[{role:'system',content:request.system},...openaiMessages(request.contents)],max_completion_tokens:4096,stream:Boolean(request.onEvent),...(tools?.length?{tools,tool_choice:request.allowTools===false||request.toolMode==='NONE'?'none':request.toolMode==='ANY'?'required':'auto'}:{})});
  const deadline=request.deadline||Date.now()+105000;
  for(let attempt=0;attempt<2;attempt++){
    if(request.signal?.aborted)throw new ProviderError('provider_cancelled');
    const remaining=deadline-Date.now();if(remaining<1000)throw new ProviderError('provider_timeout');
    const timeout=AbortSignal.timeout(Math.min(90000,remaining));let response:Response;
    try{response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body,signal:request.signal?AbortSignal.any([request.signal,timeout]):timeout});}catch{throw new ProviderError(request.signal?.aborted?'provider_cancelled':timeout.aborted?'provider_timeout':'provider_unreachable');}
    if(!response.ok){const data=await response.json().catch(()=>null);if([500,502,503,504].includes(response.status)&&attempt===0&&deadline-Date.now()>5000){await new Promise(resolve=>setTimeout(resolve,1000));continue;}throw new ProviderError(response.status===429?(data?.error?.code==='insufficient_quota'?'provider_daily_quota_exhausted':'provider_rate_limited'):[400,401,403].includes(response.status)?'provider_configuration_error':response.status===404?'provider_model_unavailable':'provider_error',{httpStatus:response.status});}
    const result=request.onEvent?await collectOpenAIStream(response,delta=>request.onEvent?.({type:'text.delta',delta})):await response.json();
    const choice=result.choices?.[0],message=choice?.message;
    if(choice?.finish_reason==='content_filter')throw new ProviderError('provider_safety_blocked');
    if(!message||choice.finish_reason==='length')throw new ProviderError('malformed_provider_response');
    const text=typeof message.content==='string'?message.content:'';
    const calls=(message.tool_calls||[]).map((call:Data)=>{let args;try{args=JSON.parse(call.function.arguments);}catch{throw new ProviderError('malformed_provider_response');}return {id:call.id,name:call.function.name,args};});
    if(!text.trim()&&!calls.length)throw new ProviderError('empty_provider_response');if(text.length>100000||calls.length>8)throw new ProviderError('malformed_provider_response');
    return {text:text.slice(0,20000),content:[{openaiMessage:message}],calls,finishReason:choice.finish_reason};
  }
  throw new ProviderError('provider_error');
}
export async function collectOpenAIStream(response:Response,onDelta:(delta:string)=>void){
  if(!response.body)throw new ProviderError('malformed_provider_response');const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',text='',finish:string|null=null,doneMarker=false;const calls:Data[]=[];
  const consume=(frame:string)=>{for(const line of frame.split('\n')){if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(raw==='[DONE]'){doneMarker=true;continue;}let chunk;try{chunk=JSON.parse(raw);}catch{throw new ProviderError('malformed_provider_response');}if(chunk.error)throw new ProviderError('provider_error');const choice=chunk.choices?.[0];if(choice?.finish_reason)finish=choice.finish_reason;const delta=choice?.delta;if(typeof delta?.content==='string'){text+=delta.content;onDelta(delta.content);}for(const call of delta?.tool_calls||[]){if(!Number.isInteger(call.index)||call.index<0||call.index>7)throw new ProviderError('malformed_provider_response');const saved=calls[call.index]||={id:'',type:'function',function:{name:'',arguments:''}};if(call.id)saved.id=call.id;if(call.function?.name)saved.function.name+=call.function.name;if(call.function?.arguments)saved.function.arguments+=call.function.arguments;}}if(text.length+JSON.stringify(calls).length>200000)throw new ProviderError('malformed_provider_response');};
  try{while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done}).replace(/\r\n/g,'\n');if(buffer.length>1000000)throw new ProviderError('malformed_provider_response');let end;while((end=buffer.indexOf('\n\n'))!==-1){consume(buffer.slice(0,end));buffer=buffer.slice(end+2);}if(done)break;}if(buffer.trim())consume(buffer);}finally{reader.releaseLock();}
  if(!finish||!doneMarker)throw new ProviderError('provider_stream_interrupted');return {choices:[{message:{role:'assistant',content:text,...(calls.length?{tool_calls:calls}:{})},finish_reason:finish}]};
}
