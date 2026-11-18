import type {MapRoute} from './execution.ts';
/** Versioned native contract: never HTML, executable actions or provider secrets. */
export const responseTypes=['text','flight_list','hotel_list','vehicle_list','product_list','business_list','restaurant_list','job_list','property_list','subscription_comparison','insurance_comparison','comparison_table','research_summary','source_list','news_list','map','chart','weather','event_list','email_summary','calendar_events','action_card','generic_collection'] as const;
export const intentCategories=['flights','hotels','car_rentals','travel','restaurants','local_businesses','shopping','product_comparisons','subscriptions','jobs','real_estate','insurance','finance','research','news','weather','maps','events','email','calendar','productivity','programming','general','unknown'] as const;
export type IntentCategory=typeof intentCategories[number];
export type RichType=typeof responseTypes[number];
export type Source={id:string;title:string;url?:string;provider:string;retrievedAt:string;publishedAt?:string;excerpt:string;image?:string;cached?:boolean;expiresAt?:string;kind:'search'|'page'|'connected'|'api'};
export type RichField={label:string;value:string;quote:string;sourceId:string};
export type RichItem={title:string;sourceId:string;description?:string;image?:string;price?:{value:string;basis:'listed'|'estimated';quote:string};fields:RichField[];actionLabel?:string};
export type RichBlock={type:RichType;title?:string;items?:RichItem[];text?:string;columns?:string[];rows?:RichField[][];route?:MapRoute};
export type RichResponse={version:1;intent:IntentCategory;status:'completed'|'partial'|'no_results'|'clarification';title:string;summary:string;retrievedAt:string;sources:Source[];blocks:RichBlock[];limitations:string[];pagination?:{page:number;total:number};filters?:{label:string;value:string}[]};
const isObject=(v:unknown):v is Record<string,any>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
const short=(v:unknown,max=1000):v is string=>typeof v==='string'&&v.length<=max;
const has=(list:readonly string[],v:unknown)=>typeof v==='string'&&list.includes(v);
const date=(v:unknown)=>short(v,50)&&Number.isFinite(Date.parse(v));
export function safeResultUrl(value:unknown){try{const url=new URL(typeof value==='string'?value:'');return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)&&!/(^|\.)(localhost|local|internal|invalid|test|onion)$/.test(url.hostname)&&!/^\d+\./.test(url.hostname)&&![...url.searchParams.keys()].some(k=>/token|secret|api.?key|password/i.test(k))?url.href:null;}catch{return null;}}
export function readRichResponse(value:unknown):RichResponse|null{
  if(!isObject(value)||value.version!==1||!has(intentCategories,value.intent)||!has(['completed','partial','no_results','clarification'],value.status)||!short(value.title,160)||!short(value.summary,20000)||!date(value.retrievedAt))return null;
  if(!Array.isArray(value.sources)||value.sources.length>30||!Array.isArray(value.blocks)||value.blocks.length>12||!Array.isArray(value.limitations)||value.limitations.length>10||value.limitations.some((x:unknown)=>!short(x,600)))return null;
  try{if(JSON.stringify(value).length>150000)return null;}catch{return null;}
  const ids=new Set<string>();
  for(const source of value.sources){if(!isObject(source)||!short(source.id,80)||!source.id||ids.has(source.id)||!short(source.title,300)||!short(source.provider,80)||!short(source.excerpt,16000)||!date(source.retrievedAt)||!has(['search','page','connected','api'],source.kind)||source.url!==undefined&&!safeResultUrl(source.url)||source.image!==undefined&&!safeResultUrl(source.image)||source.cached!==undefined&&typeof source.cached!=='boolean'||source.publishedAt!==undefined&&!date(source.publishedAt)||source.expiresAt!==undefined&&!date(source.expiresAt))return null;ids.add(source.id);}
  const field=(f:unknown)=>isObject(f)&&short(f.label,100)&&short(f.value,1000)&&short(f.quote,1600)&&ids.has(f.sourceId);
  for(const block of value.blocks){
    if(!isObject(block)||!has(responseTypes,block.type)||block.title!==undefined&&!short(block.title,160)||block.text!==undefined&&!short(block.text,12000)||block.route!==undefined&&!validRichRoute(block.route))return null;
    if(block.items!==undefined){if(!Array.isArray(block.items)||block.items.length>20)return null;for(const item of block.items){if(!isObject(item)||!short(item.title,240)||!ids.has(item.sourceId)||item.description!==undefined&&!short(item.description,1000)||item.image!==undefined&&!safeResultUrl(item.image)||!Array.isArray(item.fields)||item.fields.length>24||!item.fields.every(field)||item.actionLabel!==undefined&&!short(item.actionLabel,80))return null;if(item.price!==undefined&&(!isObject(item.price)||!short(item.price.value,100)||!has(['listed','estimated'],item.price.basis)||!short(item.price.quote,1600)))return null;}}
    if(block.columns!==undefined&&(!Array.isArray(block.columns)||block.columns.length>8||block.columns.some((x:unknown)=>!short(x,100))))return null;
    if(block.rows!==undefined&&(!Array.isArray(block.rows)||block.rows.length>20||block.rows.some((row:unknown)=>!Array.isArray(row)||row.length>8||!row.every(field))))return null;
  }
  if(value.pagination!==undefined&&(!isObject(value.pagination)||!Number.isInteger(value.pagination.page)||value.pagination.page<1||!Number.isInteger(value.pagination.total)||value.pagination.total<value.pagination.page))return null;
  if(value.filters!==undefined&&(!Array.isArray(value.filters)||value.filters.length>10||value.filters.some((f:unknown)=>!isObject(f)||!short(f.label,100)||!short(f.value,300))))return null;
  return value as RichResponse;
}
export function sourceText(value:unknown,max=16000){return typeof value==='string'?value.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,max):'';}
const normalize=(s:string)=>s.normalize('NFKC').replace(/[\s,]+/g,'').toLowerCase();
export function groundResponse(candidate:unknown,sources:Source[]):RichResponse{
  if(!isObject(candidate))throw new Error('Response must be an object.');
  const response=readRichResponse({...candidate,version:1,sources,retrievedAt:new Date().toISOString()});if(!response)throw new Error('Response schema validation failed.');
  if(['flights','hotels','car_rentals'].includes(response.intent)&&/(?:₹|INR|USD|SAR|EUR|GBP|\$)\s*[\d,]+/i.test(response.summary)&&!response.blocks.some(block=>block.items?.some(item=>item.price)))throw new Error('A travel price claim needs a validated dated price item. Omit numerical fare claims if the exact requested offer could not be verified.');
  const byId=new Map(sources.map(s=>[s.id,s]));
  const assertField=(field:RichField)=>{const source=byId.get(field.sourceId);if(!source||!field.quote.trim()||!sourceText(source.excerpt).includes(sourceText(field.quote))||!normalize(field.quote).includes(normalize(field.value)))throw new Error('A result field lacks matching source evidence.');};
  for(const block of response.blocks){
    for(const row of block.rows||[])for(const field of row)assertField(field);
    for(const item of block.items||[]){const source=byId.get(item.sourceId)!;
      if(item.image&&item.image!==source.image)throw new Error('Result images must come from the actual provider.');
      for(const field of item.fields)assertField(field);
      if(item.price&&block.type==='flight_list'&&(!item.fields.some(field=>/date/i.test(field.label))||!item.fields.some(field=>/trip|one.way|return/i.test(field.label+' '+field.value))))throw new Error('A flight price needs evidence for its travel date and one-way/return basis. Otherwise omit the price.');
      if(item.price)assertField({label:'Price',value:item.price.value,quote:item.price.quote,sourceId:item.sourceId});
      if(['flight_list','hotel_list','vehicle_list'].includes(block.type)&&item.price)item.actionLabel='Check listed price';
    }
  }
  if(response.intent==='flights'&&/cheapest|lowest verified/i.test(response.title))response.title='Flight options to check';
  return response;
}
export function validRichRoute(value:unknown):value is MapRoute{
  if(!isObject(value)||!short(value.origin,500)||!short(value.destination,500)||!has(['DRIVE','WALK','BICYCLE','TRANSIT','TWO_WHEELER'],value.mode)||!has(['google','composio','osrm'],value.source)||typeof value.trafficAware!=='boolean'||!date(value.retrievedAt)||!Array.isArray(value.options)||!value.options.length||value.options.length>4)return false;
  return value.options.every((item:unknown)=>isObject(item)&&Number.isFinite(item.distanceMeters)&&item.distanceMeters>=0&&Number.isFinite(item.durationSeconds)&&item.durationSeconds>=0&&(item.encodedPolyline===undefined||short(item.encodedPolyline,20000)));
}
