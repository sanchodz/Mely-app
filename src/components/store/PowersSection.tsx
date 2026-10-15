import React from 'react';
import type { MembershipTier, PerkItemStatus, ShopItem } from '../../types';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import {
  CONTEXTUAL_HINT,
  formatRemaining,
  includedFrom,
  perkDetail,
  perkLabel,
  perkResetLabel,
  POWER_PRESENTATION,
  type PowerPresentation,
  TIER_RANK,
  TIER_SHORT_NAME,
} from './storeCatalog';
import { accentTile, Coins, Icon, Pill, SectionTitle, tone } from './storeUi';

interface PowersSectionProps {
  items: ShopItem[];
  currentTier: MembershipTier;
  perkFor: (itemKey: string) => PerkItemStatus | undefined;
  boostMinutesLeft: number;
  likesUnlockMinutesLeft: number;
  likesIncludedInPlan: boolean;
  onSelect: (item: ShopItem) => void;
  onSeePlans: () => void;
}

const FALLBACK: PowerPresentation = { icon: 'bolt', accent: 'coral', useCase: '' };

/**
 * Comparación honesta "suelto vs. plan": si un plan superior al tuyo lo trae
 * incluido, se dice y se puede ir a verlo. Sale de COMPARISON_ROWS.
 */
const PlanAlternative: React.FC<{ itemKey: string; currentTier: MembershipTier; onSeePlans: () => void }> = ({
  itemKey,
  currentTier,
  onSeePlans,
}) => {
  const from = includedFrom(itemKey);
  if (!from || TIER_RANK[from.tier] <= TIER_RANK[currentTier]) return null;
  const detail = typeof from.value === 'string' ? `: ${from.value.toLowerCase()}` : '';
  return (
    <button
      type="button"
      onClick={onSeePlans}
      className={cn('self-start inline-flex items-center gap-1 text-[12px] font-semibold underline-offset-4 hover:underline', tone.accent)}
    >
      Incluido desde {TIER_SHORT_NAME[from.tier]}
      {detail}
      <Icon name="chevron_right" className="text-[16px]" />
    </button>
  );
};

export const PowersSection: React.FC<PowersSectionProps> = ({
  items,
  currentTier,
  perkFor,
  boostMinutesLeft,
  likesUnlockMinutesLeft,
  likesIncludedInPlan,
  onSelect,
  onSeePlans,
}) => {
  const direct = items.filter((i) => !(i.key in CONTEXTUAL_HINT));
  const contextual = items.filter((i) => i.key in CONTEXTUAL_HINT);

  return (
    <div className="flex flex-col gap-7">
      <SectionTitle kicker="Sin plan, cuando lo necesites" title="Poderes sueltos" />

      {direct.length > 0 && (
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {direct.map((item) => {
            const presentation = POWER_PRESENTATION[item.key] ?? FALLBACK;
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
              <article
                key={item.key}
                aria-labelledby={`power-${item.key}`}
                className={cn('rounded-[var(--radius-lg)] border p-4 sm:p-5 flex flex-col gap-3 shadow-elevation-sm', tone.surface)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={cn('w-11 h-11 rounded-[var(--radius-md)] flex items-center justify-center', accentTile(presentation.accent))}>
                    <Icon name={presentation.icon} filled className="text-[22px]" />
                  </div>
                  {disabled ? (
                    <Pill tone="ok" icon="check" className="px-2 py-0.5 text-[11px]">
                      {coveredByPlan ? 'En tu plan' : `Activo · ${formatRemaining(activeFor)}`}
                    </Pill>
                  ) : included ? (
                    <Pill tone="ok" className="px-2 py-0.5 text-[11px]">
                      Incluido · {included}
                    </Pill>
                  ) : null}
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <h4 id={`power-${item.key}`} className={cn('text-[15px] font-bold leading-snug', tone.strong)}>
                    {item.name}
                  </h4>
                  {presentation.useCase && (
                    <p className={cn('text-[13px] font-semibold leading-snug', tone.strong)}>{presentation.useCase}</p>
                  )}
                  <p className={cn('text-[12.5px] leading-snug', tone.muted)}>{item.description}</p>
                  {resetLabel && <p className="text-[12px] mt-0.5 text-emerald-700 dark:text-emerald-300">{resetLabel}</p>}
                </div>
                {!disabled && !included && <PlanAlternative itemKey={item.key} currentTier={currentTier} onSeePlans={onSeePlans} />}
                <Button
                  variant={disabled || included ? 'secondary' : 'primary'}
                  size="sm"
                  disabled={disabled}
                  onClick={() => onSelect(item)}
                  aria-label={
                    disabled ? undefined : included ? `Usar ${item.name}, incluido en tu plan` : `Comprar ${item.name} por ${item.price} coins`
                  }
                  className="w-full h-10 rounded-[var(--radius-pill)] text-[13px]"
                >
                  {coveredByPlan ? (
                    'Incluido'
                  ) : activeFor > 0 ? (
                    'Ya está activo'
                  ) : included ? (
                    'Usar ahora'
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
          <div className="grid gap-2 lg:grid-cols-2 lg:gap-3">
            {contextual.map((item) => {
              const presentation = POWER_PRESENTATION[item.key] ?? { ...FALLBACK, icon: 'info' };
              const included = perkLabel(perkFor(item.key));
              return (
                <div
                  key={item.key}
                  className={cn('rounded-[var(--radius-md)] border border-dashed p-3.5 flex items-start gap-3', tone.sunken, tone.divider)}
                >
                  <div className={cn('w-9 h-9 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0', accentTile(presentation.accent))}>
                    <Icon name={presentation.icon} filled className="text-[19px]" />
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <p className={cn('text-[13.5px] font-bold', tone.strong)}>
                      {item.name}
                      <span className={cn('font-semibold', tone.muted)}>
                        {' · '}
                        {included ?? `${item.price.toLocaleString('es-AR')} coins`}
                      </span>
                    </p>
                    {presentation.useCase && <p className={cn('text-[12.5px]', tone.strong)}>{presentation.useCase}</p>}
                    <p className={cn('text-[12.5px]', tone.muted)}>{CONTEXTUAL_HINT[item.key]}</p>
                    {!included && <PlanAlternative itemKey={item.key} currentTier={currentTier} onSeePlans={onSeePlans} />}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
