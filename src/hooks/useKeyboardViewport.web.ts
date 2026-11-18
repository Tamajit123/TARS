import {useEffect,useState} from 'react';
import {keyboardViewport} from '@/lib/keyboardViewport';
export function useKeyboardViewport(){
  const [state,setState]=useState({open:false,bottom:0});
  useEffect(()=>{
    const viewport=window.visualViewport;let frame=0;
    const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const target=document.activeElement;const editing=target instanceof HTMLTextAreaElement||target instanceof HTMLInputElement||target?.getAttribute('contenteditable')==='true';const next=keyboardViewport(Math.max(document.documentElement.clientHeight,window.innerHeight),viewport?.height||window.innerHeight,viewport?.offsetTop||0,viewport?.scale||1,Boolean(editing));setState(old=>old.open===next.open&&old.bottom===next.bottom?old:next);});};
    viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);document.addEventListener('focusin',update);document.addEventListener('focusout',update);update();
    return()=>{cancelAnimationFrame(frame);viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);document.removeEventListener('focusin',update);document.removeEventListener('focusout',update);};
  },[]);
  return state;
}
