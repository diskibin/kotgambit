import { formatLine, formatScore, whiteShare } from '@kotgambit/game-player';
import type { PositionAnalysis } from '@kotgambit/contracts';
import { useTranslation } from 'react-i18next';

/** The card with the evaluation, the chances, the best move and the lines of an analysed position. */
export function AnalysisResult({ analysis }: { analysis: PositionAnalysis }) {
  const { t } = useTranslation();
  const share = whiteShare(analysis.score);
  const { outlook } = analysis;
  const segments = [
    { key: 'white', percent: outlook.white, tone: 'bg-white text-ink' },
    { key: 'draw', percent: outlook.draw, tone: 'bg-surface-2 text-text' },
    { key: 'black', percent: outlook.black, tone: 'bg-ink text-white' },
  ] as const;

  return (
    <section
      aria-label={t('analysis.result.score', { score: formatScore(analysis.score) })}
      className="flex flex-col gap-4 rounded-card border-2 border-edge bg-surface p-4 shadow-shashka"
    >
      <div className="flex items-center gap-4">
        <span className="rounded-card border-2 border-edge bg-surface-2 px-3 py-2 font-heading text-[26px] font-bold">
          {formatScore(analysis.score)}
        </span>
        <div className="flex flex-col">
          <h2 className="m-0 font-heading text-[20px] leading-7 font-bold">{analysis.headline}</h2>
          <p className="m-0 text-[15px] font-semibold text-text-2">{analysis.detail}</p>
        </div>
      </div>

      <div
        role="meter"
        aria-label={t('analysis.result.scale', { white: share })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={share}
        className="flex h-4 overflow-hidden rounded-pill border-2 border-edge bg-ink"
      >
        <div style={{ width: `${share}%` }} className="bg-white" />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-[15px] font-extrabold">{t('analysis.result.outlook')}</h3>
        <ul className="m-0 flex list-none gap-1 p-0">
          {segments.map(({ key, percent, tone }) => (
            <li
              key={key}
              style={{ flexGrow: Math.max(percent, 12) }}
              className={`rounded-control border-2 border-edge px-2 py-1 text-center text-[14px] font-bold ${tone}`}
            >
              {t(`analysis.result.${key}`)} {percent}%
            </li>
          ))}
        </ul>
      </div>

      {analysis.best && (
        <div className="flex flex-col gap-1 rounded-card bg-mint-tint p-3">
          <span className="text-[15px] font-extrabold text-mint-text">
            {`★ ${analysis.best.san}`}
          </span>
          <span className="text-[15px] font-semibold">
            {t('analysis.result.best')}: {analysis.best.explanation}
          </span>
        </div>
      )}

      {analysis.lines.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-[15px] font-extrabold">{t('analysis.result.lines')}</h3>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {analysis.lines.map((line, index) => (
              <li key={index} className="flex items-baseline gap-3 text-[15px] font-semibold">
                <span className="w-14 shrink-0 font-bold">{formatScore(line.score)}</span>
                <span className="font-mono text-[14px]">{formatLine(analysis.fen, line.san)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
