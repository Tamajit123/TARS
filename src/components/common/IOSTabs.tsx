import { NativeTabs } from 'expo-router/native-tabs';
import { useAppTheme } from '@/context/ThemeContext';
import { useMotionPreferences } from '@/context/MotionContext';
import { selectionFeedback } from '@/lib/haptics';

/** The iPhone's real tab bar: system sizing, SF Symbols, materials and accessibility. */
export function IOSTabs() {
  const { colors, resolved } = useAppTheme();
  const { reducedTransparency } = useMotionPreferences();
  return <NativeTabs tintColor={colors.primary} backgroundColor={reducedTransparency ? colors.surface : undefined} blurEffect={reducedTransparency ? 'none' : resolved === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} disableTransparentOnScrollEdge>
    <NativeTabs.Trigger disableAutomaticContentInsets name="index" hidden />
    <NativeTabs.Trigger disableAutomaticContentInsets name="chat" listeners={{tabPress:selectionFeedback}}><NativeTabs.Trigger.Icon sf={{default:'bubble.left.and.bubble.right',selected:'bubble.left.and.bubble.right.fill'}} /><NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger disableAutomaticContentInsets name="feed" listeners={{tabPress:selectionFeedback}}><NativeTabs.Trigger.Icon sf={{default:'tray',selected:'tray.fill'}} /><NativeTabs.Trigger.Label>Feed</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger disableAutomaticContentInsets name="ideas" listeners={{tabPress:selectionFeedback}}><NativeTabs.Trigger.Icon sf={{default:'lightbulb',selected:'lightbulb.fill'}} /><NativeTabs.Trigger.Label>Ideas</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger disableAutomaticContentInsets name="tasks" listeners={{tabPress:selectionFeedback}}><NativeTabs.Trigger.Icon sf={{default:'checkmark.circle',selected:'checkmark.circle.fill'}} /><NativeTabs.Trigger.Label>Tasks</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger disableAutomaticContentInsets name="settings" listeners={{tabPress:selectionFeedback}}><NativeTabs.Trigger.Icon sf="gearshape.fill" /><NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>;
}
