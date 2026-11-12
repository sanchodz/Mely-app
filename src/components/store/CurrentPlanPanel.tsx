import React from 'react';
import type { MeProfile, PerkStatus, ShopItem } from '../../types';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';
import { formatShortDate, perkDetail, planForTier, TIER_SHORT_NAME } from './storeCatalog';
import { accentTile, Coins, Icon, Spinner, tone } from './storeUi';

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
  const hasIncluded = included.length > 0 || multiplier > 1;

  return (
    <section aria-label="Tu plan actual" className={cn('relative overflow-hidden', tone.card)}>
      {/* Halo con el acento del plan — firma discreta, no un banner. */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -top-24 -right-16 w-64 h-64 rounded-full blur-3xl opacity-50',
          isGold ? 'bg-amber-300/40' : 'bg-[var(--coral-500)]/30',
        )}
      />

      <div className="relative p-5 lg:p-6 flex flex-col gap-5">
        {/* Plan + saldo */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <span
              className={cn(
                'w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center shrink-0',
                accentTile(plan?.accent ?? 'coral'),
              )}
            >
              <Icon name={plan?.icon ?? 'person'} filled className="text-[26px]" />
            </span>
            <div className="min-w-0">
              <span className="section-kicker block mb-1">Tu plan</span>
              <p
                className={cn('text-[28px] lg:text-[32px] leading-none italic font-semibold truncate', tone.strong)}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {TIER_SHORT_NAME[tier]}
              </p>
            </div>
          </div>
          <div
            className={cn(
              'shrink-0 flex flex-col items-end rounded-[var(--radius-md)] px-3.5 py-2.5 border',
              tone.sunken,
              tone.divider,
            )}
          >
            <span className={tone.label}>Saldo</span>
            {balanceLoading ? (
              <Skeleton className="h-6 w-16 mt-1 rounded-[var(--radius-sm)]" aria-label="Cargando saldo" />
            ) : (
              <Coins amount={balance} className={cn('text-[22px] font-bold leading-none mt-1', tone.strong)} />
            )}
          </div>
        </div>

        <p className={cn('text-[14px] leading-snug -mt-1', tone.muted)}>{statusLine}</p>

        {hasIncluded && (
          <div className="flex flex-col gap-2">
            <span className={tone.label}>Incluido ahora</span>
            <ul className="flex flex-wrap gap-2">
              {included.map((p) => (
                <li
                  key={p.name}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] pl-2 pr-3 h-8 text-[12.5px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                >
                  <Icon name="check_circle" filled className="text-[16px]" />
                  {p.name}
                  <span className="font-normal opacity-80">· {p.detail}</span>
                </li>
              ))}
              {multiplier > 1 && (
                <li className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] pl-2 pr-3 h-8 text-[12.5px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                  <Icon name="verified" filled className="text-[16px]" />
                  Coins x{multiplier} por cita verificada
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Bono diario */}
        <div className={cn('flex items-center gap-3 rounded-[var(--radius-md)] border p-3', tone.sunken, tone.divider)}>
          <span
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
              dailyBonusAvailable ? 'bg-amber-100 dark:bg-amber-400/15' : 'bg-[var(--color-line)] dark:bg-[var(--midnight-800)]',
            )}
          >
            <Icon
              name={dailyBonusAvailable ? 'redeem' : 'check_circle'}
              filled
              className={cn('text-[22px]', dailyBonusAvailable ? tone.gold : tone.muted)}
            />
          </span>
          <div className="flex-1 min-w-0">
            <p className={cn('text-[14px] font-bold leading-tight', tone.strong)}>
              {dailyBonusAvailable ? 'Tu bono diario está listo' : 'Bono de hoy reclamado'}
            </p>
            <p className={cn('text-[12.5px] mt-0.5 leading-snug', tone.muted)}>
              {dailyBonusAvailable ? 'Coins gratis por entrar, todos los días.' : 'Mañana hay otro.'}
            </p>
          </div>
          {dailyBonusAvailable && (
            <Button onClick={onClaimBonus} disabled={claimingBonus} className="shrink-0 h-11 rounded-[var(--radius-pill)] px-4 gap-1.5 text-[14px]">
              {claimingBonus && <Spinner className="text-[16px]" />}
              Reclamar
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};
