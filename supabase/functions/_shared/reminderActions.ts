import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.118.0';
import {validateReminder,type ReminderDraft} from './reminderPlan.ts';
import {ConnectionError} from './connections.ts';
export const reminderTool={name:'prepare_reminder',description:'Prepare a device reminder for user review. Use an explicit ISO timestamp with timezone offset; clarify missing dates or timezone. This does not schedule a phone notification. The user must confirm and allow notifications in TARS.',parameters:{type:'OBJECT',properties:{title:{type:'STRING'},dueAt:{type:'STRING'},repeat:{type:'STRING',enum:['once','daily','weekly']},timezone:{type:'STRING'},sound:{type:'BOOLEAN'}},required:['title','dueAt','repeat','timezone','sound']}};
export async function prepareReminder(db:SupabaseClient,userId:string,args:ReminderDraft,conversationId?:string,requestId?:string){
  if(!conversationId||!requestId)throw new ConnectionError(400,'Reminders need an interactive conversation.');
  const draft=validateReminder(args);
  const thread=await db.from('chat_threads').select('id').eq('id',conversationId).eq('user_id',userId).maybeSingle();if(!thread.data)throw new ConnectionError(404,'Conversation unavailable.');
  const result=await db.from('pending_tool_actions').upsert({user_id:userId,conversation_id:conversationId,request_id:requestId,tool_slug:'TARS_CREATE_REMINDER',toolkit:'tars',arguments:draft,input_schema:{},summary:`Remind me: ${draft.title}`},{onConflict:'user_id,conversation_id,request_id,tool_slug',ignoreDuplicates:true});if(result.error)throw new ConnectionError(500,'The reminder review could not save.');
  return {ok:false,requiresConfirmation:true,message:'Reminder prepared for review only. The user must press Confirm in TARS. Device notification permission and OS acceptance are required before claiming it is scheduled.'};
}
export async function confirmReminder(db:SupabaseClient,userId:string,action:Record<string,any>){
  const existing=await db.from('task_reminders').select('id').eq('id',action.id).eq('user_id',userId).maybeSingle();
  if(!existing.data){
    if(action.status!=='pending')throw new ConnectionError(409,'This reminder is already being confirmed. Refresh its status.');
    const draft=validateReminder(action.arguments);
    const claim=await db.from('pending_tool_actions').update({status:'executing',updated_at:new Date().toISOString()}).eq('id',action.id).eq('user_id',userId).eq('status','pending').select('id').maybeSingle();if(claim.error||!claim.data)throw new ConnectionError(409,'This reminder changed. Refresh before confirming.');
    const saved=await db.from('task_reminders').upsert({id:action.id,user_id:userId,title:draft.title,due_at:draft.dueAt,repeat:draft.repeat,timezone:draft.timezone,sound:draft.sound},{onConflict:'id',ignoreDuplicates:true});if(saved.error){await db.from('pending_tool_actions').update({status:'failed'}).eq('id',action.id).eq('user_id',userId);throw new ConnectionError(500,'The reminder could not save. No phone notification was scheduled.');}
  }
  const result={reminderId:action.id,message:'Saved in your TARS account. The app must verify permission and schedule the device notification separately.'};
  const finished=await db.from('pending_tool_actions').update({status:'completed',result,updated_at:new Date().toISOString()}).eq('id',action.id).eq('user_id',userId);if(finished.error)throw new ConnectionError(503,'The reminder was saved but its confirmation needs recovery. Refresh and confirm again.');
  return {ok:true,status:'completed',result};
}
