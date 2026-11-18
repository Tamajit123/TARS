export type DayWindow={date:string;timezone:string;startSeconds:number;endSeconds:number};
/** Find calendar-day boundaries in the supplied timezone, including 23/25-hour
 * DST days. No model arithmetic or assumption that a local day starts in UTC. */
export function localDayWindow(timezone:string,date?:string,now=Date.now()):DayWindow{
  const format=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'});
  const dayAt=(seconds:number)=>{const parts=format.formatToParts(new Date(seconds*1000));return ['year','month','day'].map(key=>parts.find(part=>part.type===key)!.value).join('-');};
  const day=date||dayAt(Math.floor(now/1000)),utc=Date.parse(day+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(utc)||new Date(utc).toISOString().slice(0,10)!==day)throw new Error('Invalid calendar date.');
  const boundary=(label:string)=>{const centre=Date.parse(label+'T00:00:00Z')/1000;let low=centre-36*3600,high=centre+36*3600;while(low<high){const middle=Math.floor((low+high)/2);if(dayAt(middle)<label)low=middle+1;else high=middle;}return low;};
  const startSeconds=boundary(day);if(dayAt(startSeconds)!==day)throw new Error('This local calendar date does not exist.');
  return {date:day,timezone,startSeconds,endSeconds:boundary(new Date(utc+86400000).toISOString().slice(0,10))};
}
export function gmailDayQuery(query:string,window:DayWindow){
  const tokens:string[]=[];let current='',quoted=false,escaped=false;
  for(const char of query){if(char==='"'&&!escaped)quoted=!quoted;if(/\s/.test(char)&&!quoted){if(current)tokens.push(current);current='';}else current+=char;escaped=char==='\\'&&!escaped;}
  if(current)tokens.push(current);
  return [...tokens.filter(token=>!/^(after|before|newer_than|older_than):/i.test(token)),`after:${window.startSeconds-1}`,`before:${window.endSeconds}`].join(' ');
}
export function filterEmailDay(data:Record<string,any>,window:DayWindow){
  if(!Array.isArray(data.messages))return data;
  let omitted=0,unknown=0;
  const timestamp=(row:Record<string,any>)=>{const headers=row.payload?.headers||row.headers||[];const header=Array.isArray(headers)?headers.find((item:Record<string,any>)=>String(item.name).toLowerCase()==='date')?.value:undefined;const epoch=Number(row.internalDate);return Number.isFinite(epoch)&&epoch>0?epoch:Date.parse(row.date||header||'');};
  const messages=data.messages.filter((row:Record<string,any>)=>{const time=timestamp(row);if(!Number.isFinite(time)){unknown++;return false;}const keep=time>=window.startSeconds*1000&&time<window.endSeconds*1000;if(!keep)omitted++;return keep;}).sort((a:Record<string,any>,b:Record<string,any>)=>timestamp(b)-timestamp(a));
  return {...data,messages,verifiedDateWindow:window,...(omitted?{omittedOutsideWindow:omitted}:{}),...(unknown?{unverifiedDateCount:unknown,dateFilterWarning:'Some returned timestamps could not be verified; do not claim the entire date range was empty.'}:{})};
}
