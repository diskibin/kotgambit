import type { Mood } from '@kotgambit/mascot';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';

interface StepFrameProps {
  /** "Основы · глава 9 · шаг 2 из 5" */
  caption: string;
  title: string;
  mood: Mood;
  /** The board, with whatever sits under it. */
  board?: ReactNode;
  /** The reply card and the cat's words, under the title. */
  children: ReactNode;
  /** The line of help under the board. */
  boardNote?: boolean;
}

/**
 * The frame every step shares: the board on the left, the title, the cat's reply card and the cat on
 * the right. Narrow screens stack them, the board first.
 */
export function StepFrame({
  caption,
  title,
  mood,
  board,
  children,
  boardNote = false,
}: StepFrameProps) {
  const { t } = useTranslation();
  const scheme = useScheme();
  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-8 px-4 pr-6 pb-10 laptop:grid-cols-[minmax(0,560px)_minmax(0,460px)] laptop:justify-center">
      {board && (
        <div className="flex flex-col gap-3">
          {board}
          {boardNote && (
            <p className="m-0 text-[14px] font-semibold text-text-muted">{t('lesson.boardHint')}</p>
          )}
        </div>
      )}
      <div
        className={`flex flex-col gap-4 ${board ? '' : 'laptop:col-span-2 laptop:mx-auto laptop:w-[620px]'}`}
      >
        <p className="m-0 text-[14px] font-bold text-text-2">{caption}</p>
        <h1 className="m-0 font-heading text-[26px] leading-9 font-bold laptop:text-[31px] laptop:leading-10">
          {title}
        </h1>
        {children}
        <div className="flex justify-start pl-4">
          <Mascot mood={mood} size={110} dark={scheme === 'dark'} animate />
        </div>
      </div>
    </div>
  );
}
