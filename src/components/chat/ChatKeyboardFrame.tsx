import {useRef,useState,type ComponentRef,type ReactNode} from 'react';
import {KeyboardAvoidingView,Platform,View} from 'react-native';
export function ChatKeyboardFrame({children}:{children:ReactNode}){
  const frame=useRef<ComponentRef<typeof View>>(null),[top,setTop]=useState(0);
  return <View ref={frame} onLayout={()=>frame.current?.measureInWindow((_x,y)=>setTop(previous=>Math.abs(previous-y)>1?y:previous))} style={{flex:1,minHeight:0}}><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={top} style={{flex:1,minHeight:0}}>{children}</KeyboardAvoidingView></View>;
}
