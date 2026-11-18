import {useMemo} from 'react';
import {Text,TurboModuleRegistry,View} from 'react-native';
import {useAppTheme} from '@/context/ThemeContext';
import {routeGeometry} from '@/lib/routeGeometry';
import type {MapRoute,MapPlaces} from '@/types/execution';
export function OpenRouteMap({route,places,full=false}:{route?:MapRoute;places?:MapPlaces;full?:boolean}){
  const {colors}=useAppTheme();const geometry=useMemo(()=>routeGeometry(route,places),[route,places]);
  if(!TurboModuleRegistry.get('MLRNMapViewModule'))return <View style={{padding:16}}><Text style={{color:colors.textSecondary,fontSize:15,lineHeight:22}}>Install a new TARS build for MapLibre maps. The external navigation link remains available.</Text></View>;
  if(!geometry.bounds)return <Text style={{color:colors.textSecondary}}>No route geometry returned.</Text>;
  // Older installed builds and Expo Go must still open Chat without this module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded native load supports older installed builds
  const {Map,Camera,GeoJSONSource,Layer}=require('@maplibre/maplibre-react-native') as typeof import('@maplibre/maplibre-react-native');
  return <View style={{flex:full?1:undefined,height:full?undefined:280,borderRadius:12,overflow:'hidden'}}><Map mapStyle={process.env.EXPO_PUBLIC_MAP_STYLE_URL||'https://tiles.openfreemap.org/styles/liberty'} style={{flex:1}}><Camera initialViewState={{bounds:[...geometry.bounds[0],...geometry.bounds[1]],padding:{top:40,right:40,bottom:40,left:40}}}/><GeoJSONSource id="tars-route" data={geometry.data}><Layer id="tars-lines" type="line" filter={['==',['geometry-type'],'LineString']} style={{lineColor:'#007AFF',lineWidth:5}}/><Layer id="tars-points" type="circle" filter={['==',['geometry-type'],'Point']} style={{circleColor:'#007AFF',circleRadius:6,circleStrokeColor:'#ffffff',circleStrokeWidth:2}}/></GeoJSONSource></Map></View>;
}
