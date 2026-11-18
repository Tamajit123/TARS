import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

const MotionContext = createContext({ reducedMotion: false, reducedTransparency: false });
export function MotionProvider({ children }: { children: ReactNode }) {
  const [reducedMotion, setMotion] = useState(false);
  const [reducedTransparency, setTransparency] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setMotion(value); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setMotion);
    if (Platform.OS !== 'ios') return () => { active = false; motion.remove(); };
    void AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (active) setTransparency(value); });
    const transparency = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setTransparency);
    return () => { active = false; motion.remove(); transparency.remove(); };
  }, []);
  return <MotionContext.Provider value={{ reducedMotion, reducedTransparency }}>{children}</MotionContext.Provider>;
}
export const useMotionPreferences = () => useContext(MotionContext);
