import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkColors, LightColors, type ColorPalette } from '@/constants/colors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';
type ThemeState = { colors: ColorPalette; preference: ThemePreference; resolved: 'light' | 'dark'; busy: boolean; setPreference: (value: ThemePreference) => Promise<void> };
const ThemeContext = createContext<ThemeState | null>(null);
const valid = (value: unknown): value is ThemePreference => value === 'system' || value === 'light' || value === 'dark';
const keyFor = (id: string | null) => `tars:theme:${id || 'offline'}`;

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, applyPreference] = useState<ThemePreference>('system');
  const [busy, setBusy] = useState(false);
  const userRef = useRef<string | null>(null);
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    const restore = async (id: string | null) => {
      userRef.current = id;
      const sequence = ++revision.current;
      const cache = await AsyncStorage.getItem(keyFor(id));
      if (!active || sequence !== revision.current) return;
      applyPreference(valid(cache) ? cache : 'system');
      if (!id || !isSupabaseConfigured) return;
      const { data, error } = await supabase.from('profiles').select('theme_preference').eq('id', id).maybeSingle();
      if (!error && valid(data?.theme_preference) && active && sequence === revision.current) {
        applyPreference(data.theme_preference);
        await AsyncStorage.setItem(keyFor(id), data.theme_preference);
      }
    };
    void supabase.auth.getSession().then(({ data }) => restore(data.session?.user.id || null)).catch(() => restore(null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Leave the auth callback before making another Supabase request.
      setTimeout(() => { if (active) void restore(session?.user.id || null).catch(() => {}); }, 0);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  const setPreference = useCallback(async (value: ThemePreference) => {
    if (!valid(value)) throw new Error('Choose System, Light, or Dark.');
    setBusy(true);
    const sequence = ++revision.current;
    try {
      const id = userRef.current;
      if (id && isSupabaseConfigured) {
        const { data, error } = await supabase.from('profiles').update({ theme_preference: value }).eq('id', id).select('id').single();
        if (error || !data) throw new Error('Your theme could not be saved. Try again.');
      }
      await AsyncStorage.setItem(keyFor(id), value);
      if (sequence === revision.current && userRef.current === id) applyPreference(value);
    } finally { setBusy(false); }
  }, []);
  const resolved = preference === 'system' ? system === 'light' ? 'light' : 'dark' : preference;
  return <ThemeContext.Provider value={{ colors: resolved === 'light' ? LightColors : DarkColors, preference, resolved, busy, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme must be used inside AppThemeProvider.');
  return value;
}
