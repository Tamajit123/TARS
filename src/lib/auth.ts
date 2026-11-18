import { supabase } from '@/lib/supabase';
import * as Crypto from 'expo-crypto';
import { commitAvatar } from './avatarPersistence';

export async function provisionProfile(userId: string, displayName = '') {
  const { data: profile, error: readError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (readError) throw readError;
  if (profile) return profile;

  const { error: insertError } = await supabase
    .from('profiles')
    .upsert({ id: userId, name: displayName.trim() }, { onConflict: 'id', ignoreDuplicates: true });
  if (insertError) throw insertError;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function uploadAvatar(userId: string, base64: string, mimeType: string) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(mimeType)) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (base64.length > 7_000_000) throw new Error('Choose an image smaller than 5 MB.');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.');

  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
  const path = `${userId}/${Crypto.randomUUID()}.${extension}`;
  return commitAvatar(path, {
    upload: async () => {
      const { error } = await supabase.storage.from('tars-avatars').upload(path, bytes.buffer, { contentType: mimeType, cacheControl: '3600', upsert: false });
      if (error) throw error;
    },
    signedUrl: async () => { const url = await getAvatarUrl(path); if (!url) throw new Error('The uploaded photo could not be opened.'); return url; },
    updateProfile: async () => {
      const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId).select('id').single();
      if (error) throw error;
    },
    referenced: async () => {
      const { data, error } = await supabase.from('profiles').select('avatar_path').eq('id', userId).single();
      if (error) throw error;
      return data.avatar_path === path;
    },
    remove: async () => { const { error } = await supabase.storage.from('tars-avatars').remove([path]); if (error) throw error; },
  });
}

export async function getAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('tars-avatars').createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
