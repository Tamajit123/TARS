import {useState} from 'react';
import {Linking,Pressable,Text,View} from 'react-native';
import {attachmentUrl} from '@/services/attachments';
import type {AttachmentRef} from '../../../supabase/functions/_shared/mediaPolicy';
import {useAppTheme} from '@/context/ThemeContext';
import {AudioPreview} from './ComposerMedia';
export function MessageAttachments({items}:{items:AttachmentRef[]}){
  const {colors}=useAppTheme(),[audio,setAudio]=useState<{id:string;url:string}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
  const open=async(item:AttachmentRef)=>{if(busy)return;setBusy(item.id);setError('');try{const url=await attachmentUrl(item);if(item.mime_type.startsWith('audio/'))setAudio({id:item.id,url});else await Linking.openURL(url);}catch{setError('The attachment could not open. Try again.');}finally{setBusy('');}};
  return <View style={{gap:8,marginTop:10}}>{items.map(item=><View key={item.id} style={{borderWidth:0.5,borderColor:colors.border,borderRadius:12,padding:10}}><Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.name}`} disabled={Boolean(busy)} onPress={()=>void open(item)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.textLink,fontSize:15}}>{busy===item.id?'Opening…':item.name} ↗</Text><Text style={{color:colors.textSecondary,fontSize:12}}>{Math.ceil(item.size_bytes/1024)} KB{item.duration_ms?` · ${Math.round(item.duration_ms/1000)} sec`:''}</Text></Pressable>{audio?.id===item.id?<AudioPreview key={audio.url} uri={audio.url}/>:null}</View>)}{error?<Text accessibilityRole="alert" style={{color:colors.error}}>{error}</Text>:null}</View>;
}
