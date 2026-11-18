import {Pressable,Share,Text} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {useAppTheme} from '@/context/ThemeContext';
import {showToast} from '@/context/ToastContext';

export function ResponseShare({text}:{text:string}){
  const {colors}=useAppTheme();
  const share=async()=>{
    try{await Share.share({message:text});}
    catch{try{await Clipboard.setStringAsync(text);showToast('Sharing is unavailable here. Response copied.');}catch{showToast('The response could not be shared or copied.');}}
  };
  return <Pressable accessibilityRole="button" accessibilityLabel="Share response" onPress={()=>void share()} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.textLink,fontSize:15}}>Share</Text></Pressable>;
}
