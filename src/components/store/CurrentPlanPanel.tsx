import React from 'react';
import type { MeProfile, PerkStatus, ShopItem } from '../../types';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';
import { formatShortDate, perkDetail, planForTier, TIER_SHORT_NAME } from './storeCatalog';
import { Coins, Icon, Spinner, tone } from './storeUi';

interface CurrentPlanPanelProps {
  user: MeProfile | null;
  balance: number;
  /** Sin wallet todavía: no mostrar "0" como si fuera el saldo real. */
  balanceLoading: boolean;
  perks: PerkStatus | undefined;
  shopItems: ShopItem[];
  dailyBonusAvailable: boolean;
  claimingBonus: boolean;
  onClaimBonus: () => void;
}

/**
 * "Qué tengo hoy": plan, vencimiento, saldo, lo incluido con su cupo restante y
 * el bono diario. Responde la primera pregunta de cualquier tienda antes de
 * mostrar nada para comprar.
 */
export const CurrentPlanPanel: React.FC<CurrentPlanPanelProps> = ({
  user,
  balance,
  balanceLoading,
  perks,
  shopItems,
  dailyBonusAvailable,
  claimingBonus,
  onClaimBonus,
}) => {
  const tier = user?.membership.tier ?? 'STANDARD';
  const plan = planForTier(tier);
  const expires = formatShortDate(user?.membership.expiresAt ?? null);
  const isGold = plan?.accent === 'gold';

  const statusLine =
    tier === 'STANDARD'
      ? 'Cupo diario, bono de coins y poderes a la carta.'
      : expires
        ? `Activo hasta el ${expires}. Si renovás, se suman días.`
        : 'Activo, sin vencimiento.';

  // Solo lo que hoy se puede usar sin pagar: ilimitado o con cupo restante.
  const included = (perks?.items ?? []).flatMap((p) => {
    const name = shopItems.find((i) => i.key === p.itemKey)?.name;
    const detail = perkDetail(p);
    return name && detail ? [{ name, detail }] : [];
  });
  const multiplier = perks?.dateRewardMultiplier ?? 1;

  return (
    <section
      aria-label="Tu plan actual"
      className={cn('relative overflow-hidden rounded-[var(--radius-lg)] border shadow-elevation-sm', tone.surface)}
    >
      {/* Filo superior con el acento del plan — firma discreta, no un banner. */}
      <div
        aria-hidden="true"
        className={cn(
          'h-1 w-full',
          isGold ? 'bg-gradient-to-r from-amber-300 to-amber-500' : 'bg-gradient-to-r from-[var(--coral-600)] to-[var(--coral-500)]',
        )}
      />
      {/* Mobile: plan | saldo arriba, después incluido y bono. Desktop: dos columnas, saldo y bono a la derecha. */}
      <div className="p-5 lg:p-6 grid gap-4 lg:gap-x-8 grid-cols-[minmax(0,1fr)_auto] [grid-template-areas:'plan_saldo'_'incl_incl'_'bonus_bonus'] lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:[grid-template-areas:'plan_saldo'_'incl_bonus']">
        <div className="min-w-0 [grid-area:plan]">
          <span className="section-kicker block mb-2">Tu plan</span>
          <p className={cn('text-[28px] lg:text-[32px] leading-none italic font-semibold', tone.strong)} style={{ fontFamily: 'var(--font-display)' }}>
            {TIER_SHORT_NAME[tier]}
          </p>
          <p className={cn('text-[13px] mt-2 leading-snug', tone.muted)}>{statusLine}</p>
        </div>
        <div className="text-right lg:text-left [grid-area:saldo]">
          <span className={cn('block text-[11px] font-semibold uppercase tracking-[0.12em]', tone.muted)}>Saldo</span>
          {balanceLoading ? (
            <Skeleton className="h-7 w-24 mt-1.5 ml-auto lg:ml-0 rounded-[var(--radius-sm)]" aria-label="Cargando saldo" />
          ) : (
            <Coins amount={balance} className={cn('text-[24px] lg:text-[28px] font-bold mt-1', tone.strong)} />
          )}
        </div>

        {(included.length > 0 || multiplier > 1) && (
          <div className="flex flex-col gap-2 [grid-area:incl]">
            <span className={cn('text-[11px] font-semibold uppercase tracking-[0.12em]', tone.muted)}>Incluido ahora</span>
            <ul className="flex flex-wrap gap-1.5">
              {included.map((p) => (
                <li
                  key={p.name}
                  className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-[12px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                >
                  <Icon name="check" className="text-[14px]" />
                  {p.name}
                  <span className="font-normal opacity-80">· {p.detail}</span>
                </li>
              ))}
              {multiplier > 1 && (
                <li className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-[12px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                  <Icon name="verified" className="text-[14px]" />
                  Coins x{multiplier} por cita verificada
                </li>
              )}
            </ul>
          </div>
        )}

        <div className={cn('flex items-center gap-3 rounded-[var(--radius-md)] p-3 [grid-area:bonus] self-end', tone.sunken)}>
          <Icon
            name={dailyBonusAvailable ? 'redeem' : 'check_circle'}
            filled
            className={cn('text-[22px] shrink-0', dailyBonusAvailable ? tone.gold : tone.muted)}
          />
          <div className="flex-1 min-w-0">
            <p className={cn('text-[13px] font-bold', tone.strong)}>
              {dailyBonusAvailable ? 'Tu bono diario está listo' : 'Bono de hoy reclamado'}
            </p>
            <p className={cn('text-[12px]', tone.muted)}>
              {dailyBonusAvailable ? 'Coins gratis por entrar, todos los días.' : 'Mañana hay otro.'}
            </p>
          </div>
          {dailyBonusAvailable && (
            <Button size="sm" onClick={onClaimBonus} disabled={claimingBonus} className="shrink-0 rounded-[var(--radius-pill)] px-4 gap-1.5">
              {claimingBonus && <Spinner className="text-[15px]" />}
              Reclamar
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};
