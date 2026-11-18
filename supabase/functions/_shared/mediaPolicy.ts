export const MAX_ATTACHMENT_BYTES=10*1024*1024;
export const MAX_TURN_ATTACHMENT_BYTES=20*1024*1024;
export const MAX_ATTACHMENTS=4;
export const mediaTypes:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf',txt:'text/plain',csv:'text/csv',json:'application/json',m4a:'audio/mp4',mp3:'audio/mpeg',wav:'audio/wav',webm:'audio/webm',ogg:'audio/ogg',doc:'application/msword',xls:'application/vnd.ms-excel',ppt:'application/vnd.ms-powerpoint',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
export type AttachmentRef={id:string;name:string;mime_type:string;size_bytes:number;object_path:string;duration_ms?:number|null};
export function validateAttachment(name:string,size:number,mime?:string){
  const extension=name.split('.').at(-1)?.toLowerCase()||'';
  const expected=mediaTypes[extension];
  if(!expected)throw new Error('Choose a supported image, audio, PDF, text or Office document.');
  if(!Number.isInteger(size)||size<1||size>MAX_ATTACHMENT_BYTES)throw new Error('Each attachment must be between 1 byte and 10 MB.');
  if(name.length>180||/[\x00-\x1f/\\]/.test(name))throw new Error('Use a filename under 180 characters without path separators.');
  if(mime&&mime!=='application/octet-stream'&&mime.split(';')[0]!==expected&&!(extension==='m4a'&&mime==='audio/m4a'))throw new Error('The file type does not match its extension.');
  return expected;
}
export function attachmentIds(value:unknown):string[]{
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>MAX_ATTACHMENTS||new Set(value).size!==value.length||value.some(id=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)))throw new Error('Attach up to four distinct files.');
  return value as string[];
}
