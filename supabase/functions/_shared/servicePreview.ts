import {publicSourceUrl} from './execution.ts';

export type PreviewKind='mail'|'labels'|'discussion'|'messages'|'issues'|'boards'|'cards'|'pages'|'events'|'calendars'|'profile';
export type PreviewItem={title:string;subtitle?:string;body?:string;url?:string;timestamp?:string;unread?:boolean;hasAttachments?:boolean;labels?:string[];metrics?:{label:string;value:string}[]};
export type ServicePreview={version:1;provider:string;kind:PreviewKind;title:string;retrievedAt:string;items:PreviewItem[]};
type Data=Record<string,any>;
const kinds:Record<string,PreviewKind[]>={gmail:['mail','labels'],reddit:['discussion','profile'],twitter:['profile'],github:['profile'],instagram:['profile'],slack:['messages'],jira:['issues'],trello:['boards','cards'],notion:['pages'],googlecalendar:['events','calendars']};
const hosts:Record<string,string[]>={gmail:['mail.google.com'],reddit:['reddit.com','redd.it'],twitter:['x.com','twitter.com'],github:['github.com'],instagram:['instagram.com'],slack:['slack.com'],jira:['atlassian.net'],trello:['trello.com'],notion:['notion.so','notion.site'],googlecalendar:['calendar.google.com']};
const text=(v:unknown,max=600)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max):'';
const date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v))?(/^\d{4}-\d{2}-\d{2}$/.test(v)?v:new Date(v).toISOString()):undefined;
const metrics=(values:Record<string,unknown>)=>Object.entries(values).flatMap(([label,value])=>typeof value==='number'&&Number.isFinite(value)?[{label,value:String(value)}]:[]);
function source(provider:string,value:unknown){
  const url=publicSourceUrl(typeof value==='string'?value:undefined);
  return url&&hosts[provider]?.some(host=>url.hostname===host||url.hostname.endsWith('.'+host))?url.href:undefined;
}
function header(item:Data,name:string){return Array.isArray(item.payload?.headers)?item.payload.headers.find((h:Data)=>h?.name?.toLowerCase()===name)?.value:undefined;}
function notionTitle(item:Data){
  if(typeof item.title==='string')return item.title;
  const parts=Array.isArray(item.title)?item.title:Object.values(item.properties||{}).flatMap((p:any)=>p?.type==='title'&&Array.isArray(p.title)?p.title:[]);
  return parts.map((p:Data)=>p.plain_text||p.text?.content||'').join('');
}

