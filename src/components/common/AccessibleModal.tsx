import { Modal, type ModalProps } from 'react-native';
import { useMotionPreferences } from '@/context/MotionContext';
export function AccessibleModal(props: ModalProps) {
  const { reducedMotion } = useMotionPreferences();
  return <Modal {...props} animationType={reducedMotion ? 'none' : props.animationType} />;
}
