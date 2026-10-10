import React from 'react';
import type { PerkItemStatus, ShopItem } from '../../types';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { CONTEXTUAL_HINT, formatRemaining, perkDetail, perkLabel, perkResetLabel, POWER_PRESENTATION } from './storeCatalog';
import { accentTile, Coins, Icon, SectionTitle, tone } from './storeUi';

interface PowersSectionProps {
  items: ShopItem[];
  perkFor: (itemKey: string) => PerkItemStatus | undefined;
  boostMinutesLeft: number;
  likesUnlockMinutesLeft: number;
  likesIncludedInPlan: boolean;
  onSelect: (item: ShopItem) => void;
}

export const PowersSection: React.FC<PowersSectionProps> = ({
  items,
  perkFor,
  boostMinutesLeft,
  likesUnlockMinutesLeft,
  likesIncludedInPlan,
  onSelect,
}) => {
  const direct = items.filter((i) => !(i.key in CONTEXTUAL_HINT));
  const contextual = items.filter((i) => i.key in CONTEXTUAL_HINT);

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle kicker="Sin plan, cuando lo necesites" title="Poderes sueltos" />

      {direct.length > 0 && (
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
          {direct.map((item) => {
            const presentation = POWER_PRESENTATION[item.key] ?? { icon: 'bolt', accent: 'coral' as const };
            const perk = perkFor(item.key);
            const included = perkDetail(perk);
            const resetLabel = perkResetLabel(perk);
            const activeFor =
              item.key === 'BOOST' && boostMinutesLeft > 0
                ? boostMinutesLeft
                : item.key === 'LIKES_UNLOCK' && likesUnlockMinutesLeft > 0
                  ? likesUnlockMinutesLeft
                  : 0;
            const coveredByPlan = item.key === 'LIKES_UNLOCK' && likesIncludedInPlan;
            const disabled = activeFor > 0 || coveredByPlan;

            return (
              <article key={item.key} className={cn('rounded-[var(--radius-md)] border p-4 flex flex-col gap-3', tone.surface)}>
                <div className="flex items-start justify-between gap-2">
                  <div className={cn('w-10 h-10 rounded-[var(--radius-sm)] flex items-center justify-center', accentTile(presentation.accent))}>
                    <Icon name={presentation.icon} filled className="text-[21px]" />
                  </div>
                  {(activeFor > 0 || coveredByPlan) && (
                    <span className="rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                      {coveredByPlan ? 'En tu plan' : `Activo · ${formatRemaining(activeFor)}`}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className={cn('text-[14.5px] font-bold leading-snug', tone.strong)}>{item.name}</h4>
                  <p className={cn('text-[12.5px] leading-snug mt-1', tone.muted)}>{item.description}</p>
                  {resetLabel && <p className="text-[12px] mt-1.5 text-emerald-700 dark:text-emerald-300">{resetLabel}</p>}
                </div>
                <Button
                  variant={disabled ? 'secondary' : included ? 'secondary' : 'primary'}
                  size="sm"
                  disabled={disabled}
                  onClick={() => onSelect(item)}
                  className="w-full h-10 rounded-[var(--radius-pill)] text-[13px]"
                >
                  {coveredByPlan ? (
                    'Incluido'
                  ) : activeFor > 0 ? (
                    'Ya está activo'
                  ) : included ? (
                    `Usar · ${included}`
                  ) : (
                    <Coins amount={item.price} iconClassName="text-white" />
                  )}
                </Button>
              </article>
            );
          })}
        </div>
      )}

      {contextual.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Poderes que se usan en contexto">
          <p className={cn('px-1 text-[12px] font-semibold uppercase tracking-[0.12em]', tone.muted)}>Se usan en el momento justo</p>
          {contextual.map((item) => {
            const presentation = POWER_PRESENTATION[item.key] ?? { icon: 'info', accent: 'coral' as const };
            const included = perkLabel(perkFor(item.key));
            return (
              <div
                key={item.key}
                className={cn('rounded-[var(--radius-md)] border border-dashed p-3.5 flex items-center gap-3', tone.sunken, tone.divider)}
              >
                <div className={cn('w-9 h-9 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0', accentTile(presentation.accent))}>
                  <Icon name={presentation.icon} filled className="text-[19px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[13.5px] font-bold', tone.strong)}>
                    {item.name}
                    <span className={cn('font-semibold', tone.muted)}>
                      {' · '}
                      {included ?? `${item.price.toLocaleString('es-AR')} coins`}
                    </span>
                  </p>
                  <p className={cn('text-[12.5px]', tone.muted)}>{CONTEXTUAL_HINT[item.key]}</p>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
};
