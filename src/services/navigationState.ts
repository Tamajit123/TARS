import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from '@/lib/supabase';

const destinations={chat:'/(tabs)/chat',feed:'/(tabs)/feed',ideas:'/(tabs)/ideas',tasks:'/(tabs)/tasks',settings:'/(tabs)/settings',connections:'/tools'} as const;
type Destination=keyof typeof destinations;
const tabKey=(owner:string)=>`tars:last-tab:v1:${owner}`;
const threadKey=(owner:string)=>`tars:last-conversation:v1:${owner}`;
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
let writes:Promise<unknown>=Promise.resolve();
const serialize=(work:()=>Promise<void>)=>{const next=writes.then(work,work);writes=next.catch(()=>{});return next;};

export function rememberScreen(owner:string,path:string){
  const part=path.replace('/(tabs)','').replace(/\/$/,'');
  const tab:Destination|undefined=part==='/tools'? 'connections':(['chat','feed','ideas','tasks','settings'] as const).find(value=>part===`/${value}`);
  return owner&&tab?serialize(()=>AsyncStorage.setItem(tabKey(owner),tab)):Promise.resolve();
}
export function rememberConversation(owner:string,id:string){
  if(!owner||!uuid(id))return Promise.resolve();
  return serialize(()=>AsyncStorage.setItem(threadKey(owner),id));
}
export function forgetConversation(owner:string){return serialize(()=>AsyncStorage.removeItem(threadKey(owner)));}
export async function restoreDestination(owner:string){
  const clean={pathname:'/(tabs)/chat',params:{clean:'1'}} as const;
  if(!owner)return clean;
  try {
    await writes;
    const tab=await AsyncStorage.getItem(tabKey(owner));
    if(tab&&Object.hasOwn(destinations,tab)&&tab!=='chat')return destinations[tab as Destination];
    const id=await AsyncStorage.getItem(threadKey(owner));
    if(!uuid(id))return clean;
    const {data,error}=await supabase.from('chat_threads').select('id').eq('id',id).eq('user_id',owner).maybeSingle();
    if(error||!data){await forgetConversation(owner);return clean;}
    return {pathname:'/(tabs)/chat',params:{thread_id:data.id}} as const;
  } catch {return clean;}
}
