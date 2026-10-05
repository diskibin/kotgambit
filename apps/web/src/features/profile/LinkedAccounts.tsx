import {
  apiErrorOf,
  OAUTH_PROVIDERS,
  OAuthErrorSchema,
  OAuthProviderSchema,
  type OAuthProviderId,
} from '@kotgambit/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import {
  useIdentitiesQuery,
  useOauthProvidersQuery,
  useStartLinkingProviderMutation,
  useUnlinkIdentityMutation,
} from '../../app/api';
import { Banner } from '../../shared/ui/Banner';
import { ProviderIcon } from '../auth/ProviderIcon';

/** The services the learner can sign in with, and the way to tie one more to the account or let one go. */
export function LinkedAccounts() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const identities = useIdentitiesQuery();
  const providers = useOauthProvidersQuery();
  const [startLinking, starting] = useStartLinkingProviderMutation();
  const [unlink, unlinking] = useUnlinkIdentityMutation();
  const [failure, setFailure] = useState<string | null>(null);

  const linkedNow = OAuthProviderSchema.safeParse(params.get('linked'));
  const oauthError = OAuthErrorSchema.safeParse(params.get('oauth_error'));
  const linked = new Set(identities.data?.identities.map((identity) => identity.provider));
  const enabled = new Set(providers.data?.providers);
  // A provider that is tied stays in the list even if the server has no keys for it now
  const shown = OAUTH_PROVIDERS.filter((id) => enabled.has(id) || linked.has(id));
  const busy = starting.isLoading || unlinking.isLoading;

  async function link(provider: OAuthProviderId) {
    setFailure(null);
    try {
      const { url } = await startLinking({ provider, client: 'web' }).unwrap();
      // The whole page goes to the provider and comes back to the profile
      window.location.assign(url);
    } catch (error) {
      setFailure(apiErrorOf(error)?.message ?? t('profile.accounts.actionError'));
    }
  }

  async function remove(provider: OAuthProviderId) {
    setFailure(null);
    try {
      await unlink(provider).unwrap();
    } catch (error) {
      setFailure(apiErrorOf(error)?.message ?? t('profile.accounts.actionError'));
    }
  }

  if (identities.isError) {
    return (
      <section
        aria-label={t('profile.accounts.label')}
        className="rounded-card border-2 border-line bg-surface p-5"
      >
        <Banner>{t('profile.accounts.loadError')}</Banner>
      </section>
    );
  }
  if (!identities.data || shown.length === 0) return null;

  return (
    <section
      aria-label={t('profile.accounts.label')}
      className="flex flex-col gap-2.5 rounded-card border-2 border-line bg-surface p-5"
    >
      <h2 className="m-0 font-heading text-[18px] font-bold">{t('profile.accounts.title')}</h2>
      {linkedNow.success && (
        <Banner>
          {t('profile.accounts.justLinked', { name: t(`auth.social.names.${linkedNow.data}`) })}
        </Banner>
      )}
      {oauthError.success && <Banner>{t(`auth.social.errors.${oauthError.data}`)}</Banner>}
      {failure && <Banner>{failure}</Banner>}
      {shown.map((id) => {
        const name = t(`auth.social.names.${id}`);
        const tied = linked.has(id);
        return (
          <div key={id} className="flex min-h-12 items-center gap-3">
            <ProviderIcon id={id} />
            <div className="flex grow flex-col">
              <b className="text-[16px]">{name}</b>
              <span className={`text-[13px] font-bold ${tied ? 'text-mint-text' : 'text-text-2'}`}>
                {t(tied ? 'profile.accounts.linked' : 'profile.accounts.notLinked')}
              </span>
            </div>
            <button
              type="button"
              disabled={busy}
              aria-label={t(tied ? 'profile.accounts.unlinkNamed' : 'profile.accounts.linkNamed', {
                name,
              })}
              onClick={() => void (tied ? remove(id) : link(id))}
              className={`min-h-11 rounded-control px-3.5 text-[14px] font-extrabold disabled:opacity-85 ${
                tied
                  ? 'text-text-2'
                  : 'border-2 border-edge bg-surface text-text shadow-shashka active:translate-x-press active:translate-y-press active:shadow-none motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0'
              }`}
            >
              {t(tied ? 'profile.accounts.unlink' : 'profile.accounts.link')}
            </button>
          </div>
        );
      })}
    </section>
  );
}
