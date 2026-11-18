import {useEffect,useRef,useState,type ReactNode} from 'react';

import Animated,{useAnimatedStyle,useSharedValue,withTiming,Easing} from 'react-native-reanimated';

import {useMotionPreferences} from '@/context/MotionContext';

import {AppState,Image,Linking,Platform,Pressable,ScrollView,Text,TextInput,View} from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import {File} from 'expo-file-system';

import {useAudioRecorder,useAudioRecorderState,useAudioPlayer,useAudioPlayerStatus,RecordingPresets,AudioModule,setAudioModeAsync} from 'expo-audio';

import {AccessibleModal as Modal} from '@/components/common/AccessibleModal';

import {KeyboardFormLayout} from '@/components/common/KeyboardFormLayout';

import {NativeIcon} from '@/components/common/NativeIcon';

import {Add01Icon,Mic01Icon} from '@/constants/icons';

import {useAppTheme} from '@/context/ThemeContext';

import {selectionFeedback} from '@/lib/haptics';

import {makeAttachment,type AttachmentDraft} from '@/services/attachments';



export function AudioPreview({uri}:{uri:string}){

  const player=useAudioPlayer(uri),state=useAudioPlayerStatus(player),{colors}=useAppTheme();
  const [error,setError]=useState('');const starting=useRef(false);
  const toggle=async()=>{if(starting.current)return;starting.current=true;setError('');try{if(state.playing)player.pause();else{await setAudioModeAsync({playsInSilentMode:true,allowsRecording:false});if(state.didJustFinish)await player.seekTo(0);player.play();}}catch{setError('Audio could not play. Check the connection and try again.');}finally{starting.current=false;}};
  return <Pressable accessibilityRole="button" accessibilityLabel={error?'Retry audio playback':state.playing?'Pause audio':'Play audio'} onPress={()=>void toggle()} style={{minHeight:44,justifyContent:'center'}}><Text accessibilityRole={error?'alert':undefined} numberOfLines={2} style={{color:error?colors.error:colors.textLink,fontSize:15,lineHeight:20}}>{error?'Playback unavailable. Tap to retry.':`${state.playing?'Pause':'Play'} · ${Math.round(state.currentTime)} / ${Math.round(state.duration||0)} sec`}</Text></Pressable>;

}

function RecordingBar({level}:{level:number}){
  const {colors}=useAppTheme(),{reducedMotion}=useMotionPreferences();const value=useSharedValue(0.06);
  useEffect(()=>{const next=Math.max(0.06,level);value.set(reducedMotion?next:withTiming(next,{duration:120,easing:Easing.bezier(0.23,1,0.32,1)}));},[level,reducedMotion,value]);
  const motion=useAnimatedStyle(()=>({transform:[{scaleY:value.get()}]}));
  return <Animated.View style={[{width:4,height:32,borderRadius:2,backgroundColor:colors.primary},motion]}/>;
}

function RecordingLevel({level}:{level:number}){
  const [samples,setSamples]=useState<number[]>(()=>Array(24).fill(0));
  // Samples arrive with actual recorder metering, never a synthetic animation loop.
  useEffect(()=>{const next=Number.isFinite(level)?Math.min(1,Math.max(0,(level+60)/60)):0;setSamples(previous=>[...previous.slice(1),next]);},[level]);
  return <View accessibilityLabel={`Live microphone level ${Math.round(level)} decibels`} style={{height:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,marginVertical:12}}>{samples.map((sample,index)=><RecordingBar key={index} level={sample}/>)}</View>;
}

