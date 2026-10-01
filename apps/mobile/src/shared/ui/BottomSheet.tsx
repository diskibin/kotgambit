import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, shashka, space } from '../../theme/theme';

const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 4;

interface BottomSheetProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/** A sheet from the bottom edge with a handle. The system Back button and a tap on the dim area close it. */
export function BottomSheet({ label, onClose, children }: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel={label}
        onPress={onClose}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim }}
      >
        {/* A press inside the sheet must not reach the dim area */}
        <Pressable
          accessibilityViewIsModal
          style={{
            alignItems: 'center',
            gap: space[3],
            padding: space[4],
            paddingBottom: insets.bottom + space[4],
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            borderTopWidth: shashka.borderLarge,
            borderColor: colors.edge,
            backgroundColor: colors.surface,
          }}
        >
          <View
            style={{
              width: HANDLE_WIDTH,
              height: HANDLE_HEIGHT,
              borderRadius: HANDLE_HEIGHT,
              backgroundColor: colors.line,
            }}
          />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
