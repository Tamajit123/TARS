import { Platform } from 'react-native';

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, page: 24, section: 32, hero: 48 };
export const radius = { control: 12, group: 16, sheet: 24, bubble: 20 };
export const type = {
  largeTitle: { fontSize: 28, lineHeight: 34, fontWeight: '400' as const, letterSpacing: 0 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '500' as const, letterSpacing: 0 },
  body: { fontSize: 17, lineHeight: 25, letterSpacing: -0.2 },
  label: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 17 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, lineHeight: 21 },
};
export const minimumTouch = Platform.OS === 'android' ? 48 : 44;
export const appHeaderHeight = 52;
