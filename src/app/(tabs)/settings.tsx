import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/colors';
import { getAvatarUrl, uploadAvatar } from '@/lib/auth';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { showToast } from '@/context/ToastContext';
import * as ImagePicker from 'expo-image-picker';
import { ArrowRight01Icon, HelpCircleIcon, Logout01Icon, Shield01Icon, PaintBrush01Icon, Grid02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const OFFLINE_MODE_KEY = 'tars:offline-preview';

export default function SettingsScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [offline, setOffline] = useState(!isSupabaseConfigured);
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([supabase.auth.getSession(), AsyncStorage.getItem(OFFLINE_MODE_KEY)]).then(async ([{ data }, local]) => {
      if (!active) return;
      const user = data.session?.user;
      setEmail(user?.email || '');
      setUserId(user?.id || '');
      setOffline(local === '1' || !isSupabaseConfigured);
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('display_name,avatar_path').eq('id', user.id).maybeSingle();
        setDisplayName(profile?.display_name || user.user_metadata?.display_name || '');
        if (profile?.avatar_path) {
          try { setAvatarUrl(await getAvatarUrl(profile.avatar_path)); } catch { setAvatarUrl(null); }
        }
      }
    });
    return () => { active = false; };
  }, []);

  const saveProfile = async () => {
    if (!userId || profileBusy) return;
    setProfileBusy(true);
    const { error } = await supabase.from('profiles').update({ display_name: displayName.trim() }).eq('id', userId);
    setProfileBusy(false);
    if (error) Alert.alert('Profile not saved', 'Check your connection and try again.');
    else Alert.alert('Profile updated', 'Your display name has been saved.');
  };

  const chooseAvatar = async () => {
    if (!userId || profileBusy) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Photo access needed', 'Allow photo library access to choose a profile picture.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85, base64: true });
    if (result.canceled || !result.assets[0]?.base64) return;
    setProfileBusy(true);
    try {
      const asset = result.assets[0];
      const path = await uploadAvatar(userId, asset.base64!, asset.mimeType || 'image/jpeg');
      setAvatarUrl(await getAvatarUrl(path));
    } catch {
      Alert.alert('Photo not uploaded', 'Choose a JPG, PNG, or WebP image under 5 MB and try again.');
    } finally { setProfileBusy(false); }
  };

  const signOut = () => Alert.alert(offline ? 'Leave offline preview?' : 'Sign out?', offline ? 'You can return later; locally saved preview data stays on this device.' : 'Your conversations remain in your account.', [
    { text: 'Cancel', style: 'cancel' },
    { text: offline ? 'Continue' : 'Sign out', style: 'destructive', onPress: () => { void (async () => {
      if (!offline) {
        const { error } = await supabase.auth.signOut();
        if (error) { Alert.alert('Could not sign out', 'Check your connection and try again.'); return; }
        showToast('Signed out successfully');
      }
      await AsyncStorage.removeItem(OFFLINE_MODE_KEY);
      router.replace('/');
    })(); } },
  ]);

  const rows = [
    { title: 'Connected services', detail: 'Manage account connections', icon: Grid02Icon, action: () => router.push('/tools') },
    { title: 'Appearance', detail: 'Dark theme', icon: PaintBrush01Icon, action: () => Alert.alert('Appearance', 'The graphite dark theme is active. Light theme selection is not available yet.') },
    { title: 'Privacy', detail: 'How TARS uses your data', icon: Shield01Icon, action: () => router.push('/privacy') },
    { title: 'Terms', detail: 'Service terms and limitations', icon: HelpCircleIcon, action: () => router.push('/terms') },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>YOUR COMMAND CENTER</Text>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.profile}>
          <Pressable onPress={chooseAvatar} disabled={offline || profileBusy} accessibilityRole="button" accessibilityLabel="Choose profile photo">
            {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatar} /> : <View style={styles.avatar}><Text style={styles.avatarText}>{displayName.trim().charAt(0).toUpperCase() || 'T'}</Text></View>}
          </Pressable>
          <View style={styles.profileText}><Text style={styles.profileTitle}>{offline ? 'Offline preview' : 'TARS account'}</Text><Text style={styles.profileDetail}>{email || (offline ? 'Data saved on this device' : 'Signed in')}</Text></View>
          <View style={[styles.modeDot, !offline && styles.onlineDot]} />
        </View>
        {userId ? <View style={styles.profileEditor}>
          <Text style={styles.sectionLabel}>PROFILE</Text>
          <Text style={styles.fieldLabel}>Display name</Text>
          <TextInput value={displayName} onChangeText={setDisplayName} maxLength={80} placeholder="Your name" placeholderTextColor={Colors.textMuted} style={styles.profileInput} autoComplete="name" />
          <Pressable style={styles.profileButton} onPress={saveProfile} disabled={profileBusy}><Text style={styles.profileButtonText}>{profileBusy ? 'Saving…' : 'Save profile'}</Text></Pressable>
          <Pressable style={styles.avatarLink} onPress={chooseAvatar} disabled={profileBusy}><Text style={styles.avatarLinkText}>{profileBusy ? 'Uploading…' : avatarUrl ? 'Change profile photo' : 'Add profile photo'}</Text>{profileBusy ? <ActivityIndicator size="small" color={Colors.primary} /> : null}</Pressable>
        </View> : null}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.group}>
          {rows.map(({ title: rowTitle, detail, icon, action }, index) => <View key={rowTitle}><Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={action} accessibilityRole="button"><View style={styles.rowIcon}><HugeiconsIcon icon={icon} size={19} color={Colors.primaryLight} strokeWidth={1.8} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{rowTitle}</Text><Text style={styles.rowDetail}>{detail}</Text></View><HugeiconsIcon icon={ArrowRight01Icon} size={18} color={Colors.textMuted} /></Pressable>{index < rows.length - 1 && <View style={styles.divider} />}</View>)}
        </View>
        <Text style={styles.sectionLabel}>SESSION</Text>
        <View style={styles.group}>
          <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={signOut} accessibilityRole="button"><View style={[styles.rowIcon, styles.logoutIcon]}><HugeiconsIcon icon={Logout01Icon} size={19} color={Colors.error} strokeWidth={1.8} /></View><View style={styles.rowCopy}><Text style={[styles.rowTitle, styles.logoutText]}>{offline ? 'Exit offline preview' : 'Sign out'}</Text><Text style={styles.rowDetail}>End this session on the device</Text></View><HugeiconsIcon icon={ArrowRight01Icon} size={18} color={Colors.textMuted} /></Pressable>
        </View>
        <Text style={styles.version}>TARS · Personal intelligence</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background }, content: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 40 },
  eyebrow: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 2 }, title: { color: Colors.textPrimary, fontSize: 30, fontWeight: '700', letterSpacing: -0.7, marginTop: 8, marginBottom: 22 },
  profile: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginBottom: 18 }, avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: Colors.primarySubtle, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primaryBorder }, avatarText: { color: Colors.primaryLight, fontSize: 18, fontWeight: '800' }, profileText: { flex: 1, marginLeft: 13 }, profileTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' }, profileDetail: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 }, modeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary }, onlineDot: { backgroundColor: Colors.success },
  profileEditor: { padding: 15, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginBottom: 28 }, fieldLabel: { color: Colors.textSecondary, fontSize: 11, marginBottom: 7 }, profileInput: { minHeight: 46, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceInput, color: Colors.textPrimary, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 }, profileButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 12, marginTop: 10 }, profileButtonText: { color: Colors.background, fontSize: 13, fontWeight: '700' }, avatarLink: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, avatarLinkText: { color: Colors.primaryLight, fontSize: 12, fontWeight: '600' },
  sectionLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.7, marginBottom: 11 }, group: { borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 26 }, row: { flexDirection: 'row', alignItems: 'center', minHeight: 70, paddingHorizontal: 14, paddingVertical: 10 }, rowPressed: { backgroundColor: Colors.surfaceMuted }, rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primarySubtle, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, rowCopy: { flex: 1 }, rowTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' }, rowDetail: { color: Colors.textMuted, fontSize: 11, marginTop: 4 }, divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 64 }, logoutIcon: { backgroundColor: Colors.errorLight }, logoutText: { color: Colors.error }, version: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 2 },
});
