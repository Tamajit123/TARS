import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useAppTheme } from '@/context/ThemeContext';
import { space, type } from '@/constants/design';
export function ScreenHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  const { colors } = useAppTheme();
  return <View style={styles.heading}><View style={styles.row}><Text accessibilityRole="header" style={[type.largeTitle, { color: colors.textPrimary, flex: 1 }]}>{title}</Text>{action}</View>{subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}</View>;
}
const styles = StyleSheet.create({ heading: { marginBottom: space.xl }, row: { flexDirection: 'row', alignItems: 'center', gap: space.md }, subtitle: { fontSize: 17, lineHeight: 25, marginTop: space.sm, maxWidth: 420 } });
