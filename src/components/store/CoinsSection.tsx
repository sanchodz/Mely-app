import React from 'react';
import type { CoinPack, LedgerEntry, ShopItem } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { describeLedgerReason, EARN_WAYS, REWARD_REASON_LABELS } from './storeCatalog';
import { Coins, Icon, SectionTitle, tone } from './storeUi';

interface CoinsSectionProps {
  packs: CoinPack[];
  history: LedgerEntry[];
  shopItems: ShopItem[];
  recharging: boolean;
  onRecharge: (packKey: string) => void;
  promoCode: string;
  onPromoCodeChange: (code: string) => void;
  redeeming: boolean;
  onRedeem: (e: React.FormEvent) => void;
}

export const CoinsSection: React.FC<CoinsSectionProps> = ({
  packs,
  history,
  shopItems,
  recharging,
  onRecharge,
  promoCode,
  onPromoCodeChange,
  redeeming,
  onRedeem,
}) => (
  <div className="flex flex-col gap-7">
    {packs.length > 0 && (
      <section className="flex flex-col gap-3" aria-label="Paquetes de coins">
        <SectionTitle kicker="Recargar" title="Paquetes de coins" />
        {/* Las recargas no cobran dinero real todavía (ver docs/TIENDA-PLANES.md). Se dice
            arriba de los precios, no en letra chica. */}
        <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] p-3 bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
          <Icon name="info" className="text-[18px] mt-px shrink-0" />
          <p className="text-[12.5px] leading-snug">
            <strong>Modo demo:</strong> las recargas suman coins a tu cuenta sin cobrarte dinero real.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {packs.map((pack) => (
            <div key={pack.key} className={cn('rounded-[var(--radius-md)] border p-4 flex flex-col items-start gap-3', tone.surface)}>
              <div className="flex flex-col gap-0.5">
                <Coins amount={pack.coins} className={cn('text-[22px] font-bold', tone.strong)} />
                <span className={cn('text-[12px]', tone.muted)}>{pack.label}</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRecharge(pack.key)}
                disabled={recharging}
                className="w-full h-10 rounded-[var(--radius-pill)] text-[13px]"
              >
                US$ {pack.priceUsd.toFixed(2)}
              </Button>
            </div>
          ))}
        </div>
      </section>
    )}

    <section className="flex flex-col gap-3" aria-label="Cómo ganar coins">
      <SectionTitle kicker="Gratis" title="Cómo ganar coins" />
      <ul className={cn('rounded-[var(--radius-md)] border divide-y', tone.surface, 'divide-[var(--coral-100)] dark:divide-[var(--hairline)]')}>
        {EARN_WAYS.map((reason) => {
          const { icon, label } = REWARD_REASON_LABELS[reason];
          return (
            <li key={reason} className="flex items-center gap-3 p-3">
              <Icon name={icon} className={cn('text-[19px]', tone.accent)} />
              <span className={cn('text-[13.5px]', tone.strong)}>{label}</span>
            </li>
          );
        })}
      </ul>
      <p className={cn('px-1 text-[12px] leading-relaxed', tone.muted)}>
        Las citas verificadas son lo que más suma. Con Black, valen el doble.
      </p>
    </section>

    <section className={cn('rounded-[var(--radius-md)] border p-4 flex flex-col gap-3', tone.surface)} aria-labelledby="promo-title">
      <label id="promo-title" htmlFor="promo-code" className={cn('text-[13.5px] font-bold', tone.strong)}>
        ¿Tenés un código promocional?
      </label>
      <form onSubmit={onRedeem} className="flex gap-2">
        <Input
          id="promo-code"
          type="text"
          autoComplete="off"
          value={promoCode}
          onChange={(e) => onPromoCodeChange(e.target.value.toUpperCase())}
          placeholder="Ej: FINDY2026"
          className="flex-1 font-mono tracking-wide"
        />
        <Button type="submit" disabled={redeeming || !promoCode.trim()} className="rounded-[var(--radius-pill)] px-5">
          Canjear
        </Button>
      </form>
    </section>

    <section className="flex flex-col gap-3" aria-label="Movimientos recientes">
      <SectionTitle title="Movimientos recientes" />
      {history.length === 0 ? (
        <p className={cn('rounded-[var(--radius-md)] p-4 text-[13px] text-center', tone.sunken, tone.muted)}>
          Todavía no hay movimientos. Tu primer bono diario va a aparecer acá.
        </p>
      ) : (
        <ul className={cn('rounded-[var(--radius-md)] border divide-y', tone.surface, 'divide-[var(--coral-100)] dark:divide-[var(--hairline)]')}>
          {history.slice(0, 8).map((entry) => {
            const described = describeLedgerReason(entry.reason, shopItems);
            const credit = entry.direction === 'CREDIT';
            return (
              <li key={entry.id} className="p-3 flex items-center gap-3">
                <Icon name={described.icon} className={cn('text-[18px] shrink-0', credit ? 'text-emerald-600 dark:text-emerald-400' : tone.accent)} />
                <span className={cn('flex-1 min-w-0 truncate text-[13px]', tone.strong)}>{described.label}</span>
                <span
                  className={cn(
                    'font-mono text-[13px] font-bold shrink-0 tabular-nums',
                    credit ? 'text-emerald-600 dark:text-emerald-400' : tone.accent,
                  )}
                >
                  {credit ? '+' : '−'}
                  {entry.amount.toLocaleString('es-AR')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  </div>
);
