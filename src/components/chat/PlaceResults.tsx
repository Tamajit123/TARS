import {Linking,Pressable,Text,View} from 'react-native';
import type {MapPlaces} from '@/types/execution';
import {useAppTheme} from '@/context/ThemeContext';
import {RouteMap} from './RouteMap';
import {GoogleMapsAttribution} from './GoogleMapsAttribution';
export function PlaceResults({places,onError}:{places:MapPlaces;onError:(message:string)=>void}){
  const {colors}=useAppTheme();
  return <View style={{padding:16,gap:12}}>
    <Text style={{fontSize:20,fontWeight:'600',color:colors.textPrimary}}>Places</Text>
    {places.items.length?<RouteMap places={places}/>:<Text style={{color:colors.textSecondary,fontSize:17}}>No matching places returned. Try a more specific location.</Text>}
    {places.items.map(place=><View key={place.id} style={{paddingVertical:12,borderTopWidth:0.5,borderTopColor:colors.border,gap:6}}>
      <Text selectable style={{color:colors.textPrimary,fontSize:17,fontWeight:'600'}}>{place.name}</Text><Text selectable style={{color:colors.textSecondary,fontSize:15,lineHeight:23}}>{place.address}</Text>
      {place.url?<Pressable accessibilityRole="link" style={{minHeight:44,justifyContent:'center'}} onPress={()=>void Linking.openURL(place.url!).catch(()=>onError('The map source could not open this place.'))}><Text style={{color:colors.textLink,fontSize:17}}>{places.source==='osm'?'View in OpenStreetMap ↗':'View in Google Maps ↗'}</Text></Pressable>:null}
      {place.attributions?.map((a,index)=>a.url?<Pressable key={index} accessibilityRole="link" style={{minHeight:44,justifyContent:'center'}} onPress={()=>void Linking.openURL(a.url!).catch(()=>onError('The attribution link could not open.'))}><Text style={{color:colors.textLink,fontSize:12}}>{a.name}</Text></Pressable>:<Text key={index} style={{color:colors.textSecondary,fontSize:12}}>{a.name}</Text>)}
    </View>)}
    {places.source==='osm'?<Text style={{color:colors.textSecondary,fontSize:12}}>© OpenStreetMap contributors · Photon geocoding</Text>:<GoogleMapsAttribution/>}<Text style={{color:colors.textSecondary,fontSize:12}}>{new Date(places.retrievedAt).toLocaleString()}</Text>
  </View>;
}
