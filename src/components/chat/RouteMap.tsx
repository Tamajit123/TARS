import {Text,View} from 'react-native';
import {useAppTheme} from '@/context/ThemeContext';
import type {MapRoute,MapPlaces} from '@/types/execution';
export function RouteMap({full=false}:{route?:MapRoute;places?:MapPlaces;full?:boolean}){
  const {colors}=useAppTheme();
  return <View style={{padding:16,backgroundColor:colors.surfaceMuted,borderRadius:12,...(full?{flex:1,justifyContent:'center' as const}:{})}}><Text style={{color:colors.textSecondary,fontSize:15,lineHeight:23}}>The native map is available in a configured iPhone or Android build. Use the Google Maps link to view the actual route or place in your browser.</Text></View>;
}
