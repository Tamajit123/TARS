import {composioAPI} from './connections.ts';
/** Operator-only setup. Existing provider configurations are never modified. */
export async function ensureMapsAuthConfig(){
  const configs=await composioAPI('auth_configs?limit=100');
  const existing=configs.items?.find((item:Record<string,any>)=>item.toolkit?.slug==='google_maps'&&!item.is_disabled&&item.is_enabled!==false);
  if(existing)return existing.id as string;
  const created=await composioAPI('auth_configs','POST',{toolkit:{slug:'google_maps'},auth_config:{type:'use_composio_managed_auth',credentials:{}}});
  if(typeof created.auth_config?.id!=='string')throw new Error('Maps auth configuration was not confirmed.');
  return created.auth_config.id as string;
}
