import { StyleSheet, Text, View } from 'react-native';
import { MenuTwoLineIcon, MoreHorizontalIcon } from '@/constants/icons';
import { useAppTheme } from '@/context/ThemeContext';
import { MascotAvatar } from './MascotAvatar';
import { MotionPressable } from './MotionPressable';
import { NativeIcon } from './NativeIcon';

export interface AppHeaderProps {
  agentName?: string; mascotIcon?: string; mascotColor?: string;
  onOpenSidebar: () => void; onOpenSettings: () => void; onMascotPress?: () => void;
}
export function AppHeader({ agentName = 'TARS', mascotIcon = 'tars', mascotColor, onOpenSidebar, onOpenSettings, onMascotPress }: AppHeaderProps) {
  const { colors } = useAppTheme();
  return <View style={[styles.header, { backgroundColor: colors.background }]}>
    <MotionPressable haptic style={styles.control} onPress={onOpenSidebar} accessibilityRole="button" accessibilityLabel="Open conversations"><NativeIcon symbol="sidebar.left" fallback={MenuTwoLineIcon} size={22} color={colors.textPrimary} /></MotionPressable>
    <MotionPressable containerStyle={styles.center} style={styles.identity} onPress={onMascotPress || onOpenSettings} accessibilityRole="button" accessibilityLabel={agentName + ' profile'}>
      <MascotAvatar size={28} icon={mascotIcon} color={mascotColor || colors.primary} />
      <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary }]}>{agentName}</Text>
    </MotionPressable>
    <MotionPressable haptic style={styles.control} onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel="Agent options"><NativeIcon symbol="ellipsis" fallback={MoreHorizontalIcon} size={22} color={colors.textPrimary} /></MotionPressable>
  </View>;
}
const styles = StyleSheet.create({ header: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, control: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, center: { flex: 1, alignItems: 'center' }, identity: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, maxWidth: 220 }, name: { flexShrink: 1, fontSize: 17, fontWeight: '600', letterSpacing: -0.4 } });
export default AppHeader;
