import React, { type ComponentRef, type ReactNode, type Ref } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useMotionPreferences } from '@/context/MotionContext';
import { useAppTheme } from '@/context/ThemeContext';

/** Bounded fields scroll above an always reachable action footer. */
export function KeyboardFormLayout({ children, footer, cardStyle, backdropStyle, centered = false, scrollRef, onDismiss, dismissDisabled = false }: {
  children: ReactNode;
  footer: ReactNode;
  cardStyle?: StyleProp<ViewStyle>;
  backdropStyle?: StyleProp<ViewStyle>;
  centered?: boolean;
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
  onDismiss?: () => void;
  dismissDisabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { reducedMotion } = useMotionPreferences();
  const y = useSharedValue(0);
  const origin = useSharedValue(0);
  const height = useSharedValue(600);
  const dismiss = () => { if (!dismissDisabled) onDismiss?.(); };
  const pan = usePanGesture({ enabled: Boolean(onDismiss) && !dismissDisabled, activeOffsetY: 10, failOffsetX: [-16,16],
    onActivate: () => { origin.set(y.get()); },
    onUpdate: event => { y.set(Math.max(0, origin.get() + event.translationY)); },
    onDeactivate: event => {
      if (!event.canceled && (y.get() > 100 || event.velocityY > 850)) {
        if (reducedMotion) scheduleOnRN(dismiss);
        else y.set(withSpring(height.get(), { duration: 300, dampingRatio: 1, velocity: event.velocityY, overshootClamping: true }, finished => { if (finished) scheduleOnRN(dismiss); }));
      } else y.set(reducedMotion ? 0 : withSpring(0, { duration: 300, dampingRatio: 0.8, velocity: event.velocityY }));
    },
  });
  const movement = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <GestureHandlerRootView style={{ flex: 1 }}><KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
    style={[styles.backdrop, centered && styles.centered, backdropStyle, { paddingTop: insets.top + 12 }]}>
    <Animated.View onLayout={event => height.set(event.nativeEvent.layout.height)} style={[styles.card, cardStyle, { paddingBottom: Math.max(insets.bottom, 12) }, movement]}>
      {!centered && onDismiss ? <GestureDetector gesture={pan}><Pressable style={styles.handleArea} onPress={dismiss} disabled={dismissDisabled} accessibilityRole="button" accessibilityLabel="Dismiss form"><View style={[styles.handle, { backgroundColor: colors.textMuted }]} /></Pressable></GestureDetector> : null}
      <ScrollView ref={scrollRef} style={styles.fields} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="none">
        {children}
      </ScrollView>
      <View style={styles.footer}>{footer}</View>
    </Animated.View>
  </KeyboardAvoidingView></GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  centered: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxHeight: '100%', flexShrink: 1, minHeight: 0 },
  fields: { flexShrink: 1, minHeight: 0 },
  content: { paddingBottom: 12 },
  footer: { flexShrink: 0 },
  handleArea: { minHeight: Platform.OS === 'android' ? 48 : 44, alignItems: 'center', justifyContent: 'center', marginTop: -12 },
  handle: { width: 32, height: 4, borderRadius: 2 },
});
