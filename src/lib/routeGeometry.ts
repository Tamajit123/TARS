import type {MapPlaces,MapRoute} from '@/types/execution';
import {decodeRoutePolyline} from '../../supabase/functions/_shared/maps';
export function routeGeometry(route?:MapRoute,places?:MapPlaces){
  const lines=route?.options.map(option=>decodeRoutePolyline(option.encodedPolyline||'').map(p=>[p.longitude,p.latitude] as [number,number])).filter(points=>points.length>1)||[];
  const points=places?.items.map(p=>[p.longitude,p.latitude] as [number,number])||lines.flat();
  const features:GeoJSON.Feature[]=[...lines.map((coordinates,index)=>({type:'Feature' as const,properties:{index},geometry:{type:'LineString' as const,coordinates}})),...(places?.items||[]).map(p=>({type:'Feature' as const,properties:{title:p.name},geometry:{type:'Point' as const,coordinates:[p.longitude,p.latitude]}}))];
  if(route&&lines[0])for(const [index,point] of [lines[0][0],lines[0].at(-1)!].entries())features.push({type:'Feature',properties:{title:index===0?route.origin:route.destination},geometry:{type:'Point',coordinates:point}});
  const bounds=points.length?[[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]] as [[number,number],[number,number]]:null;
  return {data:{type:'FeatureCollection' as const,features},bounds};
}
