import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import type {MapRoute,MapPlaces} from '@/types/execution';
import {useAppTheme} from '@/context/ThemeContext';
import {routeGeometry} from '@/lib/routeGeometry';
import 'maplibre-gl/dist/maplibre-gl.css';
export function RouteMap({route,places,full=false}:{route?:MapRoute;places?:MapPlaces;full?:boolean}){
  const container=useRef<HTMLDivElement>(null),[error,setError]=useState('');const {colors}=useAppTheme();
  const geometry=useMemo(()=>routeGeometry(route,places),[route,places]);const openData=route?.source==='osrm'||places?.source==='osm';
  useEffect(()=>{
    if(!openData||!geometry.bounds||!container.current)return;
    let disposed=false,map:import('maplibre-gl').Map|undefined;setError('');
    void import('maplibre-gl').then(lib=>{
      if(disposed||!container.current)return;
      lib.setWorkerUrl(new URL('/vendor/maplibre-gl-worker.mjs',window.location.origin).href);
      map=new lib.Map({container:container.current,style:process.env.EXPO_PUBLIC_MAP_STYLE_URL||'https://tiles.openfreemap.org/styles/liberty',bounds:geometry.bounds!,fitBoundsOptions:{padding:40,maxZoom:15},attributionControl:{compact:false}});
      map.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
      map.on('error',()=>setError('Some map tiles could not load. Route metrics still use the provider’s result.'));
      map.on('load',()=>{if(!map)return;map.addSource('tars-route',{type:'geojson',data:geometry.data});map.addLayer({id:'tars-lines',type:'line',source:'tars-route',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#007AFF','line-width':5}});map.addLayer({id:'tars-points',type:'circle',source:'tars-route',filter:['==',['geometry-type'],'Point'],paint:{'circle-color':'#007AFF','circle-radius':6,'circle-stroke-color':'#ffffff','circle-stroke-width':2}});});
    }).catch(()=>setError('Interactive maps are unavailable here. Open the external directions link.'));
    return()=>{disposed=true;map?.remove();};
  },[geometry,openData]);
  if(!openData)return <View style={{padding:16}}><Text style={{color:colors.textSecondary}}>Use the Google Maps link to view this Google-provided result.</Text></View>;
  if(!geometry.bounds)return <Text style={{color:colors.textSecondary}}>No map geometry returned. No route has been drawn.</Text>;
  return <View style={{flex:full?1:undefined,gap:8}}>{React.createElement('div',{ref:container,'aria-label':'Interactive OpenStreetMap route',style:{height:full?'75vh':280,width:'100%',borderRadius:12,overflow:'hidden'}})}{error?<Text accessibilityRole="alert" style={{color:colors.textSecondary,fontSize:13}}>{error}</Text>:null}</View>;
}
