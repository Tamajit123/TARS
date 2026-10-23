import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowRight01Icon, Settings01Icon, SparklesIcon } from '@hugeicons/core-free-icons';
import { Colors } from '@/constants/colors';

export interface SettingsMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onEditAvatar: () => void;
  onOpenSettings: () => void;
}

export const SettingsMenuModal: React.FC<SettingsMenuModalProps> = ({ visible, onClose, onEditAvatar, onOpenSettings }) => {
  const insets = useSafeAreaInsets();
  const actions = [
    { label: 'Personalize TARS', icon: SparklesIcon, action: onEditAvatar },
    { label: 'Open settings', icon: Settings01Icon, action: onOpenSettings },
  ];
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableWithoutFeedback onPress={onClose}><View style={[styles.overlay, { paddingTop: Math.max(insets.top, 12) + 50 }]}>
      <TouchableWithoutFeedback><View style={styles.card}>{actions.map(({ label, icon, action }) => <Pressable key={label} style={({ pressed }) => [styles.item, pressed && styles.pressed]} onPress={() => { onClose(); action(); }} accessibilityRole="button"><HugeiconsIcon icon={icon} size={18} color={Colors.primaryLight} strokeWidth={1.8} /><Text style={styles.label}>{label}</Text><HugeiconsIcon icon={ArrowRight01Icon} size={16} color={Colors.textMuted} /></Pressable>)}</View></TouchableWithoutFeedback>
    </View></TouchableWithoutFeedback>
  </Modal>;
};

const styles = StyleSheet.create({ overlay: { flex: 1, backgroundColor: Colors.overlay, alignItems: 'flex-end', paddingHorizontal: 16 }, card: { width: 224, backgroundColor: Colors.surfaceElevated, borderRadius: 16, padding: 6, borderWidth: 1, borderColor: Colors.border, ...Platform.select({ ios: { shadowColor: Colors.black, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 16 }, android: { elevation: 8 } }) }, item: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 11, paddingHorizontal: 10 }, pressed: { backgroundColor: Colors.surfaceMuted }, label: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: '600' } });

export default SettingsMenuModal;
