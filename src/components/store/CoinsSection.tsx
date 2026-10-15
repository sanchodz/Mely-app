import React from 'react';
import type { CoinPack, LedgerEntry, ShopItem } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';
import {
  describeLedgerReason,
  EARN_WAYS,
  packBonusPercent,
  packEquivalent,
  type PackEquivalent,
  REWARD_REASON_LABELS,
} from './storeCatalog';
import { Coins, Icon, Pill, SectionTitle, Spinner, tone } from './storeUi';

/** Lo que el usuario intentaba comprar cuando no le alcanzó. */
export interface CoinTarget {
  item: ShopItem;
  shortfall: number;
  /** Paquete más chico que cubre lo que falta (null si ninguno alcanza solo). */
  packKey: string | null;
}

interface CoinsSectionProps {
  packs: CoinPack[];
  packsLoading: boolean;
  packsError: boolean;
  onRetryPacks: () => void;
  history: LedgerEntry[];
  historyLoading: boolean;
  shopItems: ShopItem[];
  target: CoinTarget | null;
  onClearTarget: () => void;
  rechargingKey: string | null;
  onRecharge: (pack: CoinPack) => void;
  promoCode: string;
  onPromoCodeChange: (code: string) => void;
  redeeming: boolean;
  onRedeem: (e: React.FormEvent) => void;
}

function equivalentLabel(eq: PackEquivalent | null): string | null {
  if (!eq) return null;
  if (eq.kind === 'plan') return `Alcanza para ${eq.plan.shortName} · ${eq.plan.durationDays} días`;
  return `Alcanza para ${eq.count} × ${eq.item.name}`;
}

/** Banner cuando venís de "Te faltan coins": qué querías, cuánto falta y qué paquete lo cubre. */
const TargetBanner: React.FC<{ target: CoinTarget; onClear: () => void }> = ({ target, onClear }) => (
  <div
    role="status"
    className="flex items-start gap-3 rounded-[var(--radius-md)] border p-4 bg-rose-50 border-[var(--coral-300)]/60 dark:bg-[var(--coral-500)]/10 dark:border-[var(--coral-500)]/30"
  >
    <Icon name="shopping_bag" filled className={cn('text-[22px] shrink-0 mt-px', tone.accent)} />
    <div className="flex-1 min-w-0">
      <p className={cn('text-[13.5px] font-bold', tone.strong)}>
        Te faltan {target.shortfall.toLocaleString('es-AR')} coins para {target.item.name}
      </p>
      <p className={cn('text-[12.5px] mt-0.5', tone.muted)}>
        {target.packKey
          ? 'Marcamos el paquete más chico que lo cubre. Después de recargar, seguís con la compra.'
          : 'Ningún paquete lo cubre solo: podés combinar recargas, el bono diario y tus citas.'}
      </p>
    </div>
    <button
      type="button"
      onClick={onClear}
      aria-label="Descartar aviso"
      className={cn('shrink-0 -m-1 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5', tone.muted)}
    >
      <Icon name="close" className="text-[18px]" />
    </button>
  </div>
);

