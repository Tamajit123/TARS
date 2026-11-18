import {useState} from 'react';
import {Linking,Pressable,Text,View} from 'react-native';
import {useAppTheme} from '@/context/ThemeContext';
import {ProviderLogo} from '@/components/tools/ProviderLogo';
import type {ServicePreview} from '../../../supabase/functions/_shared/servicePreview';

function timestamp(value:string){
  const day=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return day?new Date(Number(day[1]),Number(day[2])-1,Number(day[3])).toLocaleDateString():new Date(value).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}
export function ServiceResultPreview({preview,onError}:{preview:ServicePreview;onError:(message:string)=>void}){
  const {colors}=useAppTheme(),[all,setAll]=useState(false);
  const list=all?preview.items:preview.items.slice(0,3);
  const mail=preview.kind==='mail',discussion=preview.kind==='discussion',issue=preview.kind==='issues';
  return <View style={{paddingHorizontal:16,paddingBottom:14}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12}}><ProviderLogo identifiers={[preview.provider]} name={preview.title} size={20}/><Text style={{color:colors.textSecondary,fontSize:13,flex:1}}>Retrieved {timestamp(preview.retrievedAt)}</Text></View>
    {!preview.items.length?<Text style={{color:colors.textSecondary,fontSize:17,lineHeight:25,paddingVertical:12}}>No {preview.kind==='issues'?'issues':preview.kind==='boards'?'boards':preview.kind==='mail'?'messages':'items'} returned.</Text>:list.map((item,index)=><View key={index} style={{paddingVertical:14,paddingLeft:discussion?12:0,borderLeftWidth:discussion?2:0,borderLeftColor:discussion?colors.primary:undefined,borderTopWidth:index?0.5:0,borderTopColor:colors.border,gap:6}}>
      <View style={{flexDirection:'row',alignItems:'flex-start',gap:8}}>
        {mail&&item.unread?<View accessibilityLabel="Unread" style={{width:7,height:7,borderRadius:4,backgroundColor:colors.primary,marginTop:8}}/>:null}
        <Text selectable style={{color:colors.textPrimary,fontSize:mail?16:17,lineHeight:24,fontWeight:mail&&item.unread?'700':'600',flex:1}}>{mail&&item.subtitle?item.subtitle:item.title}</Text>
      </View>
      {mail&&item.subtitle?<Text selectable style={{color:colors.textPrimary,fontSize:17,lineHeight:24}}>{item.title}</Text>:null}
      {!mail&&item.subtitle?<View style={{alignSelf:'flex-start',paddingHorizontal:issue?8:0,paddingVertical:issue?4:0,borderRadius:6,backgroundColor:issue?colors.primarySubtle:'transparent'}}><Text selectable style={{color:issue?colors.textLink:colors.textSecondary,fontSize:14,lineHeight:21}}>{item.subtitle}</Text></View>:null}
      {item.body?<Text selectable numberOfLines={all?undefined:4} style={{color:colors.textSecondary,fontSize:15,lineHeight:23}}>{item.body}</Text>:null}
      {item.timestamp?<Text style={{color:colors.textSecondary,fontSize:13,lineHeight:20}}>{preview.kind==='cards'?'Due ':''}{timestamp(item.timestamp)}</Text>:null}
      {item.hasAttachments?<Text style={{color:colors.textSecondary,fontSize:13}}>Contains attachments</Text>:null}
      {item.labels?.length?<View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{item.labels.map((label,i)=><Text key={i} style={{color:colors.textPrimary,backgroundColor:colors.surfaceMuted,borderRadius:6,padding:6,fontSize:13}}>{label}</Text>)}</View>:null}
      {item.metrics?.length?<Text style={{color:colors.textSecondary,fontSize:13,lineHeight:20}}>{item.metrics.map(m=>`${m.value} ${m.label.toLowerCase()}`).join(' · ')}</Text>:null}
      {item.url?<Pressable accessibilityRole="link" style={{minHeight:44,justifyContent:'center'}} onPress={()=>{void Linking.openURL(item.url!).catch(()=>onError('The original item could not open. Try again.'));}}><Text style={{color:colors.textLink,fontSize:15,fontWeight:'500'}}>View {mail?'email':discussion?'on Reddit':issue?'issue':preview.kind==='pages'?'page':preview.kind==='events'?'event':'original'} ↗</Text></Pressable>:null}
    </View>)}
    {preview.items.length>3?<Pressable accessibilityRole="button" aria-expanded={all} accessibilityState={{expanded:all}} onPress={()=>setAll(value=>!value)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.textLink,fontSize:15}}>{all?'Show fewer':`View all ${preview.items.length} returned items`}</Text></Pressable>:null}
  </View>;
}
