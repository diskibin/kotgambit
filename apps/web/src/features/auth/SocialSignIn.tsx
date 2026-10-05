import { useTranslation } from 'react-i18next';
import { API_URL, useOauthProvidersQuery } from '../../app/api';
import { buttonClassName } from '../../shared/ui/Button';

/**
 * Sign-in with a provider: the whole page goes to the API, which sends it on to the provider and brings
 * it back with the session. A button shows for the providers the server has keys for only.
 */
export function SocialSignIn() {
  const { t } = useTranslation();
  const { data } = useOauthProvidersQuery();
  const providers = data?.providers ?? [];
  if (providers.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-3 text-[14px] font-bold text-text-2" aria-hidden="true">
        <span className="h-0.5 flex-1 bg-line" />
        {t('auth.social.or')}
        <span className="h-0.5 flex-1 bg-line" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {providers.map((id) => (
          <a
            key={id}
            href={`${API_URL}/auth/oauth/${id}/start?client=web`}
            aria-label={t('auth.social.signInWith', { name: t(`auth.social.names.${id}`) })}
            className={buttonClassName({
              variant: 'secondary',
              fullWidth: true,
              className: 'px-2',
            })}
          >
            {t(`auth.social.names.${id}`)}
          </a>
        ))}
      </div>
    </>
  );
}