export function ComposerMedia({onAdd,disabled,onError,onLocation,children}:{onAdd:(drafts:AttachmentDraft[])=>boolean|void;disabled:boolean;onError:(message:string)=>void;onLocation?:(origin:string)=>void;children?:(buttons:{attachmentButton:ReactNode;voiceButton:ReactNode})=>ReactNode}){

  const {colors}=useAppTheme();

  const [menu,setMenu]=useState(false),[longText,setLongText]=useState<string|null>(null),[cameraPreview,setCameraPreview]=useState<AttachmentDraft|null>(null),[permissionHelp,setPermissionHelp]=useState('');

  const [recordOpen,setRecordOpen]=useState(false),[started,setStarted]=useState(false),[preview,setPreview]=useState<AttachmentDraft|null>(null),[busy,setBusy]=useState(false),[recordError,setRecordError]=useState('');

  const recorder=useAudioRecorder({...RecordingPresets.HIGH_QUALITY,isMeteringEnabled:true}),record=useAudioRecorderState(recorder,150);

  const finishLock=useRef(false),startLock=useRef(false), recording=useRef(false), duration=useRef(0);

  useEffect(()=>{duration.current=record.durationMillis;},[record.durationMillis]);

  useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state!=='active'&&recording.current){try{recorder.pause();setRecordError('Recording paused when TARS left the foreground. Resume or finish it.');}catch{setRecordError('Recording was interrupted. Try Stop and preview to recover the saved audio.');}}});return()=>{listener.remove();if(recording.current)void setAudioModeAsync({allowsRecording:false}).catch(()=>{});};},[recorder]);

  const finish=async()=>{

    if(finishLock.current)return;finishLock.current=true;setBusy(true);

    try{await recorder.stop();recording.current=false;await setAudioModeAsync({allowsRecording:false});if(!recorder.uri)throw new Error('No recording was saved.');const draft=await makeAttachment({name:Platform.OS==='web'?'Voice message.webm':'Voice message.m4a',uri:recorder.uri,durationMs:Math.round(duration.current)});setPreview(draft);setStarted(false);}

    catch{setRecordError('The recording could not be saved. Cancel and try again.');}

    finally{finishLock.current=false;setBusy(false);}

  };

  useEffect(()=>{if(record.durationMillis>=299000&&recording.current&&!finishLock.current)void finish();});

  const begin=async()=>{

    if(busy||startLock.current)return;startLock.current=true;setBusy(true);setRecordError('');

    try{let p=await AudioModule.getRecordingPermissionsAsync();if(!p.granted&&p.canAskAgain)p=await AudioModule.requestRecordingPermissionsAsync();if(!p.granted){setPermissionHelp('Microphone access is off. Enable TARS microphone access in Settings to record voice messages.');return;}await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true,allowsBackgroundRecording:false});await recorder.prepareToRecordAsync();recorder.record({forDuration:300});recording.current=true;setStarted(true);selectionFeedback();}

    catch{setRecordError('Recording could not start. Check microphone access and try again.');}finally{startLock.current=false;setBusy(false);}

  };

  const cancel=async()=>{if(busy)return;setBusy(true);try{if(recording.current)await recorder.stop();recording.current=false;await setAudioModeAsync({allowsRecording:false});const uri=preview?.uri||recorder.uri;if(Platform.OS!=='web'&&uri){try{new File(uri).delete();}catch{ /* OS cache cleanup can retry later. */ }}setStarted(false);setPreview(null);setRecordOpen(false);}catch{setRecordError('Recording could not stop. Try again before leaving this screen.');}finally{setBusy(false);}};

  const pick=async(kind:'camera'|'photos'|'files')=>{

    setMenu(false);

    try{

      if(kind==='files'){const result=await DocumentPicker.getDocumentAsync({multiple:true,copyToCacheDirectory:true});if(!result.canceled)onAdd(await Promise.all(result.assets.map(a=>makeAttachment({name:a.name,uri:a.uri,mime:a.mimeType,size:a.size,blob:a.file}))));return;}

      if(kind==='camera'){let p=await ImagePicker.getCameraPermissionsAsync();if(!p.granted&&p.canAskAgain)p=await ImagePicker.requestCameraPermissionsAsync();if(!p.granted){setPermissionHelp('Camera access is off. Enable TARS camera access in Settings to photograph a document.');return;}}

      const options:ImagePicker.ImagePickerOptions={mediaTypes:['images'],quality:0.85,allowsMultipleSelection:kind==='photos',selectionLimit:4,preferredAssetRepresentationMode:ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible};

      const result=kind==='camera'?await ImagePicker.launchCameraAsync(options):await ImagePicker.launchImageLibraryAsync(options);

      if(!result.canceled){const drafts=await Promise.all(result.assets.map(a=>makeAttachment({name:a.fileName?.replace(/\.[^.]+$/,a.mimeType==='image/png'?'.png':a.mimeType==='image/webp'?'.webp':'.jpg')||`Photo.${a.mimeType==='image/png'?'png':'jpg'}`,uri:a.uri,mime:a.mimeType,size:a.fileSize,blob:a.file})));if(kind==='camera')setCameraPreview(drafts[0]);else onAdd(drafts);}

    }catch(error){onError(error instanceof Error?error.message:'The attachment could not be opened.');}

  };
  const shareLocation=async()=>{setMenu(false);try{let p=await Location.getForegroundPermissionsAsync();if(!p.granted&&p.canAskAgain)p=await Location.requestForegroundPermissionsAsync();if(!p.granted){setPermissionHelp('Location access is off. Enter a starting address manually, or enable TARS location access in Settings.');return;}const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});onLocation?.(`${position.coords.latitude.toFixed(5)},${position.coords.longitude.toFixed(5)}`);}catch{onError('Location could not be obtained. Enter a starting address manually.');}};

  const action=(title:string,run:()=>void)=><Pressable key={title} accessibilityRole="button" onPress={run} style={{minHeight:52,paddingHorizontal:18,justifyContent:'center',borderBottomWidth:0.5,borderColor:colors.border}}><Text style={{color:colors.textPrimary,fontSize:17}}>{title}</Text></Pressable>;

  const shell={backgroundColor:colors.surfaceElevated,borderTopLeftRadius:24,borderTopRightRadius:24,padding:20};

  const button={minWidth:44,minHeight:44,alignItems:'center' as const,justifyContent:'center' as const};

  const attachmentButton=<Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel="Add attachment" onPress={()=>setMenu(true)} style={button}><NativeIcon symbol="plus" fallback={Add01Icon} size={23} color={colors.textPrimary}/></Pressable>;

  const voiceButton=<Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel="Record voice message" onPress={()=>{setRecordError('');setRecordOpen(true);}} style={button}><NativeIcon symbol="mic" fallback={Mic01Icon} size={22} color={colors.textPrimary}/></Pressable>;

  return <>

    {children?children({attachmentButton,voiceButton}):<>{attachmentButton}{voiceButton}</>}

    <Modal visible={menu} transparent animationType="slide" onRequestClose={()=>setMenu(false)}><View style={{flex:1,justifyContent:'flex-end',backgroundColor:colors.overlay}}><View style={shell}><Text accessibilityRole="header" style={{color:colors.textPrimary,fontSize:20,fontWeight:'600',marginBottom:12}}>Add to your message</Text>{action('Camera',()=>void pick('camera'))}{action('Photos',()=>void pick('photos'))}{action('Files',()=>void pick('files'))}{action('Long text',()=>{setMenu(false);setLongText('');})}{onLocation?action('Use current location',()=>void shareLocation()):null}{action('Cancel',()=>setMenu(false))}<Text style={{color:colors.textSecondary,fontSize:13,lineHeight:20,marginTop:12}}>Up to 4 files, 10 MB each, 20 MB total. Selected content is uploaded privately and sent to Gemini when you send. Current location is obtained once and added to your draft for review; you can enter an address instead.</Text></View></View></Modal>

    <Modal visible={longText!==null} transparent animationType="slide" onRequestClose={()=>setLongText(null)}><KeyboardFormLayout onDismiss={()=>setLongText(null)} backdropStyle={{backgroundColor:colors.overlay}} cardStyle={shell} footer={<View style={{flexDirection:'row',gap:20}}>{action('Cancel',()=>setLongText(null))}{action('Attach text',()=>{const text=longText||'';if(!text.trim()){onError('Add text before attaching.');return;}if(text.length>120000){onError('Split text longer than 120,000 characters. Nothing was truncated.');return;}const blob=new Blob([text],{type:'text/plain'});void makeAttachment({name:'Pasted text.txt',uri:'',blob,size:blob.size}).then(draft=>{if(onAdd([draft])!==false)setLongText(null);}).catch(e=>onError(e.message));})}</View>}><Text style={{color:colors.textPrimary,fontSize:22,fontWeight:'600'}}>Long text</Text><Text style={{color:colors.textSecondary,marginVertical:12}}>{(longText||'').length.toLocaleString()} characters · kept in full</Text><TextInput accessibilityLabel="Long text attachment" value={longText||''} onChangeText={setLongText} multiline style={{minHeight:180,color:colors.textPrimary,fontSize:17,textAlignVertical:'top'}}/></KeyboardFormLayout></Modal>

    <Modal visible={Boolean(cameraPreview)} transparent animationType="slide" onRequestClose={()=>setCameraPreview(null)}><View style={{flex:1,backgroundColor:colors.background,padding:24,justifyContent:'center'}}>{cameraPreview?<Image source={{uri:cameraPreview.uri}} resizeMode="contain" style={{flex:1}}/>:null}{action('Use photo',()=>{if(cameraPreview&&onAdd([cameraPreview])!==false)setCameraPreview(null);})}{action('Retake',()=>{setCameraPreview(null);void pick('camera');})}{action('Cancel',()=>setCameraPreview(null))}</View></Modal>

    <Modal visible={recordOpen} transparent animationType="slide" onRequestClose={()=>{void cancel();}}>

      <View style={{flex:1,justifyContent:'flex-end',backgroundColor:colors.overlay}}><View style={shell}>

        <Text accessibilityRole="header" style={{color:colors.textPrimary,fontSize:24,fontWeight:'600'}}>Voice message</Text>

        <Text style={{color:colors.textSecondary,fontSize:15,lineHeight:22,marginVertical:14}}>TARS records only after you tap Start. Preview before sending. Maximum 5 minutes.</Text>

        {preview?<><AudioPreview uri={preview.uri}/>{action('Use voice message',()=>{if(onAdd([preview])!==false){setPreview(null);setRecordOpen(false);}})}</>:started?<>

          <Text accessibilityLiveRegion="polite" style={{color:colors.textPrimary,fontSize:28,fontVariant:['tabular-nums']}}>{Math.floor(record.durationMillis/60000)}:{String(Math.floor(record.durationMillis/1000)%60).padStart(2,'0')}</Text>

          {record.metering!==undefined?<RecordingLevel level={record.metering}/>:<Text style={{color:colors.textSecondary}}>Recording audio</Text>}

          {action(record.isRecording?'Pause':'Resume',()=>{try{if(record.isRecording)recorder.pause();else recorder.record({forDuration:Math.max(1,300-duration.current/1000)});}catch{setRecordError('Recording could not resume. Try Stop and preview to recover the saved audio.');}})}

          {action(busy?'Saving…':'Stop and preview',()=>{if(!busy)void finish();})}

        </>:action(busy?'Starting…':'Start recording',()=>void begin())}

        {recordError?<Text accessibilityRole="alert" style={{color:colors.error,fontSize:15,lineHeight:22}}>{recordError}</Text>:null}

        {action('Cancel',()=>void cancel())}

      </View></View>

    </Modal>

    <Modal visible={Boolean(permissionHelp)} transparent animationType="fade" onRequestClose={()=>setPermissionHelp('')}><View style={{flex:1,justifyContent:'center',backgroundColor:colors.overlay,padding:24}}><View style={shell}><Text style={{color:colors.textPrimary,fontSize:17,lineHeight:25}}>{permissionHelp}</Text>{Platform.OS!=='web'?action('Open Settings',()=>{void Linking.openSettings();setPermissionHelp('');}):null}{action('Close',()=>setPermissionHelp(''))}</View></View></Modal>

  </>;

}

