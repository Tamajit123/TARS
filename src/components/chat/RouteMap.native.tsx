import type {MapRoute,MapPlaces} from '@/types/execution';
import {RouteMap as GoogleRouteMap} from './GoogleRouteMap.native';
import {OpenRouteMap} from './OpenRouteMap.native';
export function RouteMap(props:{route?:MapRoute;places?:MapPlaces;full?:boolean}){
  return props.route?.source==='osrm'||props.places?.source==='osm'?<OpenRouteMap {...props}/>:<GoogleRouteMap {...props}/>;
}
