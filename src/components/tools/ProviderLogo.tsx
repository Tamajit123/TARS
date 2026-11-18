import { Image, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { getProvider } from '@/constants/providers';
import {providerSvg} from '@/lib/providerSvg';

export function ProviderLogo({ identifiers, name, uri, size = 28 }: { identifiers: (string | null | undefined)[]; name: string; uri?: string | null; size?: number }) {
  const provider = getProvider(...identifiers, name);
  return <View accessibilityRole="image" accessibilityLabel={`${provider?.name || name} logo`} style={{ width: size + 12, height: size + 12, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E7E5E1' }}>
    {provider ? <SvgXml xml={providerSvg(provider.logo)} width={size} height={size} /> : uri ? <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" /> : <Text style={{ color: '#24221E', fontWeight: '700' }}>{name.slice(0, 1)}</Text>}
  </View>;
}