export function DraftAttachments({drafts,onRemove,onRetry,onCancel}:{drafts:AttachmentDraft[];onRemove:(id:string)=>void;onRetry:(id:string)=>void;onCancel:()=>void}){

  const {colors}=useAppTheme();

  return <ScrollView horizontal style={{height:drafts.some(d=>d.error)?216:176,flexGrow:0}} contentContainerStyle={{gap:10,paddingBottom:10,alignItems:'flex-start'}}>{drafts.map(d=><View key={d.id} style={{width:190,flexShrink:0,gap:3,borderRadius:14,borderWidth:0.5,borderColor:colors.border,padding:12,backgroundColor:colors.surfaceMuted}}>{d.mime.startsWith('image/')?<Image source={{uri:d.uri}} style={{height:42,width:42,borderRadius:6,flexShrink:0}}/>:null}<Text numberOfLines={1} style={{color:colors.textPrimary,fontSize:15,lineHeight:20,flexShrink:0}}>{d.name}</Text><Text style={{color:colors.textSecondary,fontSize:12,lineHeight:16,flexShrink:0}}>{Math.ceil(d.size/1024)} KB · {d.status==='uploading'?`${Math.round(d.progress*100)}% uploaded`:d.status}</Text>{d.mime.startsWith('audio/')?<AudioPreview uri={d.uri}/>:null}{d.error?<Text numberOfLines={2} style={{color:colors.error,fontSize:12}}>{d.error}</Text>:null}<View style={{flexDirection:'row',gap:12,flexShrink:0}}>{d.status==='uploading'?<Pressable onPress={onCancel} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.textLink}}>Cancel upload</Text></Pressable>:<><Pressable accessibilityLabel={`Remove ${d.name}`} onPress={()=>onRemove(d.id)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.textLink}}>Remove</Text></Pressable>{d.status==='failed'?<Pressable onPress={()=>onRetry(d.id)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.textLink}}>Retry</Text></Pressable>:null}</>}</View></View>)}</ScrollView>;

}
