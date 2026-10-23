import { Colors } from '@/constants/colors';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function IntegrationsScreen() {
  const router = useRouter();
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <View style={styles.header}><Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back"><Text style={styles.back}>‹</Text></Pressable><Text style={styles.headerTitle}>Connections</Text><View style={styles.spacer} /></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>YOUR WORKSPACE</Text>
      <Text style={styles.title}>Connected services</Text>
      <Text style={styles.lead}>Connections let TARS work with services you choose. Each one needs a server-side OAuth flow and your explicit authorization.</Text>
      <View style={styles.card}><View style={styles.statusIcon}><View style={styles.statusDot} /></View><View style={styles.copy}><Text style={styles.cardTitle}>No services connected</Text><Text style={styles.cardBody}>Connection setup is not available in this build. No provider is shown as connected unless the live account status confirms it.</Text></View></View>
      <View style={styles.note}><Text style={styles.noteTitle}>What is needed</Text><Text style={styles.noteText}>A trusted connection service, provider OAuth configuration, and a review of each provider’s permissions. API credentials belong on the server, never in this app.</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.background }, header: { height: 54, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { color: Colors.textPrimary, fontSize: 32, lineHeight: 36, width: 35 }, headerTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' }, spacer: { width: 35 }, content: { paddingHorizontal: 23, paddingTop: 22, paddingBottom: 40 }, kicker: { color: Colors.primaryLight, fontSize: 10, letterSpacing: 1.8, fontWeight: '700' }, title: { color: Colors.textPrimary, fontSize: 29, fontWeight: '700', marginTop: 9 }, lead: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22, marginTop: 10, marginBottom: 22 }, card: { flexDirection: 'row', gap: 13, padding: 17, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface }, statusIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }, statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.textMuted }, copy: { flex: 1 }, cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' }, cardBody: { color: Colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 6 }, note: { marginTop: 18, paddingHorizontal: 3 }, noteTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' }, noteText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 6 } });
