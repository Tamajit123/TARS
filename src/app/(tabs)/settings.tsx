import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/colors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { ArrowRight01Icon, HelpCircleIcon, Logout01Icon, Shield01Icon, PaintBrush01Icon, Grid02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const OFFLINE_MODE_KEY = 'tars:offline-preview';

export default function SettingsScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [offline, setOffline] = useState(!isSupabaseConfigured);

  useEffect(() => {
    let active = true;
    Promise.all([supabase.auth.getSession(), AsyncStorage.getItem(OFFLINE_MODE_KEY)]).then(([{ data }, local]) => {
      if (!active) return;
      setEmail(data.session?.user.email || '');
      setOffline(local === '1' || !isSupabaseConfigured);
    });
    return () => { active = false; };
  }, []);

  const signOut = () => Alert.alert(offline ? 'Leave offline preview?' : 'Sign out?', offline ? 'You can return later; locally saved preview data stays on this device.' : 'Your conversations remain in your account.', [
    { text: 'Cancel', style: 'cancel' },
    { text: offline ? 'Continue' : 'Sign out', style: 'destructive', onPress: () => { void (async () => {
      if (!offline) {
        const { error } = await supabase.auth.signOut();
        if (error) { Alert.alert('Could not sign out', 'Check your connection and try again.'); return; }
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
          <View style={styles.avatar}><Text style={styles.avatarText}>T</Text></View>
          <View style={styles.profileText}><Text style={styles.profileTitle}>{offline ? 'Offline preview' : 'TARS account'}</Text><Text style={styles.profileDetail}>{email || (offline ? 'Data saved on this device' : 'Signed in')}</Text></View>
          <View style={[styles.modeDot, !offline && styles.onlineDot]} />
        </View>
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
  profile: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginBottom: 30 }, avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: Colors.primarySubtle, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primaryBorder }, avatarText: { color: Colors.primaryLight, fontSize: 18, fontWeight: '800' }, profileText: { flex: 1, marginLeft: 13 }, profileTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' }, profileDetail: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 }, modeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary }, onlineDot: { backgroundColor: Colors.success },
  sectionLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.7, marginBottom: 11 }, group: { borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 26 }, row: { flexDirection: 'row', alignItems: 'center', minHeight: 70, paddingHorizontal: 14, paddingVertical: 10 }, rowPressed: { backgroundColor: Colors.surfaceMuted }, rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primarySubtle, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, rowCopy: { flex: 1 }, rowTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' }, rowDetail: { color: Colors.textMuted, fontSize: 11, marginTop: 4 }, divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 64 }, logoutIcon: { backgroundColor: Colors.errorLight }, logoutText: { color: Colors.error }, version: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 2 },
});
