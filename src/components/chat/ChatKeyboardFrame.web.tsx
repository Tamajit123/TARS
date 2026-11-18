import {useRef,type ComponentRef,type ReactNode} from 'react';
import {View} from 'react-native';
import {useKeyboardViewport} from '@/hooks/useKeyboardViewport';
/** Mobile Safari/Chrome keep the layout viewport tall while the keyboard overlays it. */
export function ChatKeyboardFrame({children}:{children:ReactNode}){
  const frame=useRef<ComponentRef<typeof View>>(null),viewport=useKeyboardViewport();
  const top=useRef(0);
  return <View ref={frame} onLayout={()=>frame.current?.measureInWindow((_x,y)=>{top.current=y;})} style={viewport.open?{height:Math.max(120,viewport.bottom-top.current),flexShrink:0,minHeight:0}:{flex:1,minHeight:0}}>{children}</View>;
}
