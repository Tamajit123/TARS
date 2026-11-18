import {Linking,Pressable,Text,View} from 'react-native';
import {useState} from 'react';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AccessibleModal} from '@/components/common/AccessibleModal';
import {RouteMap} from './RouteMap';
import {GoogleMapsAttribution} from './GoogleMapsAttribution';
import {useAppTheme} from '@/context/ThemeContext';
import type {MapRoute} from '@/types/execution';
import {googleDirectionsUrl} from '../../../supabase/functions/_shared/maps';
export function RouteCard({route,onError}:{route:MapRoute;onError:(message:string)=>void}){
  const [expanded,setExpanded]=useState(false);
  const {colors}=useAppTheme();const fastest=Math.min(...route.options.map(o=>o.durationSeconds)),shortest=Math.min(...route.options.map(o=>o.distanceMeters));
  return <View style={{padding:16,borderTopWidth:0.5,borderColor:colors.border}}>
    <Text style={{color:colors.textPrimary,fontSize:20,fontWeight:'600'}}>Directions</Text>
    <Text selectable style={{color:colors.textSecondary,fontSize:15,lineHeight:23,marginVertical:10}}>{route.originLabel||route.origin} → {route.destinationLabel||route.destination}</Text>
    {route.options.some(option=>option.encodedPolyline)?<RouteMap route={route}/>:null}
    {route.options.map((option,index)=><View key={index} style={{paddingVertical:12,borderBottomWidth:0.5,borderColor:colors.border}}>
      <Text style={{color:colors.textPrimary,fontSize:22,fontWeight:'600'}}>{Math.round(option.durationSeconds/60)} min · {(option.distanceMeters/1000).toFixed(1)} km</Text>
      <Text style={{color:colors.textSecondary,fontSize:13,lineHeight:21}}>{option.summary||`Route ${index+1}`}{route.options.length>1?` · ${option.durationSeconds===fastest?'Fastest returned ':''}${option.distanceMeters===shortest?'Shortest returned':''}`:''}</Text>
      {route.trafficAware&&option.staticDurationSeconds!==undefined?<Text style={{color:colors.textSecondary,fontSize:13,lineHeight:21}}>Without traffic: {Math.round(option.staticDurationSeconds/60)} min</Text>:null}
    </View>)}
    <Text style={{color:colors.textSecondary,fontSize:12,lineHeight:20,marginVertical:10}}>{route.mode} · {route.trafficAware?'Traffic-aware estimate':'Estimate without live traffic'} · {route.source==='osrm'?'OSRM / OpenStreetMap':route.source==='google'?'Google Maps':'Google Maps via Composio'} · {new Date(route.retrievedAt).toLocaleString()}</Text>
    {route.source==='osrm'?<Text style={{color:colors.textSecondary,fontSize:12,lineHeight:20}}>© OpenStreetMap contributors · OSRM routing</Text>:<GoogleMapsAttribution/>}
    {route.options.some(option=>option.encodedPolyline)?<Pressable accessibilityRole="button" onPress={()=>setExpanded(true)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:colors.textLink,fontSize:17}}>View route</Text></Pressable>:null}
    <Pressable accessibilityRole="link" accessibilityLabel="Open directions in Google Maps" onPress={()=>void Linking.openURL(googleDirectionsUrl(route)).catch(()=>onError('Google Maps could not open. Try again.'))} style={{minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:colors.primary}}><Text style={{color:colors.onPrimary,fontSize:17,fontWeight:'600'}}>Open in Google Maps ↗</Text></Pressable>
    <AccessibleModal visible={expanded} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setExpanded(false)}><SafeAreaView style={{flex:1,backgroundColor:colors.background}}><Pressable accessibilityRole="button" onPress={()=>setExpanded(false)} style={{minHeight:52,justifyContent:'center',paddingHorizontal:20}}><Text style={{color:colors.textLink,fontSize:17}}>Done</Text></Pressable><RouteMap route={route} full/></SafeAreaView></AccessibleModal>
  </View>;
}
