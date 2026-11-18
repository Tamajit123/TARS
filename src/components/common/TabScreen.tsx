import { Platform, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';

/** NativeTabs overlays its bar on iOS. Reserve the real native bottom safe area
 * for the whole screen, including fixed composers, instead of only a ScrollView. */
export function TabScreen({ children, style, ...props }: ViewProps) {
  return Platform.OS === 'ios' ? <SafeAreaView {...props} edges={{ bottom: true }} style={[{ flex: 1, minHeight: 0 }, style]}>{children}</SafeAreaView> : <View {...props} style={[{ flex: 1, minHeight: 0 }, style]}>{children}</View>;
}
