import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { matchPath, useLocation } from 'react-router';

const SITE = 'https://kotgambit.ru';

type PageKey =
  | 'offer'
  | 'privacy'
  | 'login'
  | 'register'
  | 'reset'
  | 'onboarding'
  | 'learn'
  | 'lesson'
  | 'puzzles'
  | 'play'
  | 'analysis'
  | 'review'
  | 'cards'
  | 'profile'
  | 'settings'
  | 'premium'
  | 'billing';

// Only the home page and the two documents are for search engines: the rest is the learner's own, behind a login
const PUBLIC_PATHS: readonly string[] = ['/', '/offer', '/privacy'];

const PAGES: readonly { path: string; key: PageKey }[] = [
  { path: '/offer', key: 'offer' },
  { path: '/privacy', key: 'privacy' },
  { path: '/login', key: 'login' },
  { path: '/register', key: 'register' },
  { path: '/reset', key: 'reset' },
  { path: '/onboarding/*', key: 'onboarding' },
  { path: '/learn', key: 'learn' },
  { path: '/lesson/*', key: 'lesson' },
  { path: '/puzzles/*', key: 'puzzles' },
  { path: '/play/*', key: 'play' },
  { path: '/analysis', key: 'analysis' },
  { path: '/review/*', key: 'review' },
  { path: '/cards', key: 'cards' },
  { path: '/profile', key: 'profile' },
  { path: '/settings', key: 'settings' },
  { path: '/premium', key: 'premium' },
  { path: '/billing/*', key: 'billing' },
];

function setMeta(selector: string, create: () => HTMLElement, set: (el: HTMLElement) => void) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  set(el);
}

/**
 * Keeps the title, the canonical address and the robots hint of the document in step with the route,
 * since the page is a single HTML file for every address.
 */
export function RouteMeta() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  useEffect(() => {
    const page = PAGES.find((item) => matchPath(item.path, pathname));
    const home = pathname === '/';
    document.title = home
      ? t('seo.home')
      : page
        ? `${t(`seo.pages.${page.key}`)} — ${t('seo.suffix')}`
        : `${t('seo.pages.notFound')} — ${t('seo.suffix')}`;

    const indexable = PUBLIC_PATHS.includes(pathname);
    setMeta(
      'meta[name="robots"]',
      () => Object.assign(document.createElement('meta'), { name: 'robots' }),
      (el) => el.setAttribute('content', indexable ? 'index, follow' : 'noindex, nofollow'),
    );
    if (indexable) {
      setMeta(
        'link[rel="canonical"]',
        () => Object.assign(document.createElement('link'), { rel: 'canonical' }),
        (el) => el.setAttribute('href', `${SITE}${pathname === '/' ? '/' : pathname}`),
      );
    }
    if (home) {
      document.head
        .querySelector('meta[name="description"]')
        ?.setAttribute('content', t('seo.homeDescription'));
    }
  }, [pathname, t]);

  return null;
}
