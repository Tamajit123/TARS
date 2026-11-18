import {useEffect,useState} from 'react';
import {Platform} from 'react-native';
import {usePathname} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {rememberScreen} from '@/services/navigationState';

/** Persist only known product destinations, never auth, loading or error payloads. */
export function NavigationPersistence(){
  const path=usePathname();const [owner,setOwner]=useState('');
  useEffect(()=>{
    // Never retain a callback URL or one-use authorization code in the tab title.
    if(Platform.OS==='web'&&typeof document!=='undefined')document.title='TARS';
  },[path]);
  useEffect(()=>{
    let active=true,observed=false;
    const auth=supabase.auth.onAuthStateChange((_event,session)=>{observed=true;if(active)setOwner(session?.user.id||'');});
    void supabase.auth.getSession().then(({data})=>{if(active&&!observed)setOwner(data.session?.user.id||'');}).catch(()=>{});
    return()=>{active=false;auth.data.subscription.unsubscribe();};
  },[]);
  useEffect(()=>{if(owner)void rememberScreen(owner,path).catch(()=>{});},[owner,path]);
  return null;
}
