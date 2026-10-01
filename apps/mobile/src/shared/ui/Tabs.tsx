import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, shashka, size } from '../../theme/theme';

interface Tab<Id extends string> {
  id: Id;
  label: string;
}

interface TabsProps<Id extends string> {
  label: string;
  tabs: readonly Tab<Id>[];
  value: Id;
  onChange: (id: Id) => void;
}

const TAB_FONT = 'Onest-ExtraBold';
const TRACK_PADDING = 4;

/** Segmented control: the active segment is a plate with an outline and no shadow. */
export function Tabs<Id extends string>({ label, tabs, value, onChange }: TabsProps<Id>) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        gap: TRACK_PADDING,
        padding: TRACK_PADDING,
        borderRadius: radius.card,
        backgroundColor: colors.surface2,
      }}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.id)}
            style={{
              flex: 1,
              minHeight: size.tapMin,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.control - 2,
              borderWidth: shashka.border,
              borderColor: selected ? colors.edge : 'transparent',
              backgroundColor: selected ? colors.surface : 'transparent',
            }}
          >
            <Text
              style={{
                fontFamily: TAB_FONT,
                fontSize: 16,
                color: selected ? colors.text : colors.text2,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
