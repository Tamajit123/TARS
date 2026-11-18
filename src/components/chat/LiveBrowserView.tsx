import { AccessibleModal as Modal } from '@/components/common/AccessibleModal';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';

export function LiveBrowserView({ url, expiresAt, onClose }: { url: string; expiresAt: string; onClose: () => void }) {
  const { colors } = useAppTheme();
  const [loadError, setLoadError] = useState('');
  const [ended, setEnded] = useState(() => Date.parse(expiresAt) <= Date.now());
  useEffect(() => {
    const timer = setTimeout(() => setEnded(true), Math.max(0, Date.parse(expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [expiresAt]);
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><View style={[styles.header, { borderBottomColor: colors.border }]}><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close browser" style={styles.close}><Text style={{ color: colors.textLink, fontSize: 17 }}>Done</Text></Pressable><Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '600' }}>Browserbase</Text><Text style={{ color: colors.textSecondary, fontSize: 12 }}>{ended ? 'Ended' : 'Live preview'}</Text></View>{loadError && !ended ? <View style={styles.empty}><Text accessibilityRole="alert" style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '600' }}>Preview unavailable</Text><Text style={{ color: colors.textSecondary, marginTop: 10, textAlign: 'center', lineHeight: 22 }}>{loadError}</Text></View> : ended ? <View style={styles.empty}><Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '600' }}>This browser session ended</Text><Text style={{ color: colors.textSecondary, marginTop: 10, textAlign: 'center', lineHeight: 22 }}>The retrieved results stay in your conversation. Ask TARS to browse again for a new live view.</Text></View> : <View pointerEvents="none" style={{ flex: 1 }}>{Platform.OS === 'web' ? React.createElement('iframe', { src: url, title: 'Browserbase live browser preview', onError: () => setLoadError('The live preview could not load. Close this view and try again while the session is active.'), sandbox: 'allow-scripts allow-same-origin', style: { border: 0, width: '100%', height: '100%', pointerEvents: 'none' } }) : <WebView source={{ uri: url }} originWhitelist={['https://*']} javaScriptEnabled sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false} setSupportMultipleWindows={false} onError={() => setLoadError('The live preview could not load. Close this view and try again while the session is active.')} onHttpError={() => setLoadError('Browserbase could not load this preview. The retrieved answer is still available in chat.')} style={{ flex: 1, backgroundColor: colors.surface }} />}</View>}<Text style={{ color: colors.textMuted, padding: 14, fontSize: 12, textAlign: 'center' }}>Read-only live preview · expires automatically</Text></SafeAreaView></Modal>;
}
const styles = StyleSheet.create({ header: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth }, close: { minHeight: 44, justifyContent: 'center', paddingRight: 16 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 } });
