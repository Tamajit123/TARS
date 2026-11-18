import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';
import { useMotionPreferences } from '@/context/MotionContext';
const ToastContext = createContext({ showToast: (_message: string, _duration?: number) => {} });
let globalToastHandler: ((message: string, duration?: number) => void) | null = null;
export const showToast = (message: string, duration?: number) => globalToastHandler?.(message, duration);
const easing = Easing.bezier(0.23, 1, 0.32, 1);
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useAppTheme(); const { reducedMotion } = useMotionPreferences(); const insets = useSafeAreaInsets();
  const [message, setMessage] = useState(''); const [visible, setVisible] = useState(false);
  const opacity = useSharedValue(0), y = useSharedValue(-8);
  const revision = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null), hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateY: y.get() }] }));
  const triggerToast = useCallback((text: string, duration = 3500) => {
    const current = ++revision.current;
    if (timer.current) clearTimeout(timer.current); if (hideTimer.current) clearTimeout(hideTimer.current);
    cancelAnimation(opacity); cancelAnimation(y); setMessage(text); setVisible(true);
    opacity.set(withTiming(1, { duration: reducedMotion ? 120 : 250, easing }));
    y.set(reducedMotion ? 0 : withTiming(0, { duration: 250, easing }));
    timer.current = setTimeout(() => {
      opacity.set(withTiming(0, { duration: 200, easing }));
      y.set(reducedMotion ? 0 : withTiming(-8, { duration: 200, easing }));
      hideTimer.current = setTimeout(() => { if (current === revision.current) setVisible(false); }, 200);
    }, Math.max(duration, 2500));
  }, [opacity, y, reducedMotion]);
  React.useEffect(() => {
    globalToastHandler = triggerToast;
    return () => { globalToastHandler = null; if (timer.current) clearTimeout(timer.current); if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [triggerToast]);
  return <ToastContext.Provider value={{ showToast: triggerToast }}>{children}{visible ? <View pointerEvents="none" style={[styles.wrapper, { top: insets.top + 12 }]}><Animated.View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }, animated]}><View style={[styles.dot, { backgroundColor: colors.success }]} /><Text style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 21, flexShrink: 1 }}>{message}</Text></Animated.View></View> : null}</ToastContext.Provider>;
};
export const useToast = () => useContext(ToastContext);
const styles = StyleSheet.create({ wrapper: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 99999 }, toast: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, maxWidth: 440, gap: 10, borderWidth: StyleSheet.hairlineWidth }, dot: { width: 6, height: 6, borderRadius: 3 } });
