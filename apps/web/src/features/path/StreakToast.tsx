import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProgressQuery } from '../../app/api';
import { localDateKey } from '../../shared/localDate';
import { CloseIcon } from '../../shared/ui/icons';

const KEY = 'kotgambit.streak-seen';

function readSeen(): number | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

/** Tells once that the streak grew since the last visit to this screen. The first visit only remembers it. */
export function StreakToast() {
  const { t } = useTranslation();
  const progress = useProgressQuery(localDateKey());
  const streak = progress.data?.streakDays;
  // What was seen before this visit decides the toast, so it is read once and the new value is saved after
  const [seen] = useState(readSeen);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (streak === undefined) return;
    try {
      window.localStorage.setItem(KEY, String(streak));
    } catch {
      // The toast may show again next time: harmless
    }
  }, [streak]);

  if (closed || streak === undefined || seen === null || streak <= seen) return null;
  return (
    <div
      role="status"
      className="fixed top-6 right-6 z-30 flex max-w-[360px] items-start gap-3 rounded-card border-2 border-edge bg-ink px-4 py-3 text-on-ink shadow-shashka"
    >
      <div className="flex flex-1 flex-col">
        <b className="text-[16px]">{t('path.toast.title')}</b>
        <span className="text-[14px] font-semibold">{t('path.toast.text', { count: streak })}</span>
      </div>
      <button
        type="button"
        aria-label={t('path.toast.close')}
        onClick={() => setClosed(true)}
        className="flex size-11 shrink-0 items-center justify-center rounded-control text-on-ink"
      >
        <CloseIcon size={20} />
      </button>
    </div>
  );
}
