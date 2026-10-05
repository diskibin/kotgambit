import { apiErrorOf, OAUTH_PROVIDERS, type OAuthProviderId } from '@kotgambit/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';
import {
  useIdentitiesQuery,
  useOauthProvidersQuery,
  useStartLinkingProviderMutation,
} from '../../app/api';
import { Banner } from '../../shared/ui/Banner';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space, typography } from '../../theme/theme';
import { useOAuthDeepLink } from '../auth/useOAuthDeepLink';

const CHIP_HEIGHT = 28;
// The chip is small by the design, the finger gets 48 dp around it
const TAP_SLOP = 10;

/** The services the learner signs in with, and the way to tie one more to the account. */
export function LinkedAccounts() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const identities = useIdentitiesQuery();
  const providers = useOauthProvidersQuery();
  const [startLinking] = useStartLinkingProviderMutation();
  const [notice, setNotice] = useState<string | null>(null);

  // The browser tells how it went by a deep link, the account was tied on the server before that
  useOAuthDeepLink((link) => {
    if (link.kind === 'linked') {
      setNotice(
        t('profile.accounts.justLinked', { name: t(`auth.social.names.${link.provider}`) }),
      );
      void identities.refetch();
    } else if (link.kind === 'error') {
      setNotice(t(`auth.social.errors.${link.error}`));
    }
  });

  const linked = new Set(identities.data?.identities.map((identity) => identity.provider));
  const enabled = new Set(providers.data?.providers);
  // A provider that is tied stays in the list even if the server has no keys for it now
  const shown = OAUTH_PROVIDERS.filter((id) => enabled.has(id) || linked.has(id));
  if (!identities.data || shown.length === 0) return null;

  async function link(provider: OAuthProviderId) {
    setNotice(null);
    try {
      const { url } = await startLinking({ provider, client: 'mobile' }).unwrap();
      await Linking.openURL(url);
    } catch (error) {
      setNotice(apiErrorOf(error)?.message ?? t('profile.accounts.actionError'));
    }
  }

  return (
    <View
      accessibilityLabel={t('profile.accounts.label')}
      style={{
        gap: space[2],
        padding: space[3],
        borderRadius: radius.card,
        borderWidth: 2,
        borderColor: colors.line,
        backgroundColor: colors.surface,
      }}
    >
      <Text accessibilityRole="header" style={[typography.h3, { color: colors.text }]}>
        {t('profile.accounts.mobileTitle')}
      </Text>
      {notice && <Banner>{notice}</Banner>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {shown.map((id) => {
          const name = t(`auth.social.names.${id}`);
          const tied = linked.has(id);
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={
                tied
                  ? t('profile.accounts.tiedNamed', { name })
                  : t('profile.accounts.linkNamed', { name })
              }
              accessibilityState={{ disabled: tied }}
              disabled={tied}
              hitSlop={TAP_SLOP}
              onPress={() => void link(id)}
              style={{
                height: CHIP_HEIGHT,
                paddingHorizontal: space[3],
                borderRadius: radius.pill,
                justifyContent: 'center',
                backgroundColor: tied ? colors.mintTint : colors.surface2,
              }}
            >
              <Text style={[typography.caption, { color: tied ? colors.mintText : colors.text2 }]}>
                {tied ? `${name} ✓` : `${name} · ${t('profile.accounts.linkShort')}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
