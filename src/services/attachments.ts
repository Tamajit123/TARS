import {supabase} from '@/lib/supabase';
import * as Crypto from 'expo-crypto';
import {File} from 'expo-file-system';
import {Platform} from 'react-native';
import {validateAttachment,type AttachmentRef} from '../../supabase/functions/_shared/mediaPolicy';
export type AttachmentDraft={id:string;name:string;uri:string;mime:string;size:number;blob?:Blob;durationMs?:number;status:'ready'|'uploading'|'uploaded'|'failed';progress:number;error?:string;ref?:AttachmentRef};
export async function makeAttachment(source:{name:string;uri:string;mime?:string;size?:number;blob?:Blob;durationMs?:number}):Promise<AttachmentDraft>{
  const size=source.size??source.blob?.size??(Platform.OS==='web'?(await fetch(source.uri).then(r=>r.blob())).size:new File(source.uri).size);
  const mime=validateAttachment(source.name,size,source.mime);
  return {...source,id:Crypto.randomUUID(),size,mime,status:'ready',progress:0};
}
export async function uploadAttachment(draft:AttachmentDraft,threadId:string,signal:AbortSignal,onProgress:(n:number)=>void):Promise<AttachmentRef>{
  const {data:{user}}=await supabase.auth.getUser(); if(!user)throw new Error('Sign in before uploading attachments.');
  const ref:AttachmentRef={id:draft.id,name:draft.name,mime_type:draft.mime,size_bytes:draft.size,object_path:`${user.id}/${threadId}/${draft.id}`,duration_ms:draft.durationMs??null};
  const existing=await supabase.from('chat_attachments').select('*').eq('id',draft.id).maybeSingle();
  if(existing.error)throw new Error('The attachment could not be prepared. Retry uploading.');
  if(!existing.data){const {error}=await supabase.from('chat_attachments').insert({...ref,user_id:user.id,thread_id:threadId});if(error)throw new Error('The attachment record could not be saved. Retry uploading.');}
  const info=await supabase.storage.from('tars-chat').info(ref.object_path);
  if(!info.error&&info.data?.size===draft.size){onProgress(1);return ref;}
  if(signal.aborted)throw new Error('Upload cancelled.');
  const bytes=draft.blob?await draft.blob.arrayBuffer():Platform.OS==='web'?await fetch(draft.uri,{signal}).then(r=>r.arrayBuffer()):await new File(draft.uri).arrayBuffer();
  if(bytes.byteLength!==draft.size)throw new Error('The file changed. Remove it and select it again.');
  const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Your session expired. Sign in and retry.');
  await new Promise<void>((resolve,reject)=>{
    const xhr=new XMLHttpRequest(); const abort=()=>xhr.abort();
    const finish=(error?:Error)=>{signal.removeEventListener('abort',abort);if(error)reject(error);else resolve();};
    xhr.open('POST',`${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/tars-chat/${ref.object_path}`);
    xhr.setRequestHeader('Authorization',`Bearer ${session.access_token}`);xhr.setRequestHeader('apikey',process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY||'');xhr.setRequestHeader('Content-Type',draft.mime);xhr.timeout=90000;
    xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(event.loaded/event.total);};
    xhr.onload=()=>finish(xhr.status>=200&&xhr.status<300?undefined:new Error('Upload was not confirmed. Retry this attachment.'));
    xhr.onerror=()=>finish(new Error('Upload interrupted. Retry this attachment.'));xhr.ontimeout=()=>finish(new Error('Upload timed out. Retry this attachment.'));xhr.onabort=()=>finish(new Error('Upload cancelled.'));
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();finish(new Error('Upload cancelled.'));return;}xhr.send(bytes);
  });
  const verified=await supabase.storage.from('tars-chat').info(ref.object_path);
  if(verified.error||verified.data?.size!==draft.size)throw new Error('The upload could not be verified. Retry before sending.');
  return ref;
}
export async function discardAttachment(draft:AttachmentDraft){
  const row=await supabase.from('chat_attachments').select('object_path,message_id').eq('id',draft.id).maybeSingle();
  if(row.error)throw new Error('The draft attachment could not be checked. Retry removing it.');
  if(row.data?.message_id)return;
  if(row.data){const removed=await supabase.storage.from('tars-chat').remove([row.data.object_path]);if(removed.error)throw new Error('The draft upload could not be removed. Retry.');const deleted=await supabase.from('chat_attachments').delete().eq('id',draft.id).is('message_id',null);if(deleted.error)throw new Error('The draft record could not be removed.');}
}
export async function attachmentUrl(ref:AttachmentRef){const {data,error}=await supabase.storage.from('tars-chat').createSignedUrl(ref.object_path,300);if(error||!data?.signedUrl)throw new Error('This attachment could not open.');return data.signedUrl;}
