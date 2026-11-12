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
  packForShortfall,
  REWARD_REASON_LABELS,
} from './storeCatalog';
import { accentTile, EmptyNote, Icon, Pill, SectionTitle, Spinner, tone } from './storeUi';

/**
 * Lo que el usuario intentaba comprar cuando no le alcanzó. Solo el ítem: cuánto
 * falta se calcula con el saldo de cada render (bono, código o recarga lo cambian).
 */
export interface CoinTarget {
  item: ShopItem;
}

interface CoinsSectionProps {
  packs: CoinPack[];
  packsLoading: boolean;
  packsError: boolean;
  onRetryPacks: () => void;
  history: LedgerEntry[];
  historyLoading: boolean;
  historyError: boolean;
  onRetryHistory: () => void;
  /** null mientras carga. */
  balance: number | null;
  shopItems: ShopItem[];
  target: CoinTarget | null;
  onClearTarget: () => void;
  onResumeTarget: () => void;
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
const TargetBanner: React.FC<{
  item: ShopItem;
  shortfall: number;
  packKey: string | null;
  onClear: () => void;
  onResume: () => void;
}> = ({ item, shortfall, packKey, onClear, onResume }) => (
  <div
    role="status"
    className="flex items-start gap-3 rounded-[var(--radius-lg)] border p-4 bg-rose-50 border-[var(--coral-300)]/60 dark:bg-[var(--coral-500)]/10 dark:border-[var(--coral-500)]/30"
  >
    <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-white/70 dark:bg-[var(--coral-500)]/15">
      <Icon name={shortfall > 0 ? 'shopping_bag' : 'check_circle'} filled className={cn('text-[22px]', tone.accent)} />
    </span>
    <div className="flex-1 min-w-0 flex flex-col items-start gap-2.5">
      <div>
        <p className={cn('text-[14.5px] font-bold leading-snug', tone.strong)}>
          {shortfall > 0
            ? `Te faltan ${shortfall.toLocaleString('es-AR')} coins para ${item.name}`
            : `Ya te alcanza para ${item.name}`}
        </p>
        <p className={cn('text-[13px] mt-1 leading-snug', tone.muted)}>
          {shortfall <= 0
            ? 'Podés seguir con la compra cuando quieras.'
            : packKey
              ? 'Marcamos el paquete más chico que lo cubre. Después de recargar, seguís con la compra.'
              : 'Ningún paquete lo cubre solo: podés combinar recargas, el bono diario y tus citas.'}
        </p>
      </div>
      {shortfall <= 0 && (
        <Button onClick={onResume} className="h-11 rounded-[var(--radius-pill)] px-5 gap-1.5">
          Continuar con {item.name}
          <Icon name="arrow_forward" className="text-[18px]" />
        </Button>
      )}
    </div>
    <button
      type="button"
      onClick={onClear}
      aria-label="Descartar aviso"
      className={cn('shrink-0 -m-2 w-11 h-11 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5', tone.muted)}
    >
      <Icon name="close" className="text-[20px]" />
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
  historyError,
  onRetryHistory,
  balance,
  shopItems,
  target,
  onClearTarget,
  onResumeTarget,
  rechargingKey,
  onRecharge,
  promoCode,
  onPromoCodeChange,
  redeeming,
  onRedeem,
}) => {
  const bonus = packBonusPercent(packs);
  const sortedPacks = [...packs].sort((a, b) => a.coins - b.coins);
  const shortfall = target && balance !== null ? target.item.price - balance : null;
  const recommendedKey = shortfall !== null && shortfall > 0 ? (packForShortfall(packs, shortfall)?.key ?? null) : null;

  return (
    <div className="flex flex-col gap-8">
      {target && shortfall !== null && (
        <TargetBanner item={target.item} shortfall={shortfall} packKey={recommendedKey} onClear={onClearTarget} onResume={onResumeTarget} />
      )}

      <section className="flex flex-col gap-3" aria-labelledby="packs-title">
        <div id="packs-title">
          <SectionTitle kicker="Recargar" title="Paquetes de coins" />
        </div>
        {/* Las recargas no cobran dinero real todavía (ver docs/TIENDA-PLANES.md). Se dice
            arriba de los precios, no en letra chica. */}
        <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] px-3.5 py-3 bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
          <Icon name="info" className="text-[18px] mt-px shrink-0" />
          <p className="text-[13px] leading-snug">
            <strong>Modo demo:</strong> las recargas suman coins a tu cuenta sin cobrarte dinero real.
          </p>
        </div>

        {packsLoading ? (
          <div className="flex flex-col lg:grid lg:grid-cols-4 gap-3" aria-busy="true" aria-label="Cargando paquetes">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[88px] lg:h-[168px] rounded-[var(--radius-lg)]" />
            ))}
          </div>
        ) : packsError && packs.length === 0 ? (
          <div className={cn('rounded-[var(--radius-lg)] border p-4 flex items-center gap-3', tone.sunken, tone.divider)}>
            <p className={cn('flex-1 text-[13.5px]', tone.muted)}>No pudimos cargar los paquetes. Tu saldo no cambió.</p>
            <Button variant="secondary" onClick={onRetryPacks} className="h-11 rounded-[var(--radius-pill)] px-4">
              Reintentar
            </Button>
          </div>
        ) : packs.length === 0 ? (
          <EmptyNote icon="monetization_on">No hay paquetes disponibles en este momento.</EmptyNote>
        ) : (
          /* Mobile: filas (monto a la izquierda, precio a la derecha). Desktop: tarjetas en fila. */
          <ul className="flex flex-col lg:grid lg:grid-cols-4 gap-3">
            {sortedPacks.map((pack) => {
              const recommended = recommendedKey === pack.key;
              const equivalent = equivalentLabel(packEquivalent(pack.coins, shopItems));
              const pending = rechargingKey === pack.key;
              return (
                <li
                  key={pack.key}
                  className={cn(
                    'relative p-4 flex items-center gap-4 lg:flex-col lg:items-stretch',
                    tone.card,
                    recommended && 'border-[var(--coral-500)]/70 shadow-elevation-md',
                  )}
                >
                  {recommended && (
                    <span className="absolute -top-2.5 left-4 rounded-[var(--radius-pill)] px-2.5 h-5 inline-flex items-center text-[10.5px] font-bold uppercase tracking-[0.08em] text-white bg-gradient-to-r from-[var(--coral-600)] to-[var(--coral-500)]">
                      Cubre lo que falta
                    </span>
                  )}
                  <span className={cn('w-12 h-12 rounded-full flex items-center justify-center shrink-0 lg:hidden', accentTile('coral'))}>
                    <Icon name="monetization_on" filled className="text-[26px]" />
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5 lg:gap-2">
                    <span className={cn('text-[22px] lg:text-[26px] font-bold tracking-tight leading-none tabular-nums', tone.strong)}>
                      {pack.coins.toLocaleString('es-AR')}
                      <span className={cn('text-[13px] font-semibold ml-1', tone.muted)}>coins</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={cn('text-[12.5px] font-bold', tone.accent)}>{pack.label}</span>
                      {bonus[pack.key] && (
                        <Pill tone="gold" icon="trending_up" className="h-6 text-[11px] px-2">
                          +{bonus[pack.key]}% por dólar
                        </Pill>
                      )}
                    </div>
                    {equivalent && <span className={cn('text-[12.5px] leading-snug', tone.muted)}>{equivalent}</span>}
                  </div>
                  <Button
                    variant={recommended ? 'primary' : 'secondary'}
                    onClick={() => onRecharge(pack)}
                    disabled={rechargingKey !== null}
                    aria-label={`Recargar ${pack.coins} coins por US$ ${pack.priceUsd.toFixed(2)} (demo)`}
                    className="shrink-0 h-11 min-w-[104px] lg:w-full rounded-[var(--radius-pill)] px-4 text-[14px] gap-1.5 tabular-nums"
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
          <p className={cn('px-1 text-[12.5px] leading-relaxed', tone.faint)}>
            El % compara cuántas coins recibís por dólar frente al paquete más chico.
          </p>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-6 lg:items-start">
        <section className="flex flex-col gap-3" aria-labelledby="earn-title">
          <div id="earn-title">
            <SectionTitle kicker="Gratis" title="Cómo ganar coins" />
          </div>
          <ul className={cn('divide-y', tone.card, 'divide-[var(--color-line)] dark:divide-[var(--hairline)]')}>
            {EARN_WAYS.map((reason) => {
              const { icon, label } = REWARD_REASON_LABELS[reason];
              return (
                <li key={reason} className="flex items-center gap-3.5 px-4 min-h-14">
                  <span className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', accentTile('coral'))}>
                    <Icon name={icon} filled className="text-[18px]" />
                  </span>
                  <span className={cn('text-[14.5px] font-medium', tone.strong)}>{label}</span>
                </li>
              );
            })}
          </ul>
          <p className={cn('px-1 text-[12.5px] leading-relaxed', tone.faint)}>
            Las citas verificadas son lo que más suma. Con Black, valen el doble.
          </p>
        </section>

        <div className="flex flex-col gap-8 lg:gap-6">
          <section className={cn('p-4 flex flex-col gap-3', tone.card)} aria-labelledby="promo-title">
            <label id="promo-title" htmlFor="promo-code" className="flex items-center gap-2.5">
              <span className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', accentTile('gold'))}>
                <Icon name="confirmation_number" filled className="text-[18px]" />
              </span>
              <span className={cn('text-[15px] font-bold', tone.strong)}>¿Tenés un código promocional?</span>
            </label>
            <form onSubmit={onRedeem} className="flex gap-2">
              <Input
                id="promo-code"
                type="text"
                autoComplete="off"
                value={promoCode}
                onChange={(e) => onPromoCodeChange(e.target.value.toUpperCase())}
                placeholder="Ej: FINDY2026"
                className="flex-1 h-11 font-mono tracking-wide"
              />
              <Button type="submit" disabled={redeeming || !promoCode.trim()} className="h-11 rounded-[var(--radius-pill)] px-5 gap-1.5">
                {redeeming && <Spinner className="text-[16px]" />}
                Canjear
              </Button>
            </form>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="history-title">
            <div id="history-title">
              <SectionTitle kicker="Tu saldo" title="Movimientos recientes" />
            </div>
            {historyLoading ? (
              <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando movimientos">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 rounded-[var(--radius-md)]" />
                ))}
              </div>
            ) : historyError && history.length === 0 ? (
              <div className={cn('rounded-[var(--radius-lg)] border p-4 flex items-center gap-3', tone.sunken, tone.divider)}>
                <p className={cn('flex-1 text-[13.5px]', tone.muted)}>No pudimos cargar tus movimientos.</p>
                <Button variant="secondary" onClick={onRetryHistory} className="h-11 rounded-[var(--radius-pill)] px-4">
                  Reintentar
                </Button>
              </div>
            ) : history.length === 0 ? (
              <EmptyNote icon="receipt_long">Todavía no hay movimientos. Tu primer bono diario va a aparecer acá.</EmptyNote>
            ) : (
              <ul className={cn('divide-y', tone.card, 'divide-[var(--color-line)] dark:divide-[var(--hairline)]')}>
                {history.slice(0, 8).map((entry) => {
                  const described = describeLedgerReason(entry.reason, shopItems);
                  const credit = entry.direction === 'CREDIT';
                  return (
                    <li key={entry.id} className="px-4 min-h-14 flex items-center gap-3.5">
                      <span
                        className={cn(
                          'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                          credit ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300' : accentTile('coral'),
                        )}
                      >
                        <Icon name={described.icon} filled className="text-[18px]" />
                      </span>
                      <span className={cn('flex-1 min-w-0 truncate text-[14.5px] font-medium', tone.strong)}>{described.label}</span>
                      <span
                        className={cn(
                          'text-[15px] font-bold shrink-0 tabular-nums',
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
