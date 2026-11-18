import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '@/context/ThemeContext';
import { useMotionPreferences } from '@/context/MotionContext';

/** Blur is selective and iOS-only; other platforms and accessibility use opaque material. */
export function MaterialSurface({ children, style, ...props }: ViewProps) {
  const { colors, resolved } = useAppTheme();
  const { reducedTransparency } = useMotionPreferences();
  const blurred = Platform.OS === 'ios' && !reducedTransparency;
  return <View {...props} style={[{ backgroundColor: blurred ? 'transparent' : colors.surface, overflow: 'hidden' }, style]}>
    {blurred ? <BlurView pointerEvents="none" tint={resolved === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} intensity={80} style={StyleSheet.absoluteFill} /> : null}
    {children}
  </View>;
}
