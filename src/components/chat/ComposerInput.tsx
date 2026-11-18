import {useEffect,useState} from 'react';
import {Platform,TextInput,type TextInputProps,type TextStyle} from 'react-native';
import {useAppTheme} from '@/context/ThemeContext';
/** Keep sizing local. Return inserts a newline; only Send submits the draft. */
export function ComposerInput({value,style,...props}:TextInputProps){
  const [height,setHeight]=useState(40);
  const {resolved}=useAppTheme();
  const browserStyle=Platform.OS==='web'?{outlineWidth:0,colorScheme:resolved,scrollbarWidth:'thin'} as TextStyle:undefined;
  useEffect(()=>{if(!value)setHeight(40);},[value]);
  return <TextInput {...props} value={value} multiline blurOnSubmit={false} submitBehavior="newline" style={[style,browserStyle,{height}]} onContentSizeChange={event=>setHeight(Math.max(40,Math.min(112,event.nativeEvent.contentSize.height)))}/>;
}
