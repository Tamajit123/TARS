import { cancelOwnedDeviceAlarms } from '@/services/deviceAlarms';
import {cancelReminderNotificationsOnSignOut} from '@/services/reminders';
import {NotificationSettings} from '@/components/tasks/NotificationSettings';
import { TabScreen } from '@/components/common/TabScreen';
import { ScreenHeading } from '@/components/common/ScreenHeading';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '@/context/ThemeContext';
import type { ColorPalette } from '@/constants/colors';

import { getAvatarUrl, uploadAvatar } from '@/lib/auth';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { showToast } from '@/context/ToastContext';
import * as ImagePicker from 'expo-image-picker';
import { ArrowRight01Icon, HelpCircleIcon, Logout01Icon, Shield01Icon, Grid02Icon } from '@/constants/icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { normalizeProfile, profileChanged, validateProfile } from '@/lib/profileState';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const OFFLINE_MODE_KEY = 'tars:offline-preview';

export default function SettingsScreen() {
  const { colors: Colors, preference, setPreference, busy: themeBusy } = useAppTheme();
  const styles = createStyles(Colors);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [offline, setOffline] = useState(!isSupabaseConfigured);
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [savedProfile, setSavedProfile] = useState({ name: '', instructions: '' });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState<{ base64: string; mimeType: string; uri: string } | null>(null);
  const busyRef = useRef(false);
  const dirty = profileChanged(savedProfile, { name: displayName, instructions });

  useEffect(() => {
    let active = true;
    Promise.all([supabase.auth.getSession(), AsyncStorage.getItem(OFFLINE_MODE_KEY)]).then(async ([{ data }, local]) => {
      if (!active) return;
      const user = data.session?.user;
      setEmail(user?.email || '');
      setUserId(user?.id || '');
      setOffline(local === '1' || !isSupabaseConfigured);
      if (user) {
        const { data: profile, error: profileError } = await supabase.from('profiles').select('name,avatar_path,avatar_url,preferences').eq('id', user.id).maybeSingle();
        if (profileError) throw profileError;
        const name = profile?.name || '';
        setDisplayName(name);
        const preferences = profile?.preferences;
        const savedInstructions = preferences && typeof preferences === 'object' && !Array.isArray(preferences) && typeof preferences.assistant_instructions === 'string' ? preferences.assistant_instructions : '';
        setInstructions(savedInstructions); setSavedProfile({ name, instructions: savedInstructions });
        if (profile?.avatar_path) {
          try { setAvatarUrl(await getAvatarUrl(profile.avatar_path)); } catch { setAvatarUrl(null); }
        } else if (profile?.avatar_url?.startsWith('https://')) setAvatarUrl(profile.avatar_url);
      }
    }).catch(() => { if (active) Alert.alert('Profile unavailable', 'Your profile could not be loaded. Check your connection and try again.'); });
    return () => { active = false; };
  }, []);

  const saveProfile = async () => {
    if (!userId || busyRef.current || !editingProfile || !dirty) return;
    const draft = normalizeProfile({ name: displayName, instructions });
    const validation = validateProfile(draft);
    if (validation) { setProfileError(validation); return; }
    busyRef.current = true; setProfileBusy(true); setProfileError('');
    try {
      const { data: profile, error: readError } = await supabase.from('profiles').select('preferences').eq('id', userId).single();
      if (readError) throw readError;
      const existing = profile.preferences && typeof profile.preferences === 'object' && !Array.isArray(profile.preferences) ? profile.preferences : {};
      const { error } = await supabase.from('profiles').update({ name: draft.name, preferences: { ...existing, assistant_instructions: draft.instructions } }).eq('id', userId).select('id').single();
      if (error) throw error;
      setSavedProfile(draft); setDisplayName(draft.name); setInstructions(draft.instructions); setEditingProfile(false);
      showToast('Profile saved');
    } catch { setProfileError('Profile not saved. Check your connection and retry; your changes are still here.'); }
    finally { busyRef.current = false; setProfileBusy(false); }
  };

  const chooseAvatar = async () => {
    if (!userId || busyRef.current) return;
    busyRef.current = true;
    try {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85, base64: true });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    setPendingPhoto({ base64: asset.base64!, mimeType: asset.mimeType || 'image/jpeg', uri: asset.uri });
    setProfileError('');
    } catch { setProfileError('The photo picker could not open. Please try Edit Profile Photo again.'); }
    finally { busyRef.current = false; }
  };

  const savePhoto = async () => {
    if (!pendingPhoto || !userId || busyRef.current) return;
    busyRef.current = true; setProfileBusy(true); setProfileError('');
    try {
      const saved = await uploadAvatar(userId, pendingPhoto.base64, pendingPhoto.mimeType);
      setAvatarUrl(saved.signedUrl); setPendingPhoto(null); showToast('Profile photo saved');
    } catch {
      setProfileError('Photo not saved. Choose a JPG, PNG, or WebP under 5 MB, check your connection, and retry. Your saved photo is unchanged.');
    } finally { busyRef.current = false; setProfileBusy(false); }
  };

  const endSession = async () => {
    try {
      await cancelOwnedDeviceAlarms();
      if (!offline) {
        await cancelReminderNotificationsOnSignOut();
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) throw error;
        showToast('Signed out successfully');
      }
      await AsyncStorage.removeItem(OFFLINE_MODE_KEY);
      router.replace('/');
    } catch { showToast('Could not sign out. Check your connection and try again.'); }
  };

  const signOut = () => {
    const title = offline ? 'Leave offline preview?' : 'Sign out?';
    const message = offline ? 'Locally saved preview data stays on this device.' : 'Your conversations remain in your account.';
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n${message}`)) void endSession();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: offline ? 'Continue' : 'Sign out', style: 'destructive', onPress: () => { void endSession(); } },
    ]);
  };

  const rows = [
    { title: 'Connected services', detail: 'Manage account connections', icon: Grid02Icon, action: () => router.push('/tools') },
    { title: 'Maps & directions', detail: 'Place search and real driving routes', icon: Grid02Icon, action: () => router.push('/maps') },
    { title: 'Privacy', detail: 'How TARS uses your data', icon: Shield01Icon, action: () => router.push('/privacy') },
    { title: 'Terms', detail: 'Service terms and limitations', icon: HelpCircleIcon, action: () => router.push('/terms') },
  ];

  return (
    <TabScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeading title="Settings" />
        <View style={styles.profile}>
          <Pressable onPress={chooseAvatar} disabled={offline || profileBusy} accessibilityRole="button" accessibilityLabel="Choose profile photo">
            {pendingPhoto?.uri || avatarUrl ? <Image source={{ uri: pendingPhoto?.uri || avatarUrl! }} style={styles.avatar} /> : <View style={styles.avatar}><Text style={styles.avatarText}>{savedProfile.name.trim().charAt(0).toUpperCase() || 'T'}</Text></View>}
          </Pressable>
          <View style={styles.profileText}><Text style={styles.profileTitle}>{offline ? 'Offline preview' : 'TARS account'}</Text><Text style={styles.profileDetail}>{email || (offline ? 'Data saved on this device' : 'Signed in')}</Text></View>
          <View style={[styles.modeDot, !offline && styles.onlineDot]} />
        </View>
        {userId ? <View style={styles.profileEditor}>
          <Text style={styles.sectionLabel}>PROFILE</Text>
          {editingProfile ? <>
          <Text style={styles.fieldLabel}>Display name · Required</Text>
          <TextInput value={displayName} onChangeText={setDisplayName} editable={!profileBusy} maxLength={80} placeholder="Your name" placeholderTextColor={Colors.textMuted} style={styles.profileInput} autoComplete="name" accessibilityLabel="Display name" />
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Assistant preferences</Text>
          <TextInput value={instructions} onChangeText={setInstructions} editable={!profileBusy} maxLength={4000} placeholder="How should TARS respond? Add your preferred language, tone, or useful context." placeholderTextColor={Colors.textMuted} style={[styles.profileInput, { minHeight: 110, paddingTop: 12, textAlignVertical: 'top' }]} multiline accessibilityLabel="Assistant preferences" />
          {dirty ? <Pressable style={styles.profileButton} onPress={saveProfile} disabled={profileBusy} accessibilityRole="button"><Text style={styles.profileButtonText}>{profileBusy ? 'Saving…' : 'Save Profile'}</Text></Pressable> : null}
          <Pressable style={styles.avatarLink} disabled={profileBusy} onPress={() => { setDisplayName(savedProfile.name); setInstructions(savedProfile.instructions); setEditingProfile(false); setProfileError(''); }} accessibilityRole="button"><Text style={styles.avatarLinkText}>Cancel Edit</Text></Pressable>
          </> : <>
            <Text style={styles.profileTitle}>{savedProfile.name || 'Add your display name'}</Text>
            <Text style={styles.profileDetail}>{savedProfile.instructions || 'No assistant preferences saved'}</Text>
            <Pressable style={styles.profileButton} disabled={profileBusy} onPress={() => { setEditingProfile(true); setProfileError(''); }} accessibilityRole="button"><Text style={styles.profileButtonText}>Edit Profile</Text></Pressable>
          </>}
          {pendingPhoto ? <>
            <Text style={styles.profileDetail}>New photo preview · Not saved yet</Text>
            <Pressable style={styles.profileButton} onPress={savePhoto} disabled={profileBusy} accessibilityRole="button"><Text style={styles.profileButtonText}>{profileBusy ? 'Saving Photo…' : 'Save Profile Photo'}</Text></Pressable>
            <Pressable style={styles.avatarLink} disabled={profileBusy} onPress={() => { setPendingPhoto(null); setProfileError(''); }} accessibilityRole="button"><Text style={styles.avatarLinkText}>Cancel Photo Change</Text></Pressable>
          </> : <Pressable style={styles.avatarLink} onPress={chooseAvatar} disabled={profileBusy} accessibilityRole="button"><Text style={styles.avatarLinkText}>Edit Profile Photo</Text></Pressable>}
          {profileError ? <Text accessibilityRole="alert" style={{ color: Colors.error, fontSize: 15, lineHeight: 22, marginTop: 8 }}>{profileError}</Text> : null}
          {profileBusy ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
        </View> : null}
        <Text style={styles.sectionLabel}>APPEARANCE</Text>
        <View style={[styles.group, styles.themeChoices]}>
          {(['system', 'light', 'dark'] as const).map((value) => <Pressable key={value} style={[styles.themeChoice, preference === value && styles.themeSelected]} disabled={themeBusy} accessibilityRole="radio" aria-checked={preference === value} accessibilityState={{ checked: preference === value, disabled: themeBusy }} onPress={() => { void setPreference(value).catch((error) => Alert.alert('Theme not saved', error.message)); }}><Text style={[styles.themeText, preference === value && styles.themeSelectedText]}>{value.charAt(0).toUpperCase() + value.slice(1)}</Text></Pressable>)}
          {themeBusy ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
        </View>
        <NotificationSettings /><Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.group}>
          {rows.map(({ title: rowTitle, detail, icon, action }, index) => <View key={rowTitle}><Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={action} accessibilityRole="button"><View style={styles.rowIcon}><HugeiconsIcon icon={icon} size={19} color={Colors.primaryLight} strokeWidth={1.8} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{rowTitle}</Text><Text style={styles.rowDetail}>{detail}</Text></View><HugeiconsIcon icon={ArrowRight01Icon} size={18} color={Colors.textMuted} /></Pressable>{index < rows.length - 1 && <View style={styles.divider} />}</View>)}
        </View>
        <Text style={styles.sectionLabel}>SESSION</Text>
        <View style={styles.group}>
          <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={signOut} accessibilityRole="button"><View style={[styles.rowIcon, styles.logoutIcon]}><HugeiconsIcon icon={Logout01Icon} size={19} color={Colors.error} strokeWidth={1.8} /></View><View style={styles.rowCopy}><Text style={[styles.rowTitle, styles.logoutText]}>{offline ? 'Exit offline preview' : 'Sign out'}</Text><Text style={styles.rowDetail}>End this session on the device</Text></View><HugeiconsIcon icon={ArrowRight01Icon} size={18} color={Colors.textMuted} /></Pressable>
        </View>
        <Text style={styles.version}>TARS · Personal intelligence</Text>
      </ScrollView>
    </TabScreen>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  themeChoices: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 }, themeChoice: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: Colors.border }, themeSelected: { borderColor: Colors.primaryBorder, backgroundColor: Colors.primarySubtle }, themeText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' }, themeSelectedText: { color: Colors.textLink },
  container: { flex: 1, backgroundColor: Colors.background }, content: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 40 },
  eyebrow: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2 }, title: { color: Colors.textPrimary, fontSize: 30, fontWeight: '700', letterSpacing: -0.7, marginTop: 8, marginBottom: 22 },
  profile: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginBottom: 18 }, avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: Colors.primarySubtle, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primaryBorder }, avatarText: { color: Colors.primaryLight, fontSize: 18, fontWeight: '800' }, profileText: { flex: 1, marginLeft: 13 }, profileTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' }, profileDetail: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 }, modeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary }, onlineDot: { backgroundColor: Colors.success },
  profileEditor: { padding: 15, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginBottom: 28 }, fieldLabel: { color: Colors.textSecondary, fontSize: 13, marginBottom: 7 }, profileInput: { minHeight: 46, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceInput, color: Colors.textPrimary, borderRadius: 12, paddingHorizontal: 12, fontSize: 17 }, profileButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 12, marginTop: 10 }, profileButtonText: { color: Colors.onPrimary, fontSize: 13, fontWeight: '700' }, avatarLink: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, avatarLinkText: { color: Colors.primaryLight, fontSize: 12, fontWeight: '600' },
  sectionLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 11 }, group: { borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 26 }, row: { flexDirection: 'row', alignItems: 'center', minHeight: 70, paddingHorizontal: 14, paddingVertical: 10 }, rowPressed: { backgroundColor: Colors.surfaceMuted }, rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primarySubtle, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, rowCopy: { flex: 1 }, rowTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '600' }, rowDetail: { color: Colors.textMuted, fontSize: 13, marginTop: 4 }, divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 64 }, logoutIcon: { backgroundColor: Colors.errorLight }, logoutText: { color: Colors.error }, version: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 2 },
});
