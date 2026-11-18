import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useState } from 'react';
import { useMotionPreferences } from '@/context/MotionContext';
import { selectionFeedback } from '@/lib/haptics';

export function MotionPressable({ children, haptic = false, containerStyle, ...props }: PressableProps & { haptic?: boolean; containerStyle?: StyleProp<ViewStyle> }) {
  const [pressed, setPressed] = useState(false);
  const { reducedMotion } = useMotionPreferences();
  return <Animated.View style={[containerStyle, { transform: [{ scale: pressed && !reducedMotion ? 0.97 : 1 }], opacity: pressed ? 0.8 : 1, transitionProperty: ['transform','opacity'], transitionDuration: 120, transitionTimingFunction: 'ease-out' }]}>
    <Pressable {...props} onPressIn={event => { if (!props.disabled) setPressed(true); props.onPressIn?.(event); }} onPressOut={event => { setPressed(false); props.onPressOut?.(event); }} onPress={event => { if (haptic) selectionFeedback(); props.onPress?.(event); }}>{children}</Pressable>
  </Animated.View>;
}
