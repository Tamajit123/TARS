import { Platform, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { HugeiconsIcon } from '@hugeicons/react-native';
import type { ComponentProps } from 'react';

export function NativeIcon({ symbol, fallback, color, size = 22 }: { symbol: ComponentProps<typeof SymbolView>['name']; fallback: ComponentProps<typeof HugeiconsIcon>['icon']; color: string; size?: number }) {
  return Platform.OS === 'ios' ? <SymbolView name={symbol} tintColor={color} size={size} weight="regular" style={{ width: size, height: size }} /> : <View><HugeiconsIcon icon={fallback} color={color} size={size} strokeWidth={1.8} /></View>;
}
