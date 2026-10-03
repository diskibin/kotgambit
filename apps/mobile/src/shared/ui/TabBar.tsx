import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { shashka, size } from '../../theme/theme';

export type TabId = 'path' | 'tasks' | 'play' | 'analysis' | 'profile';

// The icons of the design (ATabBar.dc.html), drawn in a 24 by 24 box with a 2.4 stroke
const TABS: readonly { id: TabId; icon: string }[] = [
  {
    id: 'path',
    icon: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20M9 8h7M9 12h5',
  },
  {
    id: 'tasks',
    icon: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z',
  },
  {
    id: 'play',
    icon: 'M12 3.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM8 21h8M8.5 21c0-4 1.5-7.5 3.5-9 2 1.5 3.5 5 3.5 9M9.5 12h5',
  },
  {
    id: 'analysis',
    icon: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM16.5 16.5L21 21M8.5 13v-2M11 13V9M13.5 13v-3',
  },
  {
    id: 'profile',
    icon: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4.5 20.5c1.2-4 4.2-6 7.5-6s6.3 2 7.5 6',
  },
];

const PILL_WIDTH = 52;
const PILL_HEIGHT = 30;
const ICON = 22;

interface TabBarProps {
  active: TabId;
  onSelect: (tab: TabId) => void;
}

/** The five places of the app, at the bottom of every screen outside the focus mode (mobile/README.md). */
export function TabBar({ active, onSelect }: TabBarProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('nav.label')}
      style={{
        flexDirection: 'row',
        height: size.bottomNav + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: colors.surface,
        borderTopWidth: shashka.border,
        borderTopColor: colors.line,
      }}
    >
      {TABS.map((tab) => {
        const on = tab.id === active;
        const color = on ? colors.brandText : colors.text2;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={t(`nav.${tab.id}`)}
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(tab.id)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}
          >
            <View
              style={{
                width: PILL_WIDTH,
                height: PILL_HEIGHT,
                borderRadius: PILL_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? colors.brandTint : 'transparent',
                borderWidth: on ? shashka.border : 0,
                borderColor: colors.edge,
              }}
            >
              <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none">
                <Path
                  d={tab.icon}
                  stroke={color}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text style={{ fontFamily: 'Onest-Bold', fontSize: 12, lineHeight: 16, color }}>
              {t(`nav.${tab.id}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
