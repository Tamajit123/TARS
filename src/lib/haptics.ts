import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
let lastFeedback = 0;
export function selectionFeedback() {
  if (Platform.OS === 'web' || Date.now() - lastFeedback < 180) return;
  lastFeedback = Date.now();
  void Haptics.selectionAsync().catch(() => {});
}
export function successFeedback() {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
