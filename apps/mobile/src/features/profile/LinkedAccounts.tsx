import { apiErrorOf, OAUTH_PROVIDERS, type OAuthProviderId } from '@kotgambit/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';
import {
  useIdentitiesQuery,
  useOauthProvidersQuery,
  useStartLinkingProviderMutation,
  useUnlinkIdentityMutation,
} from '../../app/api';
import { Banner } from '../../shared/ui/Banner';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { Button } from '../../shared/ui/Button';
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
  const [unlink, unlinking] = useUnlinkIdentityMutation();
  // The service the learner is asked about in the sheet
  const [leaving, setLeaving] = useState<OAuthProviderId | null>(null);
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

  async function remove(provider: OAuthProviderId) {
    try {
      await unlink(provider).unwrap();
      setNotice(t('profile.accounts.unlinked', { name: t(`auth.social.names.${provider}`) }));
    } catch (error) {
      // The last way in cannot go, the server says so in its own words
      setNotice(apiErrorOf(error)?.message ?? t('profile.accounts.actionError'));
    } finally {
      setLeaving(null);
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
              accessibilityHint={tied ? t('profile.accounts.tiedHint') : undefined}
              hitSlop={TAP_SLOP}
              onPress={() => {
                setNotice(null);
                if (tied) setLeaving(id);
                else void link(id);
              }}
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
      {leaving && (
        <BottomSheet
          label={t('profile.accounts.unlinkTitle', { name: t(`auth.social.names.${leaving}`) })}
          onClose={() => setLeaving(null)}
        >
          <Text accessibilityRole="header" style={[typography.h2, { color: colors.text }]}>
            {t('profile.accounts.unlinkTitle', { name: t(`auth.social.names.${leaving}`) })}
          </Text>
          <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
            {t('profile.accounts.unlinkText', { name: t(`auth.social.names.${leaving}`) })}
          </Text>
          <View style={{ alignSelf: 'stretch', gap: space[2] }}>
            <Button
              large
              label={t('profile.accounts.unlinkKeep')}
              onPress={() => setLeaving(null)}
            />
            <Button
              variant="danger"
              label={t('profile.accounts.unlinkConfirm')}
              disabled={unlinking.isLoading}
              onPress={() => void remove(leaving)}
            />
          </View>
        </BottomSheet>
      )}
    </View>
  );
}
