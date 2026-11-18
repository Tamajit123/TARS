import type {MapRoute} from './execution.ts';
export function mapRouteResult(data:Record<string,any>,args:Record<string,any>,retrievedAt:string):MapRoute|null{
  if(typeof args.origin_address!=='string'||typeof args.destination_address!=='string'||!Array.isArray(data?.routes))return null;
  const options=data.routes.slice(0,4).flatMap((route:Record<string,any>)=>{const match=typeof route.duration==='string'?route.duration.match(/^(\d+(?:\.\d+)?)s$/):null;return Number.isFinite(route.distanceMeters)&&route.distanceMeters>=0&&match?[{distanceMeters:route.distanceMeters,durationSeconds:Number(match[1]),...(typeof route.description==='string'?{summary:route.description.slice(0,300)}:{})}]:[];});
  return options.length?{origin:args.origin_address.slice(0,500),destination:args.destination_address.slice(0,500),mode:args.travel_mode||'DRIVE',retrievedAt,trafficAware:['TRAFFIC_AWARE','TRAFFIC_AWARE_OPTIMAL'].includes(args.routing_preference),options}:null;
}
export function googleDirectionsUrl(route:MapRoute){const mode:Record<string,string>={DRIVE:'driving',WALK:'walking',BICYCLE:'bicycling',TRANSIT:'transit'};return 'https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',origin:route.origin,destination:route.destination,...(mode[route.mode]?{travelmode:mode[route.mode]}:{})});}

/** Decode only real provider geometry; reject malformed and excessive polylines. */
export function decodeRoutePolyline(encoded:string):{latitude:number;longitude:number}[]{
  if(typeof encoded!=='string'||encoded.length>20000)return [];
  let index=0,latitude=0,longitude=0;const points:{latitude:number;longitude:number}[]=[];
  const next=()=>{let value=0,shift=0,byte;do{if(index>=encoded.length||shift>25)throw new Error('Invalid polyline');byte=encoded.charCodeAt(index++)-63;if(byte<0||byte>63)throw new Error('Invalid polyline');value|=(byte&31)<<shift;shift+=5;}while(byte>=32);return value&1?~(value>>1):value>>1;};
  try{while(index<encoded.length){latitude+=next();longitude+=next();const lat=latitude/1e5,lon=longitude/1e5;if(Math.abs(lat)>90||Math.abs(lon)>180||points.length>=5000)return [];points.push({latitude:lat,longitude:lon});}}catch{return [];}
  return points.length>=2?points:[];
}
