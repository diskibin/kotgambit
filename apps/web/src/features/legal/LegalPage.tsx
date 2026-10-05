import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';
import { legalContact } from './legalContact';

export type LegalDocument = 'offer' | 'privacy';

interface Section {
  id?: string;
  title: string;
  items: string[];
}

const OTHER: Record<LegalDocument, { path: string; label: 'otherOffer' | 'otherPrivacy' }> = {
  offer: { path: '/privacy', label: 'otherPrivacy' },
  privacy: { path: '/offer', label: 'otherOffer' },
};

/** The public offer and the privacy policy: plain numbered text for people who read before they agree. */
export function LegalPage({ document }: { document: LegalDocument }) {
  const { t } = useTranslation();
  const scheme = useScheme();
  const { hash } = useLocation();
  const contact = legalContact();
  const sections = t(`legal.${document}.sections`, {
    returnObjects: true,
    ...contact,
  }) as unknown as Section[];
  const other = OTHER[document];

  // A link to a part of the page, such as the cookies or the contacts, scrolls to it
  useEffect(() => {
    if (hash) globalThis.document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-bg text-text">
      <header className="flex h-20 items-center self-stretch px-4 tablet:px-12">
        <Link to="/" className="flex items-center gap-2.5 font-heading text-[19px] font-bold">
          <Mascot mood="idle" size={44} dark={scheme === 'dark'} />
          {t('auth.logo')}
        </Link>
      </header>

      <main className="flex w-full max-w-[760px] flex-col gap-6 px-4 pb-16">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-heading text-[28px] leading-9 font-bold tablet:text-[34px]">
            {t(`legal.${document}.title`)}
          </h1>
          <p className="m-0 text-[14px] font-semibold text-text-2">{t('legal.edition')}</p>
        </div>

        {sections.map((section, index) => (
          <section key={section.title} id={section.id} className="flex flex-col gap-2">
            <h2 className="m-0 font-heading text-[20px] leading-7 font-bold">
              {index + 1}. {section.title}
            </h2>
            {section.items.map((item, position) => (
              <p key={item} className="m-0 text-[16px] leading-[26px] font-medium">
                <span className="font-extrabold text-text-2">
                  {index + 1}.{position + 1}
                </span>{' '}
                {item}
              </p>
            ))}
          </section>
        ))}

        <nav className="flex flex-wrap gap-x-6 gap-y-2 border-t-2 border-line pt-4 text-[16px] font-extrabold">
          <Link to={other.path} className="flex min-h-11 items-center text-brand-text">
            {t(`legal.${other.label}`)}
          </Link>
          <Link to="/" className="flex min-h-11 items-center text-brand-text">
            {t('legal.home')}
          </Link>
        </nav>
      </main>
    </div>
  );
}
