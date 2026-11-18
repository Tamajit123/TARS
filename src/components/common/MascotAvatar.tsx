/**
 * MascotAvatar Component
 *
 * Simple 3D character mascot avatar portrait.
 */

import React from 'react';
import { Image, StyleSheet, ImageStyle, StyleProp, Text, View } from 'react-native';
import { useAppTheme } from '@/context/ThemeContext';
import type { ColorPalette } from '@/constants/colors';
import { Colors as DefaultColors } from '@/constants/colors';

export interface MascotAvatarProps {
  /** Avatar diameter in pixels (defaults to 54) */
  size?: number;
  /** Emoji avatar icon, or 'tars' to render the original mascot image */
  icon?: string;
  /** Accent color for emoji avatar backgrounds */
  color?: string;
  /** Optional custom image style */
  style?: StyleProp<ImageStyle>;
}

export const MascotAvatar: React.FC<MascotAvatarProps> = ({
  size = 54,
  icon = 'tars',
  color = DefaultColors.primary,
  style,
}) => {
  const { colors: Colors, resolved } = useAppTheme();
  const styles = createStyles(Colors);
  if (icon !== 'tars') {
    return (
      <View
        style={[
          styles.emojiAvatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: `${color}18`,
            borderColor: color,
          },
          style as any,
        ]}>
        <Text style={[styles.emojiText, { fontSize: Math.round(size * 0.52) }]}>
          {icon}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={resolved === 'dark' ? require('../../../assets/icons/tars-dark.png') : require('../../../assets/icons/tars-light.png')}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
      resizeMode="cover"
    />
  );
};

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  avatar: {
    backgroundColor: Colors.avatarPreviewBg,
  },
  emojiAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  emojiText: {
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: undefined,
  },
});

export default MascotAvatar;
