import { useWindowDimensions, type ViewProps } from 'react-native';
import { usePanGesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, ReduceMotion, SlideInLeft, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useMotionPreferences } from '@/context/MotionContext';

/** A drawer pan has a horizontal activation threshold so vertical lists keep scrolling. */
export function MotionPanel({ children, onDismiss, style, ...props }: ViewProps & { onDismiss: () => void }) {
  const { width } = useWindowDimensions();
  const { reducedMotion } = useMotionPreferences();
  const x = useSharedValue(0);
  const origin = useSharedValue(0);
  const pan = usePanGesture({ activeOffsetX: [-24,24], failOffsetY: [-14,14],
    onActivate: () => { origin.set(x.get()); },
    onUpdate: event => { x.set(Math.min(0, origin.get() + event.translationX)); },
    onDeactivate: event => {
      if (!event.canceled && (x.get() < -Math.min(100, width * 0.25) || event.velocityX < -750)) {
        if (reducedMotion) scheduleOnRN(onDismiss);
        else x.set(withSpring(-width, { duration: 300, dampingRatio: 1, velocity: event.velocityX, overshootClamping: true }, finished => { if (finished) scheduleOnRN(onDismiss); }));
      } else x.set(reducedMotion ? 0 : withSpring(0, { duration: 300, dampingRatio: 0.8, velocity: event.velocityX }));
    },
  });
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return <GestureDetector gesture={pan}><Animated.View {...props} entering={reducedMotion ? undefined : SlideInLeft.duration(220).reduceMotion(ReduceMotion.System)} style={[style, animated]}>{children}</Animated.View></GestureDetector>;
}
export const messageEntrance = FadeIn.duration(160).reduceMotion(ReduceMotion.System);
