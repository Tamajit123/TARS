export type ReminderDraft={title:string;dueAt:string;repeat:'once'|'daily'|'weekly';timezone:string;sound:boolean};
export function validateReminder(draft:ReminderDraft,now=Date.now()){
  if(!draft||typeof draft.title!=='string'||!draft.title.trim()||draft.title.trim().length>160)throw new Error('Add a reminder title under 160 characters.');
  const date=Date.parse(draft.dueAt);
  if(typeof draft.dueAt!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(draft.dueAt))throw new Error('Include an explicit timezone offset in the reminder time.');
  if(!Number.isFinite(date)||date<now+5000||date>now+366*86400000)throw new Error('Choose a reminder time at least 5 seconds ahead and within one year.');
  if(!['once','daily','weekly'].includes(draft.repeat)||typeof draft.sound!=='boolean')throw new Error('Choose a valid repeat and sound setting.');
  try{new Intl.DateTimeFormat('en',{timeZone:draft.timezone}).format();}catch{throw new Error('Choose a valid timezone.');}
  return {...draft,title:draft.title.trim(),dueAt:new Date(date).toISOString()};
}
export function reminderClock(dueAt:string,timezone:string){const p=new Intl.DateTimeFormat('en-US',{timeZone:timezone,hourCycle:'h23',hour:'2-digit',minute:'2-digit',weekday:'short'}).formatToParts(new Date(dueAt));const get=(key:string)=>p.find(x=>x.type===key)?.value||'';return {hour:Number(get('hour')),minute:Number(get('minute')),weekday:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday'))+1};}