/** Project only reviewed display fields from a confirmed provider result. */
export function servicePreview(provider:string,input:unknown,retrievedAt:string):ServicePreview|null{
  try{return projectServicePreview(provider,input,retrievedAt);}catch{return null;}
}
function projectServicePreview(provider:string,input:unknown,retrievedAt:string):ServicePreview|null{
  if(!Object.hasOwn(kinds,provider)||!input||typeof input!=='object'||(input as Data).truncated)return null;
  const data=input as Data;
  let kind:PreviewKind='profile',title='',items:PreviewItem[]=[];
  if(provider==='gmail'&&Array.isArray(data.labels)){
    kind='labels';title='Gmail labels';items=data.labels.map((r:Data)=>({title:text(r.name),subtitle:text(r.type)}));
  }else if(provider==='gmail'){
    const rows=Array.isArray(data.messages)?data.messages:data.id&&(data.payload||data.subject)?[data]:null;
    if(!rows)return null;kind='mail';title='Gmail';
    items=rows.map((r:Data)=>({title:text(r.subject||header(r,'subject'))||'Message details not retrieved',subtitle:text(r.sender||r.from||header(r,'from')),body:text(r.snippet||r.preview),timestamp:date(r.date||header(r,'date')),unread:Array.isArray(r.labelIds)?r.labelIds.includes('UNREAD'):undefined,hasAttachments:typeof r.hasAttachments==='boolean'?r.hasAttachments:undefined,url:source(provider,r.webUrl||r.url)}));
  }else if(provider==='reddit'&&typeof data.language==='string'){
    title='Reddit preferences';items=[{title:`Language: ${text(data.language,40)}`,subtitle:typeof data.nightMode==='boolean'?`Night mode ${data.nightMode?'on':'off'}`:undefined}];
  }else if(provider==='reddit'){
    const rows=Array.isArray(data.posts)?data.posts:Array.isArray(data.children)?data.children.map((r:Data)=>r.data):Array.isArray(data.data?.children)?data.data.children.map((r:Data)=>r.data):data.title||data.body?[data]:null;
    if(!rows)return null;kind='discussion';title='Reddit discussion';
    items=rows.filter(Boolean).map((r:Data)=>({title:text(r.title)||'Comment',subtitle:[r.subreddit?`r/${text(r.subreddit,80)}`:'',r.author?`u/${text(r.author,80)}`:''].filter(Boolean).join(' · '),body:text(r.selftext||r.body),url:source(provider,r.url)||source(provider,typeof r.permalink==='string'&&r.permalink.startsWith('/r/')?`https://www.reddit.com${r.permalink}`:undefined),metrics:metrics({Votes:r.score,Comments:r.num_comments})}));
  }else if(provider==='twitter'||provider==='instagram'||provider==='github'){
    const username=text(data.username||data.login,100);if(!username)return null;
    title=provider==='twitter'?'X profile':provider==='github'?'GitHub profile':'Instagram profile';
    items=[{title:`@${username}`,subtitle:text(data.name),body:text(data.bio||data.description),url:source(provider,data.url||data.html_url),metrics:metrics({'Public repositories':data.publicRepositories})}];
  }else if(provider==='trello'){
    const rows=Array.isArray(data.boards)?data.boards:Array.isArray(data.cards)?data.cards:Array.isArray(input)?input:null;
    if(!rows)return null;kind=Array.isArray(data.cards)?'cards':'boards';title=kind==='cards'?'Trello cards':'Trello boards';
    items=rows.map((r:Data)=>({title:text(r.name),subtitle:[text(r.boardName),text(r.listName),r.closed===true?'Closed':''].filter(Boolean).join(' · '),body:text(r.desc),timestamp:date(r.due),url:source(provider,r.url),labels:Array.isArray(r.labels)?r.labels.map((l:Data)=>text(l.name,60)).filter(Boolean):undefined}));
  }else if(provider==='jira'){
    if(!Array.isArray(data.issues))return null;kind='issues';title='Jira issues';
    items=data.issues.map((r:Data)=>({title:[text(r.key,40),text(r.summary||r.fields?.summary,250)].filter(Boolean).join(' · '),subtitle:text(typeof r.status==='string'?r.status:r.fields?.status?.name),body:[r.fields?.priority?.name?`Priority: ${text(r.fields.priority.name,80)}`:'',r.fields?.assignee?.displayName?`Assigned to ${text(r.fields.assignee.displayName,100)}`:''].filter(Boolean).join(' · '),url:source(provider,r.url||r.webUrl)}));
  }else if(provider==='slack'){
    const rows=data.messages?.matches||data.messages||data.matches;if(!Array.isArray(rows))return null;
    kind='messages';title='Slack messages';items=rows.map((r:Data)=>({title:text(r.senderName||r.username)||'Slack message',subtitle:r.channel?.name?`#${text(r.channel.name,100)}`:undefined,body:text(r.text),timestamp:typeof r.ts==='string'&&Number.isFinite(Number(r.ts))?date(new Date(Number(r.ts)*1000).toISOString()):undefined,url:source(provider,r.permalink)}));
  }else if(provider==='notion'){
    const rows=Array.isArray(data.results)?data.results:data.object==='page'?[data]:null;if(!rows)return null;
    kind='pages';title='Notion pages';items=rows.map((r:Data)=>({title:text(notionTitle(r))||'Untitled page',timestamp:date(r.last_edited_time),url:source(provider,r.url)}));
  }else if(provider==='googlecalendar'){
    const calendarList=Array.isArray(data.calendars);const rows=calendarList?data.calendars:data.items||data.events;if(!Array.isArray(rows))return null;
    kind=calendarList?'calendars':'events';title=calendarList?'Google calendars':'Calendar events';
    items=rows.map((r:Data)=>({title:text(r.summary)||'Untitled',subtitle:text(calendarList?r.timeZone:r.location),timestamp:date(r.start?.dateTime||r.start?.date),body:calendarList?undefined:text(r.description),url:source(provider,r.htmlLink)}));
  }else return null;
  items=items.filter(item=>item.title).slice(0,25);
  return {version:1,provider,kind,title,retrievedAt,items};
}

/** The native renderer never trusts executable markup or arbitrary component props. */
export function readServicePreview(value:unknown):ServicePreview|null{
  if(!value||typeof value!=='object')return null;const v=value as Data;
  if(v.version!==1||typeof v.provider!=='string'||!Object.hasOwn(kinds,v.provider)||!kinds[v.provider].includes(v.kind)||typeof v.title!=='string'||v.title.length>120||!date(v.retrievedAt)||!Array.isArray(v.items)||v.items.length>25)return null;
  const items:PreviewItem[]=[];
  for(const r of v.items){
    if(!r||typeof r!=='object'||typeof r.title!=='string'||!r.title.trim()||r.title.length>600)return null;
    items.push({title:r.title,subtitle:text(r.subtitle),body:text(r.body),url:source(v.provider,r.url),timestamp:date(r.timestamp),unread:typeof r.unread==='boolean'?r.unread:undefined,hasAttachments:typeof r.hasAttachments==='boolean'?r.hasAttachments:undefined,labels:Array.isArray(r.labels)?r.labels.slice(0,8).map((s:unknown)=>text(s,60)).filter(Boolean):undefined,metrics:Array.isArray(r.metrics)?r.metrics.slice(0,4).flatMap((m:Data)=>typeof m.label==='string'&&typeof m.value==='string'&&m.label.length<=60&&m.value.length<=80?[{label:m.label,value:m.value}]:[]):undefined});
  }
  return {version:1,provider:v.provider,kind:v.kind,title:v.title,retrievedAt:v.retrievedAt,items};
}
