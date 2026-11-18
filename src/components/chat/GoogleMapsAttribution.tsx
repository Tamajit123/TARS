import {Text,View} from 'react-native';
import {useAppTheme} from '@/context/ThemeContext';
/** Compact attribution alongside the result; native map SDK attribution stays visible. */
export function GoogleMapsAttribution(){
  const {resolved}=useAppTheme();
  return <View style={{paddingTop:10,paddingBottom:5}}><Text accessibilityLabel="Google Maps" numberOfLines={1} style={{fontSize:12,fontWeight:'400',fontStyle:'normal',letterSpacing:0,color:resolved==='dark'?'#FFFFFF':'#1F1F1F'}}>Google Maps</Text></View>;
}
