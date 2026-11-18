import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.118.0';
import type {MapRoute,MapPlaces} from './execution.ts';
import {googleDirectionsUrl} from './maps.ts';
import {publicSourceUrl} from './execution.ts';
import {computeOpenRoute,searchOpenPlaces,OpenMapsError} from './openMaps.ts';

type Data=Record<string,any>;
export class MapsError extends Error {}
export const googleMapsTools=[
  {name:'maps_search_places',description:'Search actual places with the configured map provider. Resolve ambiguous names by asking the user to choose a result. Use the chosen latitude,longitude when routing. Does not infer current location.',parameters:{type:'OBJECT',properties:{query:{type:'STRING'}},required:['query']}},
  {name:'maps_compute_route',description:'Calculate actual road directions between explicit locations. OSRM supports DRIVE only and has no live traffic. Resolve ambiguous addresses first and pass chosen latitude,longitude. Never infer a current location or invent routes.',parameters:{type:'OBJECT',properties:{origin:{type:'STRING'},destination:{type:'STRING'},mode:{type:'STRING',enum:['DRIVE','WALK','BICYCLE','TRANSIT','TWO_WHEELER']}},required:['origin','destination']}},
];
const bounded=(value:unknown,max:number)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max?value.trim():null;
const duration=(value:unknown)=>typeof value==='string'&&/^\d+(?:\.\d+)?s$/.test(value)?Number(value.slice(0,-1)):null;

