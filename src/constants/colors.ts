/**
 * TARS design tokens: native neutral surfaces, legible content, and the blue of the TARS eyes.
 */

export const Colors = {
  // TARS blue accent; system typography and adaptive native surfaces.
  primary: '#F5F5F5',
  onPrimary: '#0D0D0D',
  primaryDark: '#E5E7EB',
  primaryLight: '#F5F5F5',
  primaryGradientStart: '#64B5FF',
  primaryGradientEnd: '#409CFF',
  primarySubtle: '#2C2C2E',
  primaryGlow: 'rgba(10, 132, 255, 0.12)',
  primaryBorder: '#48484A',

  // Neutral / Layout Colors (Clean White Theme)
  white: '#FFFFFF',
  black: '#000000',
  background: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#242426',
  surfaceMuted: '#2C2C2E',
  surfaceInput: '#1C1C1E',

  // Text Colors
  text: '#F5F5F7',
  textPrimary: '#F5F5F7',
  textSecondary: '#B7B7BF',
  textMuted: '#A0A0AA',
  textDisabled: '#626A77',
  textWhite: '#F5F5F7',
  textLink: '#E5E7EB',

  // Border & Dividers
  border: '#38383A',
  borderLight: '#2C2C2E',
  borderFocus: '#0A84FF',
  divider: '#38383A',

  // Status & Feedback
  success: '#75D5A2',
  successLight: '#1D3025',
  warning: '#0A84FF',
  warningLight: '#102840',
  error: '#E88B7A',
  errorLight: '#351F1B',
  info: '#83AFC2',
  infoLight: '#1A2930',

  // Tab & Chat UI specific tokens
  tabInactive: '#B7B7BF',
  tabActive: '#F5F5F7',
  tabActiveBg: '#2C2C2E',
  chatBubbleUser: '#242426',
  chatBubbleUserText: '#F5F5F7',
  chatBubbleAi: '#1C1C1E',
  chatBubbleAiBorder: '#38383A',
  dateBadgeBg: '#242426',
  dateBadgeText: '#B7B7BF',
  overlay: 'rgba(15, 23, 42, 0.45)',
  statusBlue: '#75D5A2',
  iconDark: '#F5F5F7',
  iconMuted: '#B7B7BF',
  inputBg: '#1C1C1E',
  inputBarBg: '#242426',
  inputBorder: '#38383A',
  inputBarBorder: '#38383A',
  dockBg: '#1C1C1E',
  avatarPreviewBg: '#242426',
  avatarOptionBg: '#1C1C1E',
  avatarOptionSelectedBg: '#102840',
  avatarOptionSelectedBorder: '#234D72',
  avatarAccentIndigo: '#4F46E5',
  avatarAccentEmerald: '#059669',
  avatarAccentAmber: '#D97706',
  avatarAccentViolet: '#7C3AED',
  avatarAccentRose: '#E11D48',

  browserPreviewBg: '#ffffff',
  // Google Branding
  googleBlue: '#4285F4',
  googleRed: '#EA4335',
  googleYellow: '#FBBC05',
  googleGreen: '#34A853',
  googleBorder: '#DADCE0',
  googleBgHover: '#F8FAFD',

  // Dark Scheme Palette (for dark mode compatibility)
  light: {
    text: '#0F172A',
    background: '#FFFFFF',
    backgroundElement: '#F1F5F9',
    backgroundSelected: '#EFF6FF',
    textSecondary: '#475569',
    tint: '#2563EB',
    card: '#FFFFFF',
    border: '#E2E8F0',
  },
  dark: {
    text: '#F8FAFC',
    background: '#0B0F17',
    backgroundElement: '#1E293B',
    backgroundSelected: '#1E3A8A',
    textSecondary: '#94A3B8',
    tint: '#3B82F6',
    card: '#0F172A',
    border: '#1E293B',
  },
} as const;

export type ColorType = typeof Colors;
export type ColorPalette = { [K in keyof typeof Colors]: K extends 'light' | 'dark' ? typeof Colors[K] : string };
export const DarkColors: ColorPalette = Colors;
export const LightColors: ColorPalette = {
  ...Colors,
  onPrimary: '#FFFFFF',
  primary: '#000000', primaryDark: '#0D0D0D', primaryLight: '#0D0D0D',
  primaryGradientStart: '#000000', primaryGradientEnd: '#000000',
  primarySubtle: '#F2F2F2', primaryGlow: 'rgba(0,0,0,0.06)', primaryBorder: '#CCCCCC',
  white: '#FFFFFF', background: '#FCFCFC', surface: '#FFFFFF', surfaceElevated: '#FCFCFC', surfaceMuted: '#F2F2F2', surfaceInput: '#FFFFFF',
  text: '#0D0D0D', textPrimary: '#0D0D0D', textSecondary: '#5D5D5D', textMuted: '#646464', textDisabled: '#929292', textWhite: '#FFFFFF', textLink: '#0D0D0D',
  border: '#CCCCCC', borderLight: '#E5E7EB', borderFocus: '#000000', divider: '#E5E7EB',
  success: '#23734E', successLight: '#E4F1E9', warning: '#95621F', warningLight: '#F7EDD8', error: '#B94733', errorLight: '#FAE9E4', info: '#28647D', infoLight: '#E3EFF4',
  tabInactive: '#646464', tabActive: '#0D0D0D', tabActiveBg: '#F2F2F2',
  chatBubbleUser: '#F2F2F2', chatBubbleUserText: '#0D0D0D', chatBubbleAi: '#FFFFFF', chatBubbleAiBorder: '#E5E7EB', dateBadgeBg: '#F2F2F2', dateBadgeText: '#5D5D5D',
  iconDark: '#0D0D0D', iconMuted: '#5D5D5D', inputBg: '#FFFFFF', inputBarBg: '#FFFFFF', inputBorder: '#CCCCCC', inputBarBorder: '#CCCCCC', dockBg: '#FFFFFF',
  avatarPreviewBg: '#F2F2F7', avatarOptionBg: '#FFFFFF', avatarOptionSelectedBg: '#EAF2FF', avatarOptionSelectedBorder: '#B9D4F5',
};
export default Colors;
