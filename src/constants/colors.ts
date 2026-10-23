/**
 * TARS design tokens: graphite surfaces, warm ivory text, and restrained amber.
 */

export const Colors = {
  // Brand Primary (Blue)
  primary: '#E9A95F',
  primaryDark: '#C9823B',
  primaryLight: '#F4C98F',
  primaryGradientStart: '#F4C98F',
  primaryGradientEnd: '#C9823B',
  primarySubtle: '#30251A',
  primaryGlow: 'rgba(233, 169, 95, 0.12)',
  primaryBorder: '#5C422B',

  // Neutral / Layout Colors (Clean White Theme)
  white: '#F1EEE7',
  black: '#000000',
  background: '#11110F',
  surface: '#1A1A17',
  surfaceElevated: '#20201C',
  surfaceMuted: '#292923',
  surfaceInput: '#1A1A17',

  // Text Colors
  text: '#F1EEE7',
  textPrimary: '#F1EEE7',
  textSecondary: '#AAA69D',
  textMuted: '#79766F',
  textDisabled: '#56544E',
  textWhite: '#F1EEE7',
  textLink: '#F4C98F',

  // Border & Dividers
  border: '#34342E',
  borderLight: '#292923',
  borderFocus: '#E9A95F',
  divider: '#34342E',

  // Status & Feedback
  success: '#78B89A',
  successLight: '#1D3025',
  warning: '#E9A95F',
  warningLight: '#30251A',
  error: '#E88B7A',
  errorLight: '#351F1B',
  info: '#83AFC2',
  infoLight: '#1A2930',

  // Tab & Chat UI specific tokens
  tabInactive: '#AAA69D',
  tabActive: '#F1EEE7',
  tabActiveBg: '#30251A',
  chatBubbleUser: '#4C3828',
  chatBubbleUserText: '#F5E6D3',
  chatBubbleAi: '#1A1A17',
  chatBubbleAiBorder: '#34342E',
  dateBadgeBg: '#20201C',
  dateBadgeText: '#AAA69D',
  overlay: 'rgba(15, 23, 42, 0.45)',
  statusBlue: '#78B89A',
  iconDark: '#F1EEE7',
  iconMuted: '#AAA69D',
  inputBg: '#1A1A17',
  inputBarBg: '#20201C',
  inputBorder: '#34342E',
  inputBarBorder: '#34342E',
  dockBg: '#1A1A17',
  avatarPreviewBg: '#20201C',
  avatarOptionBg: '#1A1A17',
  avatarOptionSelectedBg: '#30251A',
  avatarOptionSelectedBorder: '#5C422B',
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
export default Colors;
