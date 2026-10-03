import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

function subscribe(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

/** The page stays as it was: the banner only says why nothing new arrives. */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useSyncExternalStore(subscribe, () => navigator.onLine);
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-30 bg-sun-tint px-4 py-2 text-center text-[15px] font-bold text-sun-text"
    >
      {t('system.offline.banner')}
    </div>
  );
}
