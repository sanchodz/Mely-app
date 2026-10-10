import React from 'react';
import type { MeProfile, PerkStatus, ShopItem } from '../../types';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { formatShortDate, perkDetail, planForTier, TIER_SHORT_NAME } from './storeCatalog';
import { Coins, Icon, tone } from './storeUi';

interface CurrentPlanPanelProps {
  user: MeProfile | null;
  balance: number;
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
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="section-kicker block mb-2">Tu plan</span>
            <p className={cn('text-[28px] leading-none italic font-semibold', tone.strong)} style={{ fontFamily: 'var(--font-display)' }}>
              {TIER_SHORT_NAME[tier]}
            </p>
            <p className={cn('text-[13px] mt-2 leading-snug', tone.muted)}>{statusLine}</p>
          </div>
          <div className="text-right shrink-0">
            <span className={cn('block text-[11px] font-semibold uppercase tracking-[0.12em]', tone.muted)}>Saldo</span>
            <Coins amount={balance} className={cn('text-[24px] font-bold mt-1', tone.strong)} />
          </div>
        </div>

        {(included.length > 0 || multiplier > 1) && (
          <div className="flex flex-col gap-2">
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

        <div className={cn('flex items-center gap-3 rounded-[var(--radius-md)] p-3', tone.sunken)}>
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
            <Button size="sm" onClick={onClaimBonus} disabled={claimingBonus} className="shrink-0 rounded-[var(--radius-pill)] px-4">
              Reclamar
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};
