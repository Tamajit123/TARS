type SavedMessage={role:string;content:string;request_id?:string|null;metadata?:unknown};
type SavedRequest={request_id:string;status:string;error_code:string|null;response_text:string|null};
/** Recover only the last unanswered user turn; never replay older tool turns. */
export function recoverFailedReply(conversationId:string,messages:SavedMessage[],request:SavedRequest|null){
  const last=messages.at(-1);
  if(!last||last.role!=='user'||!last.request_id||request?.request_id!==last.request_id||request.status!=='provider_failed')return null;
  const metadata=last.metadata as {attachmentIds?:unknown}|null;
  const attachmentIds=Array.isArray(metadata?.attachmentIds)?metadata.attachmentIds.filter((id):id is string=>typeof id==='string'):[];
  const notices:Record<string,string>={
    provider_unavailable:'Gemini is temporarily unavailable because of high demand. Your message and files are saved. Try again later.',
    provider_daily_quota_exhausted:'Gemini’s daily free-tier quota is used up. Your message and files are saved. Try again after the daily quota resets.',
    provider_cancelled:'Generation stopped. Your saved message can be retried.',
    provider_timeout:'Gemini took too long to respond. Your message is saved; retry safely.',
    provider_rate_limited:'Gemini’s request or token rate limit was reached. Your message is saved. Wait for the limit to reset before retrying.',
  };
  return {request:{conversationId,requestId:last.request_id,message:last.content,attachmentIds,action:'send' as const},notice:notices[request.error_code||'']||'This saved message has no completed reply. Retry safely.'};
}
