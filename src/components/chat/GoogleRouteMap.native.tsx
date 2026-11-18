import {useMemo,useRef} from 'react';
import {Platform,StyleSheet,Text,View} from 'react-native';
import MapView,{Marker,Polyline,PROVIDER_GOOGLE} from 'react-native-maps';
import Constants from 'expo-constants';
import {useAppTheme} from '@/context/ThemeContext';
import type {MapRoute,MapPlaces} from '@/types/execution';
import {decodeRoutePolyline} from '../../../supabase/functions/_shared/maps';

export function RouteMap({route,places,full=false}:{route?:MapRoute;places?:MapPlaces;full?:boolean}){
  const {colors,resolved}=useAppTheme();const ref=useRef<MapView|null>(null);
  const lines=useMemo(()=>route?.options.map(option=>decodeRoutePolyline(option.encodedPolyline||''))||[],[route]);
  const points=useMemo(()=>places?.items.map(place=>({latitude:place.latitude,longitude:place.longitude}))||lines.flat(),[places,lines]);
  const configured=Constants.expoConfig?.extra?.googleMapsNativeConfigured?.[Platform.OS];
  if(!configured||!points.length)return <View style={{padding:16,borderRadius:12,backgroundColor:colors.surfaceMuted,...(full?{flex:1,justifyContent:'center' as const}:{})}}><Text style={{color:colors.textSecondary,fontSize:15,lineHeight:23}}>{!configured?'The Google Maps SDK key needs configuration in a new native build. Open the Google Maps link to view these results.':'Google did not return usable map geometry. No route has been drawn.'}</Text></View>;
  return <View style={{height:full?undefined:240,flex:full?1:undefined,borderRadius:12,overflow:'hidden'}}><MapView ref={ref} style={StyleSheet.absoluteFill} provider={PROVIDER_GOOGLE} userInterfaceStyle={resolved} initialRegion={{...points[0],latitudeDelta:0.05,longitudeDelta:0.05}} showsUserLocation={false} toolbarEnabled={false} loadingEnabled onMapReady={()=>ref.current?.fitToCoordinates(points,{edgePadding:{top:44,right:32,bottom:44,left:32},animated:false})}>
    {lines.map((coordinates,index)=>coordinates.length?<Polyline key={index} coordinates={coordinates} strokeColor={index===0?'#007AFF':resolved==='dark'?'#8B9EBC':'#9AB5DF'} strokeWidth={index===0?5:3}/>:null)}
    {places?places.items.map(place=><Marker key={place.id} coordinate={{latitude:place.latitude,longitude:place.longitude}} title={place.name} description={place.address}/>):<><Marker coordinate={points[0]} title={route?.origin}/><Marker coordinate={lines[0]?.at(-1)||points.at(-1)!} title={route?.destination}/></>}
  </MapView></View>;
}
