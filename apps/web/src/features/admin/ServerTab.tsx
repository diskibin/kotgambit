import type { ServerHealth } from '@kotgambit/contracts';
import { useTranslation } from 'react-i18next';
import { useAdminHealthQuery } from '../../app/api';
import { Button } from '../../shared/ui/Button';
import { formatCount } from './format';
import { Caption, Loaded, Section, Tile, Tiles } from './parts';

const REFRESH_MS = 15_000;
const SECONDS_IN_MINUTE = 60;
const MINUTES_IN_HOUR = 60;
const HOURS_IN_DAY = 24;

function Server({ health }: { health: ServerHealth }) {
  const { t } = useTranslation();

  const uptime = () => {
    const minutes = Math.floor(health.process.uptimeSeconds / SECONDS_IN_MINUTE);
    const hours = Math.floor(minutes / MINUTES_IN_HOUR);
    if (hours >= HOURS_IN_DAY) {
      return t('admin.server.units.days', { value: Math.floor(hours / HOURS_IN_DAY) });
    }
    return hours > 0
      ? t('admin.server.units.hours', { value: hours })
      : t('admin.server.units.minutes', { value: minutes });
  };

  const probe = (result: ServerHealth['database']) =>
    result.ok ? t('admin.server.system.ok', { ms: result.ms }) : t('admin.server.system.down');

  const { engine } = health;
  return (
    <div className="grid items-start gap-6 laptop:grid-cols-2">
      <Section title={t('admin.server.engine.title')}>
        {engine ? (
          <>
            <Tiles>
              <Tile label={t('admin.server.engine.workers')} value={formatCount(engine.workers)} />
              <Tile label={t('admin.server.engine.busy')} value={formatCount(engine.busy)} />
              <Tile label={t('admin.server.engine.queued')} value={formatCount(engine.queued)} />
              <Tile
                label={t('admin.server.engine.completed')}
                value={formatCount(engine.completed)}
              />
              <Tile
                label={t('admin.server.engine.rejected')}
                value={formatCount(engine.rejected)}
              />
              <Tile label={t('admin.server.engine.failed')} value={formatCount(engine.failed)} />
              <Tile
                label={t('admin.server.engine.wait')}
                value={t('admin.server.units.ms', { value: Math.round(engine.recentWaitMs) })}
              />
            </Tiles>
            <Caption>{t('admin.server.engine.note')}</Caption>
          </>
        ) : (
          <Caption>{t('admin.server.engine.off')}</Caption>
        )}
      </Section>

      <Section title={t('admin.server.system.title')}>
        <Tiles>
          <Tile label={t('admin.server.system.database')} value={probe(health.database)} />
          <Tile label={t('admin.server.system.redis')} value={probe(health.redis)} />
          <Tile label={t('admin.server.system.uptime')} value={uptime()} />
          <Tile
            label={t('admin.server.system.memory')}
            value={t('admin.server.units.mb', { value: formatCount(health.process.memoryMb) })}
          />
          <Tile label={t('admin.server.system.node')} value={health.process.node} />
        </Tiles>
      </Section>

      <Section title={t('admin.server.work.title')}>
        <Tiles>
          <Tile
            label={t('admin.server.work.activeGames')}
            value={formatCount(health.games.active)}
          />
          <Tile
            label={t('admin.server.work.pending')}
            value={formatCount(health.reviews.pending)}
          />
          <Tile
            label={t('admin.server.work.running')}
            value={formatCount(health.reviews.running)}
          />
          <Tile
            label={t('admin.server.work.failed')}
            value={formatCount(health.reviews.failedDay)}
          />
        </Tiles>
      </Section>
    </div>
  );
}

/** The state of the server right now, looked at again every few seconds while the tab is open. */
export function ServerTab() {
  const { t } = useTranslation();
  const query = useAdminHealthQuery(undefined, { pollingInterval: REFRESH_MS });
  return (
    <div className="flex flex-col gap-6">
      <Button className="self-start" variant="secondary" onClick={() => void query.refetch()}>
        {t('admin.server.refresh')}
      </Button>
      <Loaded query={query}>{(health) => <Server health={health} />}</Loaded>
    </div>
  );
}
