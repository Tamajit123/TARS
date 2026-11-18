import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.118.0';
import {ConnectionError} from './connectionError.ts';
/** The client has no SELECT privilege on provider request internals. Expose
 * only owned status, never provider payloads, prompts or stored response text. */
export async function ownedReplyStatus(db:SupabaseClient,owner:string,conversationId:unknown,requestId:unknown){
  if(typeof conversationId!=='string'||!/^[0-9a-f-]{36}$/i.test(conversationId)||typeof requestId!=='string'||!/^[a-z0-9_-]{8,100}$/i.test(requestId))throw new ConnectionError(400,'Choose a valid saved message.');
  const {data,error}=await db.from('ai_chat_requests').select('request_id,status,error_code').eq('user_id',owner).eq('conversation_id',conversationId).eq('request_id',requestId).maybeSingle();
  if(error)throw new ConnectionError(503,'Could not recover this reply status. Try again later.');
  return {request:data?{request_id:data.request_id,status:data.status,error_code:typeof data.error_code==='string'&&/^[a-z_]{1,80}$/.test(data.error_code)?data.error_code:null,response_text:null}:null};
}