export const CoinsSection: React.FC<CoinsSectionProps> = ({
  packs,
  packsLoading,
  packsError,
  onRetryPacks,
  history,
  historyLoading,
  shopItems,
  target,
  onClearTarget,
  rechargingKey,
  onRecharge,
  promoCode,
  onPromoCodeChange,
  redeeming,
  onRedeem,
}) => {
  const bonus = packBonusPercent(packs);
  const sortedPacks = [...packs].sort((a, b) => a.coins - b.coins);

  return (
    <div className="flex flex-col gap-8">
      {target && <TargetBanner target={target} onClear={onClearTarget} />}

      <section className="flex flex-col gap-3" aria-labelledby="packs-title">
        <div id="packs-title">
          <SectionTitle kicker="Recargar" title="Paquetes de coins" />
        </div>
        {/* Las recargas no cobran dinero real todavía (ver docs/TIENDA-PLANES.md). Se dice
            arriba de los precios, no en letra chica. */}
        <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] p-3 bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
          <Icon name="info" className="text-[18px] mt-px shrink-0" />
          <p className="text-[12.5px] leading-snug">
            <strong>Modo demo:</strong> las recargas suman coins a tu cuenta sin cobrarte dinero real.
          </p>
        </div>

        {packsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-busy="true" aria-label="Cargando paquetes">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[168px] rounded-[var(--radius-lg)]" />
            ))}
          </div>
        ) : packsError && packs.length === 0 ? (
          <div className={cn('rounded-[var(--radius-md)] p-4 flex items-center gap-3', tone.sunken)}>
            <p className={cn('flex-1 text-[13px]', tone.muted)}>No pudimos cargar los paquetes. Tu saldo no cambió.</p>
            <Button variant="secondary" size="sm" onClick={onRetryPacks} className="rounded-[var(--radius-pill)] px-4">
              Reintentar
            </Button>
          </div>
        ) : packs.length === 0 ? (
          <p className={cn('rounded-[var(--radius-md)] p-4 text-[13px] text-center', tone.sunken, tone.muted)}>
            No hay paquetes disponibles en este momento.
          </p>
        ) : (
          <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {sortedPacks.map((pack) => {
              const recommended = target?.packKey === pack.key;
              const equivalent = equivalentLabel(packEquivalent(pack.coins, shopItems));
              const pending = rechargingKey === pack.key;
              return (
                <li
                  key={pack.key}
                  className={cn(
                    'relative rounded-[var(--radius-lg)] border p-4 flex flex-col gap-3 shadow-elevation-sm',
                    tone.surface,
                    recommended && 'border-2 border-[var(--coral-500)]/70 shadow-elevation-md',
                  )}
                >
                  {recommended && (
                    <span className="absolute -top-2.5 left-4 rounded-[var(--radius-pill)] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white bg-gradient-to-r from-[var(--coral-600)] to-[var(--coral-500)]">
                      Cubre lo que falta
                    </span>
                  )}
                  <div className="flex flex-col gap-1">
                    <Coins amount={pack.coins} className={cn('text-[24px] font-bold tracking-tight', tone.strong)} />
                    <span className={cn('text-[12px]', tone.muted)}>{pack.label}</span>
                  </div>
                  <div className="flex flex-col items-start gap-1.5 flex-1">
                    {bonus[pack.key] && (
                      <Pill tone="gold" icon="trending_up" className="text-[11px] py-0.5 px-2">
                        +{bonus[pack.key]}% coins por dólar
                      </Pill>
                    )}
                    {equivalent && <span className={cn('text-[12px] leading-snug', tone.muted)}>{equivalent}</span>}
                  </div>
                  <Button
                    variant={recommended ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => onRecharge(pack)}
                    disabled={rechargingKey !== null}
                    aria-label={`Recargar ${pack.coins} coins por US$ ${pack.priceUsd.toFixed(2)} (demo)`}
                    className="w-full h-10 rounded-[var(--radius-pill)] text-[13px] gap-1.5"
                  >
                    {pending ? <Spinner className="text-[16px]" /> : null}
                    {pending ? 'Recargando…' : `US$ ${pack.priceUsd.toFixed(2)}`}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {Object.keys(bonus).length > 0 && (
          <p className={cn('px-1 text-[12px]', tone.muted)}>
            El % compara cuántas coins recibís por dólar frente al paquete más chico.
          </p>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-6 lg:items-start">
        <section className="flex flex-col gap-3" aria-labelledby="earn-title">
          <div id="earn-title">
            <SectionTitle kicker="Gratis" title="Cómo ganar coins" />
          </div>
          <ul className={cn('rounded-[var(--radius-lg)] border divide-y', tone.surface, 'divide-[var(--coral-100)] dark:divide-[var(--hairline)]')}>
            {EARN_WAYS.map((reason) => {
              const { icon, label } = REWARD_REASON_LABELS[reason];
              return (
                <li key={reason} className="flex items-center gap-3 p-3.5">
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

        <div className="flex flex-col gap-8 lg:gap-6">
          <section className={cn('rounded-[var(--radius-lg)] border p-4 flex flex-col gap-3', tone.surface)} aria-labelledby="promo-title">
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
              <Button type="submit" disabled={redeeming || !promoCode.trim()} className="rounded-[var(--radius-pill)] px-5 gap-1.5">
                {redeeming && <Spinner className="text-[16px]" />}
                Canjear
              </Button>
            </form>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="history-title">
            <div id="history-title">
              <SectionTitle title="Movimientos recientes" />
            </div>
            {historyLoading ? (
              <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando movimientos">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-11 rounded-[var(--radius-md)]" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className={cn('rounded-[var(--radius-md)] p-4 text-[13px] text-center', tone.sunken, tone.muted)}>
                Todavía no hay movimientos. Tu primer bono diario va a aparecer acá.
              </p>
            ) : (
              <ul className={cn('rounded-[var(--radius-lg)] border divide-y', tone.surface, 'divide-[var(--coral-100)] dark:divide-[var(--hairline)]')}>
                {history.slice(0, 8).map((entry) => {
                  const described = describeLedgerReason(entry.reason, shopItems);
                  const credit = entry.direction === 'CREDIT';
                  return (
                    <li key={entry.id} className="p-3 flex items-center gap-3">
                      <Icon
                        name={described.icon}
                        className={cn('text-[18px] shrink-0', credit ? 'text-emerald-600 dark:text-emerald-400' : tone.accent)}
                      />
                      <span className={cn('flex-1 min-w-0 truncate text-[13px]', tone.strong)}>{described.label}</span>
                      <span
                        className={cn(
                          'font-mono text-[13px] font-bold shrink-0 tabular-nums',
                          credit ? 'text-emerald-600 dark:text-emerald-400' : tone.accent,
                        )}
                      >
                        <span className="sr-only">{credit ? 'Ingreso de' : 'Gasto de'} </span>
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
      </div>
    </div>
  );
};
