import type {MapPlaces,MapRoute} from './execution.ts';
import {decodeRoutePolyline} from './maps.ts';
type Data=Record<string,any>;
export class OpenMapsError extends Error{}
function endpoint(name:string,demo:string){
  const value=Deno.env.get(name)||(Deno.env.get('MAPS_DEMO_MODE')==='true'?demo:'');
  if(!value)throw new OpenMapsError(`Configure ${name} on the server, or explicitly enable MAPS_DEMO_MODE for limited development use.`);
  const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new OpenMapsError(`${name} must be an HTTPS server origin without credentials or query parameters.`);
  return url;
}
async function request(url:URL,signal?:AbortSignal){
  let response:Response;try{response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'TARS/1.0 (+https://github.com/Tamajit123/TARS)'},redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});}catch{throw new OpenMapsError('The map service could not be reached. Your locations were not changed.');}
  if(!response.ok){await response.body?.cancel();throw new OpenMapsError(response.status===429?'The map provider rate limit was reached. Wait before retrying.':`The map provider returned HTTP ${response.status}.`);}
  const raw=await response.text();if(raw.length>1500000)throw new OpenMapsError('The map response is too large.');
  try{return JSON.parse(raw) as Data;}catch{throw new OpenMapsError('The map provider returned invalid data.');}
}
export function coordinate(value:string){
  const match=value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if(!match)return null;const latitude=Number(match[1]),longitude=Number(match[2]);
  if(Math.abs(latitude)>90||Math.abs(longitude)>180)throw new OpenMapsError('Latitude or longitude is outside its valid range.');
  return {latitude,longitude};
}
export function photonPlaces(data:Data):MapPlaces{
  return {source:'osm',retrievedAt:new Date().toISOString(),items:(Array.isArray(data.features)?data.features:[]).slice(0,5).flatMap((feature:Data)=>{
    const p=feature?.properties,c=feature?.geometry?.coordinates;
    if(!p||!Array.isArray(c)||c.length!==2||!Number.isFinite(c[0])||Math.abs(c[0])>180||!Number.isFinite(c[1])||Math.abs(c[1])>90)return [];
    const name=typeof p.name==='string'?p.name:typeof p.street==='string'?p.street:'Unnamed place';
    const address=[p.housenumber,p.street,p.district,p.city,p.state,p.country].filter(v=>typeof v==='string').join(', ').slice(0,500);
    return [{id:`${p.osm_type||'place'}-${p.osm_id||`${c[1]},${c[0]}`}`,name:name.slice(0,200),address,latitude:c[1],longitude:c[0],url:`https://www.openstreetmap.org/?mlat=${c[1]}&mlon=${c[0]}#map=16/${c[1]}/${c[0]}`}];
  })};
}
export async function searchOpenPlaces(query:string,signal?:AbortSignal){
  if(typeof query!=='string'||!query.trim()||query.length>400)throw new OpenMapsError('Enter a location, including its city.');
  const url=endpoint('PHOTON_BASE_URL','https://photon.komoot.io/');url.pathname=url.pathname.replace(/\/$/,'')+'/api/';url.searchParams.set('q',query.trim());url.searchParams.set('limit','5');url.searchParams.set('lang','en');
  return photonPlaces(await request(url,signal));
}
async function resolve(value:string,signal?:AbortSignal){
  const exact=coordinate(value);if(exact)return exact;
  const places=await searchOpenPlaces(value,signal);
  if(!places.items.length)throw new OpenMapsError(`No location found for “${value}”. Include a city or use latitude,longitude.`);
  if(places.items.length>1)throw new OpenMapsError(`“${value}” is ambiguous. Search places and select the exact origin/destination, then use its latitude,longitude.`);
  return places.items[0];
}
export function osrmRoute(data:Data,origin:string,destination:string):MapRoute{
  if(data.code!=='Ok')throw new OpenMapsError(data.code==='NoRoute'?'No driving route was found between these locations.':'The routing provider could not calculate this route.');
  const options=(Array.isArray(data.routes)?data.routes:[]).slice(0,3).flatMap((r:Data)=>Number.isFinite(r.distance)&&r.distance>=0&&Number.isFinite(r.duration)&&r.duration>=0&&typeof r.geometry==='string'&&r.geometry.length<=20000&&decodeRoutePolyline(r.geometry).length>=2?[{distanceMeters:r.distance,durationSeconds:r.duration,encodedPolyline:r.geometry,summary:r.legs?.map((l:Data)=>typeof l.summary==='string'?l.summary:'').filter(Boolean).join(' · ').slice(0,200)}]:[]);
  if(!options.length)throw new OpenMapsError('The routing provider returned no usable road geometry.');
  return {origin,destination,source:'osrm',mode:'DRIVE',trafficAware:false,retrievedAt:new Date().toISOString(),options};
}
export async function computeOpenRoute(origin:string,destination:string,mode='DRIVE',signal?:AbortSignal){
  if(mode!=='DRIVE')throw new OpenMapsError('This OSRM deployment supports driving only. Walking/cycling require a provider configured for those profiles.');
  for(const value of [origin,destination])if(typeof value!=='string'||!value.trim()||value.length>500)throw new OpenMapsError('Enter both origin and destination.');
  const from=await resolve(origin,signal),to=await resolve(destination,signal);
  const url=endpoint('OSRM_BASE_URL','https://router.project-osrm.org/');url.pathname=url.pathname.replace(/\/$/,'')+`/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  url.searchParams.set('alternatives','true');url.searchParams.set('overview','simplified');url.searchParams.set('geometries','polyline');url.searchParams.set('steps','false');
  return osrmRoute(await request(url,signal),origin,destination);
}
