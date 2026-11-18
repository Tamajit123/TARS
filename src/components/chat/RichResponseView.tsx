import {useState} from 'react';
import {Image,Linking,ScrollView,Text,View} from 'react-native';
import {MotionPressable as Pressable} from '@/components/common/MotionPressable';
import {NativeIcon} from '@/components/common/NativeIcon';
import {Link02Icon} from '@/constants/icons';
import {useAppTheme} from '@/context/ThemeContext';
import {RouteCard} from './RouteCard';
import {AssistantText} from './AssistantText';
import {safeResultUrl,type RichResponse,type RichBlock,type RichItem,type Source} from '../../../supabase/functions/_shared/richResponse';

/** The registry chooses native layouts, never HTML or model-supplied components. */
export const resultLayouts={text:'prose',flight_list:'travel',hotel_list:'travel',vehicle_list:'travel',product_list:'offer',business_list:'place',restaurant_list:'place',job_list:'collection',property_list:'offer',subscription_comparison:'comparison',insurance_comparison:'comparison',comparison_table:'comparison',research_summary:'research',source_list:'sources',news_list:'research',map:'place',chart:'comparison',weather:'collection',event_list:'collection',email_summary:'collection',calendar_events:'collection',action_card:'collection',generic_collection:'collection'} as const;
function SourceAttribution({source}:{source:Source}){
  const {colors}=useAppTheme();
  const label=source.url?new URL(source.url).hostname.replace(/^www\./,''):source.provider;
  const [failed,setFailed]=useState(false);
  return <View><Pressable disabled={!source.url} accessibilityRole={source.url?'link':'text'} accessibilityLabel={'Source: '+source.title} onPress={()=>{const url=safeResultUrl(source.url);if(url)void Linking.openURL(url).catch(()=>setFailed(true));}} style={{minHeight:44,justifyContent:'center',alignSelf:'flex-start'}}><Text style={{color:colors.textLink,fontSize:13,lineHeight:20}}>{label}{source.url?' ↗':''} · {source.cached?'Cached · ':''}{new Date(source.retrievedAt).toLocaleDateString()}</Text></Pressable>{failed?<Text accessibilityRole="alert" style={{color:colors.textSecondary}}>Could not open this source. Try again.</Text>:null}</View>;
}
function ResultCard({item,source,primary,kind}:{item:RichItem;source:Source;primary:boolean;kind:string}){
  const {colors}=useAppTheme();const [expanded,setExpanded]=useState(false),[imageFailed,setImageFailed]=useState(false);
  return <View style={{paddingVertical:18,borderBottomWidth:0.5,borderColor:colors.border,gap:8}}>
    <View style={{flexDirection:'row',gap:14,alignItems:'flex-start'}}>
      {item.image&&!imageFailed?<Image source={{uri:item.image}} accessibilityLabel={item.title} onError={()=>setImageFailed(true)} resizeMode="cover" style={{width:72,height:72,borderRadius:14,backgroundColor:colors.surfaceMuted}}/>:null}
      <View style={{flex:1,minWidth:0,gap:7}}><Text selectable style={{color:colors.textPrimary,fontSize:primary?22:18,lineHeight:primary?29:25,fontWeight:'600'}}>{item.title}</Text>{item.description?<Text selectable style={{color:colors.textSecondary,fontSize:15,lineHeight:23}}>{item.description}</Text>:null}</View>
    </View>
    {item.price?<View><Text selectable style={{color:colors.textPrimary,fontSize:primary?30:24,lineHeight:38,fontWeight:'600'}}>{item.price.value}</Text><Text style={{color:colors.textSecondary,fontSize:13,lineHeight:20}}>{item.price.basis==='estimated'?'Estimated price':'Listed price'} · verify on the original site</Text></View>:null}
    {(expanded?item.fields:item.fields.slice(0,4)).map((field,index)=><View key={index} style={{flexDirection:'row',flexWrap:'wrap',gap:6}}><Text style={{color:colors.textSecondary,fontSize:15,lineHeight:23}}>{field.label}</Text><Text selectable style={{color:colors.textPrimary,fontSize:15,lineHeight:23,flexShrink:1}}>{field.value}</Text></View>)}
    {item.fields.length>4?<Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(!expanded)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.textLink,fontSize:15}}>{expanded?'Show less':'Show all details'}</Text></Pressable>:null}
    <SourceAttribution source={source}/>
    {source.url?<ResultAction source={source} label={item.price?'Check listed price':kind==='job_list'?'View original job':item.actionLabel||'View source'}/>:null}
  </View>;
}
function ResultAction({source,label}:{source:Source;label:string}){
  const {colors}=useAppTheme();const [failed,setFailed]=useState(false);
  return <View><Pressable accessibilityRole="link" onPress={()=>{const url=safeResultUrl(source.url);if(url)void Linking.openURL(url).catch(()=>setFailed(true));}} style={{minHeight:48,paddingHorizontal:18,paddingVertical:12,borderRadius:24,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',backgroundColor:colors.primary}}><Text style={{color:colors.onPrimary,fontSize:16,lineHeight:22,fontWeight:'600'}}>{label}</Text><NativeIcon symbol="arrow.up.right.square" fallback={Link02Icon} size={18} color={colors.onPrimary}/></Pressable>{failed?<Text accessibilityRole="alert" style={{color:colors.textSecondary}}>The source could not open. Try again.</Text>:null}</View>;
}
function ComparisonTable({block,sources}:{block:RichBlock;sources:Map<string,Source>}){
  const {colors}=useAppTheme();
  return <ScrollView horizontal accessibilityLabel="Comparison table, scroll horizontally for more columns" style={{maxWidth:'100%'}}><View>{block.columns?.length?<View style={{flexDirection:'row',backgroundColor:colors.surfaceMuted}}>{block.columns.map((label,i)=><Text key={i} style={{width:160,padding:12,color:colors.textPrimary,fontSize:15,fontWeight:'600'}}>{label}</Text>)}</View>:null}{block.rows?.map((row,index)=><View key={index} style={{flexDirection:'row',borderBottomWidth:0.5,borderColor:colors.border}}>{row.map((field,i)=><View key={i} style={{width:160,padding:12}}><Text selectable style={{color:colors.textPrimary,fontSize:15,lineHeight:23}}>{field.value}</Text>{sources.get(field.sourceId)?<SourceAttribution source={sources.get(field.sourceId)!}/>:null}</View>)}</View>)}</View></ScrollView>;
}
function ChartResultCard({block,sources}:{block:RichBlock;sources:Map<string,Source>}){
  const {colors}=useAppTheme();
  const points=(block.rows||[]).flatMap(row=>{const value=row.at(-1);if(!value||!/^[-+]?\d+(?:\.\d+)?$/.test(value.value))return [];return [{label:row[0]?.value||value.label,value:Number(value.value),field:value}];});
  const max=Math.max(1,...points.map(point=>Math.abs(point.value)));
  if(!points.length)return <ComparisonTable block={block} sources={sources}/>;
  return <View accessibilityLabel="Chart with source-backed values" style={{gap:16}}>{points.map((point,index)=><View key={index}><Text selectable style={{color:colors.textPrimary,fontSize:16,lineHeight:24}}>{point.label}: {point.field.value}</Text><View style={{height:8,backgroundColor:colors.surfaceMuted,borderRadius:4,marginVertical:8}}><View style={{height:8,width:`${Math.abs(point.value)/max*100}%`,backgroundColor:colors.primary,borderRadius:4}}/></View>{sources.get(point.field.sourceId)?<SourceAttribution source={sources.get(point.field.sourceId)!}/>:null}</View>)}</View>;
}
function ResponseBlock({block,sources}:{block:RichBlock;sources:Map<string,Source>}){
  const {colors}=useAppTheme();const [count,setCount]=useState(5),[error,setError]=useState('');
  return <View style={{gap:8,marginTop:20}}>{block.title?<Text accessibilityRole="header" style={{color:colors.textPrimary,fontSize:20,fontWeight:'600',lineHeight:28}}>{block.title}</Text>:null}
    {block.text?<AssistantText text={block.text} color={colors.textPrimary} linkColor={colors.textLink}/>:null}
    {block.route?<RouteCard route={block.route} onError={setError}/>:null}{error?<Text accessibilityRole="alert" style={{color:colors.textSecondary}}>{error}</Text>:null}
    {block.rows?.length?block.type==='chart'?<ChartResultCard block={block} sources={sources}/>:<ComparisonTable block={block} sources={sources}/>:null}
    {block.items?.slice(0,count).map((item,index)=>sources.has(item.sourceId)?<ResultCard key={index} item={item} source={sources.get(item.sourceId)!} primary={index===0} kind={block.type}/>:null)}
    {block.items&&block.items.length>count?<Pressable accessibilityRole="button" onPress={()=>setCount(count+5)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:colors.textLink}}>Show more results</Text></Pressable>:null}
    {block.type==='source_list'?[...sources.values()].map(source=><View key={source.id}><Text style={{color:colors.textPrimary,fontSize:16,lineHeight:24}}>{source.title}</Text><SourceAttribution source={source}/></View>):null}
  </View>;
}
export function RichResponseView({response}:{response:RichResponse}){
  const {colors}=useAppTheme();const sources=new Map(response.sources.map(source=>[source.id,source]));
  return <View style={{gap:12,minWidth:0,maxWidth:'100%'}}>
    {response.title?<Text accessibilityRole="header" selectable style={{color:colors.textPrimary,fontSize:23,lineHeight:31,fontWeight:'600'}}>{response.title}</Text>:null}
    <AssistantText text={response.summary} color={colors.textPrimary} linkColor={colors.textLink}/>
    {response.status==='no_results'?<Text style={{color:colors.textSecondary,fontSize:15,lineHeight:23}}>No verified results were returned. Try a more specific query or another source.</Text>:null}
    {response.blocks.map((block,index)=><ResponseBlock key={index} block={block} sources={sources}/>)}
    {response.limitations.map((text,index)=><Text key={index} selectable style={{color:colors.textSecondary,fontSize:13,lineHeight:21}}>{text}</Text>)}
    {response.sources.length&&!response.blocks.some(block=>block.type==='source_list')?<View style={{borderTopWidth:0.5,borderColor:colors.border,paddingTop:12}}><Text style={{color:colors.textSecondary,fontSize:13}}>Sources · checked {new Date(response.retrievedAt).toLocaleString()}</Text>{response.sources.map(source=><SourceAttribution key={source.id} source={source}/>)}</View>:null}
  </View>;
}