async function googleRequest(url:string,body:Data,mask:string,signal?:AbortSignal){
  const key=Deno.env.get('GOOGLE_MAPS_API_KEY');
  if(!key)throw new MapsError('Google Maps needs server setup: enable Routes API and Places API (New), enable billing, and configure GOOGLE_MAPS_API_KEY in the existing Supabase Edge Function secrets.');
  let response:Response;
  try {response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':mask},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});}
  catch {throw new MapsError(signal?.aborted?'Google Maps request cancelled.':'Google Maps could not be reached in time. Retry when the connection is available.');}
  if(!response.ok){await response.body?.cancel();throw new MapsError(response.status===403?'Google Maps denied this request. Check API enablement, billing and the server key’s API restrictions.':response.status===429?'Google Maps quota was reached. Retry later or review the project quota.':`Google Maps could not complete the request (HTTP ${response.status}).`);}
  if(Number(response.headers.get('content-length')||0)>2000000){await response.body?.cancel();throw new MapsError('Google Maps returned an oversized response.');}
  const raw=await response.text();if(raw.length>2000000)throw new MapsError('Google Maps returned an oversized response.');
  try {return JSON.parse(raw) as Data;}catch{throw new MapsError('Google Maps returned an invalid response.');}
}

export function projectPlaces(data:Data,at:string):MapPlaces{
  if(!Array.isArray(data.places))return {retrievedAt:at,items:[]};
  return {retrievedAt:at,items:data.places.slice(0,5).flatMap((place:Data)=>{
    const lat=place.location?.latitude,lon=place.location?.longitude;
    if(typeof place.id!=='string'||typeof place.displayName?.text!=='string'||!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)return [];
    let url:string|undefined;try{const u=new URL(place.googleMapsUri);if(u.protocol==='https:'&&(u.hostname==='maps.google.com'||u.hostname==='www.google.com'||u.hostname==='maps.app.goo.gl')&&!u.username&&!u.password)url=u.href;}catch{}
    const attributions=Array.isArray(place.attributions)?place.attributions.slice(0,10).flatMap((a:Data)=>typeof a.provider==='string'?[{name:a.provider.slice(0,200),url:publicSourceUrl(a.providerUri)?.href}]:[]):[];
    return [{id:place.id.slice(0,300),name:place.displayName.text.slice(0,200),address:typeof place.formattedAddress==='string'?place.formattedAddress.slice(0,500):'',latitude:lat,longitude:lon,url,attributions}];
  })};
}
export function projectGoogleRoute(data:Data,origin:string,destination:string,mode:string,at:string):MapRoute|null{
  if(!Array.isArray(data.routes))return null;
  const options=data.routes.slice(0,3).flatMap((route:Data)=>{
    const seconds=duration(route.duration),staticSeconds=duration(route.staticDuration);
    if(!Number.isFinite(route.distanceMeters)||route.distanceMeters<0||seconds===null||!Number.isFinite(seconds))return [];
    const polyline=route.polyline?.encodedPolyline;
    return [{distanceMeters:route.distanceMeters,durationSeconds:seconds,...(staticSeconds!==null?{staticDurationSeconds:staticSeconds}:{}),...(typeof route.description==='string'?{summary:route.description.slice(0,300)}:{}),...(typeof polyline==='string'&&polyline.length<=20000?{encodedPolyline:polyline}:{})}];
  });
  // A Google fallback may have changed the requested routing computation.
  return options.length?{origin,destination,mode,retrievedAt:at,source:'google',trafficAware:['DRIVE','TWO_WHEELER'].includes(mode)&&!data.fallbackInfo,options}:null;
}

export async function executeGoogleMaps(db:SupabaseClient,owner:string,name:string,args:Data,conversationId?:string,requestId?:string,signal?:AbortSignal,uiResult=false){
  const search=name==='maps_search_places',query=bounded(args?.query,400),origin=bounded(args?.origin,500),destination=bounded(args?.destination,500),mode=args?.mode||'DRIVE';
  const originLabel=bounded(args?.origin_label,500)||origin,destinationLabel=bounded(args?.destination_label,500)||destination;
  if(!googleMapsTools.some(tool=>tool.name===name)||!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>!(search?['query']:['origin','destination','mode','origin_label','destination_label']).includes(key))||search&&!query||!search&&(!origin||!destination||!['DRIVE','WALK','BICYCLE','TRANSIT','TWO_WHEELER'].includes(mode)))throw new MapsError('Enter a valid place query or explicit origin, destination and travel mode.');
  const provider=Deno.env.get('MAPS_PROVIDER')||(Deno.env.get('GOOGLE_MAPS_API_KEY')?'google':'osrm');
  if(!['google','osrm'].includes(provider))throw new MapsError('Choose google or osrm for MAPS_PROVIDER.');
  const at=new Date().toISOString();const metadata:Data={provider:provider==='google'?'google_maps':'open_maps',conversation_id:conversationId,request_id:requestId,execution:{version:1,phase:'running',activity:search?'Finding places':'Calculating directions',updatedAt:at,steps:[{label:provider==='google'?'Requesting Google Maps':'Requesting OpenStreetMap services',at}]}};
  const reserved=provider==='osrm'?await db.rpc('claim_tars_map_run',{p_owner:owner,p_action:name,p_summary:search?query:`${origin} → ${destination}`,p_metadata:metadata}):null;
  if(reserved&&(reserved.error||!reserved.data))throw new MapsError('Map requests are limited. Wait a moment before retrying; at most eight requests per minute are allowed.');
  const {data:run,error}=reserved?{data:{id:reserved.data},error:null}:await db.from('agent_tool_runs').insert({user_id:owner,action_name:name,input_summary:search?query:`${origin} → ${destination}`,status:'running',started_at:at,metadata}).select('id').single();
  if(error||!run)throw new MapsError('The Maps execution record could not be created.');
  try{
    let result:Data,modelData:Data;
    if(provider==='osrm'){
      if(search){const places=await searchOpenPlaces(query!,signal);result={title:'OpenStreetMap places',places};modelData=places;}
      else {const route=await computeOpenRoute(origin!,destination!,mode,signal);result={title:'Driving directions',route,url:googleDirectionsUrl(route)};modelData={...route,options:route.options.map(({encodedPolyline,...option})=>({...option,geometryAvailable:Boolean(encodedPolyline)}))};}
    }else if(search){
      const data=await googleRequest('https://places.googleapis.com/v1/places:searchText',{textQuery:query,pageSize:5},'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.attributions',signal);
      const places=projectPlaces(data,new Date().toISOString());result={title:'Google Maps places',places};modelData=places;
    }else{
      const traffic=['DRIVE','TWO_WHEELER'].includes(mode);
      const data=await googleRequest('https://routes.googleapis.com/directions/v2:computeRoutes',{origin:{address:origin},destination:{address:destination},travelMode:mode,...(traffic?{routingPreference:'TRAFFIC_AWARE'}:{}),computeAlternativeRoutes:mode!=='TRANSIT',polylineEncoding:'ENCODED_POLYLINE',polylineQuality:'OVERVIEW'},'routes.duration,routes.staticDuration,routes.distanceMeters,routes.description,routes.polyline.encodedPolyline,fallbackInfo',signal);
      const route=projectGoogleRoute(data,origin!,destination!,mode,new Date().toISOString());
      if(!route)throw new MapsError('Google Maps returned no usable route. Check the locations or try another travel mode.');
      result={title:'Google Maps directions',route,url:googleDirectionsUrl(route)};
      modelData={...route,options:route.options.map(({encodedPolyline,...option})=>({...option,geometryAvailable:Boolean(encodedPolyline)})),url:result.url};
    }
    const finished=new Date().toISOString();metadata.execution={...metadata.execution,phase:'completed',updatedAt:finished,result,steps:[...metadata.execution.steps,{label:'Map provider returned verified results',at:finished}]};
    if(!search){result.route={...result.route,originLabel,destinationLabel};}
    // Location choices are intermediate steps in the manual route workflow.
    // Keep their execution records, but publish only its completed route.
    if(!requestId&&!search)metadata.activity={version:1,query:`${originLabel} → ${destinationLabel}`,title:'Driving directions',summary:`${(result.route.options[0].distanceMeters/1000).toFixed(1)} km · approximately ${Math.ceil(result.route.options[0].durationSeconds/60)} min. ${provider==='osrm'?'No live traffic.':''}`,sources:[provider==='google'?'Google Maps':'OpenStreetMap'],status:'completed',conversationId:conversationId||null,sourceUrl:result.url||null};
    const saved=await db.from('agent_tool_runs').update({status:'completed',finished_at:finished,output_summary:search?'Place search completed':'Road routes retrieved',metadata}).eq('id',run.id).eq('user_id',owner);
    if(saved.error)throw new MapsError('The Maps result could not be saved.');
    return {ok:true,provider:provider==='google'?'Google Maps':'OpenStreetMap / OSRM',data:modelData,...(uiResult?{result}:{})};
  }catch(error){
    const message=error instanceof MapsError||error instanceof OpenMapsError?error.message:'The map provider could not complete this request.';const finished=new Date().toISOString();
    metadata.execution={...metadata.execution,phase:signal?.aborted?'cancelled':'failed',updatedAt:finished,reason:message};
    // Existing execution status constraint uses failed for interrupted runs;
    // the explicit cancelled phase and request error preserve the user outcome.
    await db.from('agent_tool_runs').update({status:'failed',finished_at:finished,error_message:message,metadata}).eq('id',run.id).eq('user_id',owner);
    return {ok:false,error:message};
  }
}
