import React, { useEffect, useRef } from 'react';
import type { MembershipTier, ShopItem } from '../../types';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import {
  blackSavings,
  coinsPerDay,
  COMPARISON_ROWS,
  type ComparisonCell,
  nextStepPlan,
  type PlanDefinition,
  PLANS,
  previousPlan,
  TIER_RANK,
  TIER_SHORT_NAME,
} from './storeCatalog';
import { trackStore } from './storeAnalytics';
import { accentTile, Coins, Icon, Pill, SectionTitle, tone } from './storeUi';

interface PlansSectionProps {
  items: ShopItem[];
  currentTier: MembershipTier;
  /** El plan actual no vence (Black "para siempre" de antes): no hay nada que renovar. */
  currentIsLifetime: boolean;
  /** null mientras el saldo carga: no afirmar "te faltan" con un 0 que no es real. */
  balance: number | null;
  onSelect: (item: ShopItem, source: 'featured' | 'card') => void;
}

type PlanState = 'current' | 'lifetime' | 'lower' | 'available';
type Savings = { coins: number; percent: number } | null;

function planState(plan: PlanDefinition, currentTier: MembershipTier, currentIsLifetime: boolean): PlanState {
  if (plan.tier === currentTier) return currentIsLifetime ? 'lifetime' : 'current';
  // Comprar un plan menor con uno mayor activo lo pisaba (el backend lo rechaza).
  if (TIER_RANK[plan.tier] < TIER_RANK[currentTier]) return 'lower';
  return 'available';
}

function ctaLabel(plan: PlanDefinition, state: PlanState): string {
  switch (state) {
    case 'lower':
      return 'Ya tenés un plan superior';
    case 'lifetime':
      return 'Tu plan · sin vencimiento';
    case 'current':
      return `Renovar +${plan.durationDays} días`;
    default:
      return `Elegir ${plan.shortName}`;
  }
}

/** Precio + duración + costo por día (+ USD aprox. si el backend lo informa). */
const PriceBlock: React.FC<{ plan: PlanDefinition; item: ShopItem; large?: boolean }> = ({ plan, item, large }) => {
  const perDay = coinsPerDay(item.price, plan.durationDays);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2 flex-wrap">
        <Coins amount={item.price} className={cn('font-bold tracking-tight leading-none', large ? 'text-[34px]' : 'text-[26px]', tone.strong)} />
        <span className={cn('text-[14px]', tone.muted)}>por {plan.durationDays} días</span>
      </div>
      <span className={cn('text-[12.5px]', tone.faint)}>
        {perDay !== null && <>≈ {perDay.toLocaleString('es-AR')} coins por día</>}
        {item.priceUsd != null && <> · ≈ US$ {item.priceUsd.toFixed(2)}</>}
      </span>
    </div>
  );
};

/** Saldo frente a precio, dicho antes de abrir la confirmación. */
const Affordability: React.FC<{ price: number; balance: number }> = ({ price, balance }) => {
  const missing = price - balance;
  return missing <= 0 ? (
    <Pill tone="ok" icon="check">
      Te alcanza con tu saldo
    </Pill>
  ) : (
    <Pill tone="neutral" icon="account_balance_wallet">
      Te faltan {missing.toLocaleString('es-AR')} coins
    </Pill>
  );
};

/** Beneficio = qué es + para qué te sirve. El "para qué" es lo que se vende. */
const BenefitList: React.FC<{ plan: PlanDefinition; inheritsFrom?: string; heading?: string }> = ({ plan, inheritsFrom, heading }) => (
  <div className="flex flex-col gap-3">
    {(heading || inheritsFrom) && <p className={tone.label}>{heading ?? `Todo lo de ${inheritsFrom}, y además`}</p>}
    <ul className="flex flex-col gap-3.5">
      {plan.benefits.map((b) => (
        <li key={b.title} className="flex items-start gap-3">
          <span className={cn('w-9 h-9 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0', accentTile(plan.accent))}>
            <Icon name={b.icon} filled className="text-[18px]" />
          </span>
          <span className="min-w-0 pt-0.5">
            <span className={cn('block text-[14px] font-bold leading-snug', tone.strong)}>{b.title}</span>
            <span className={cn('block text-[13px] leading-snug mt-0.5', tone.muted)}>{b.outcome}</span>
          </span>
        </li>
      ))}
    </ul>
  </div>
);

const SavingsTag: React.FC<{ savings: NonNullable<Savings> }> = ({ savings }) => (
  <Pill tone="ok" icon="savings" className="h-auto py-1.5 leading-snug whitespace-normal">
    Ahorrás {savings.coins.toLocaleString('es-AR')} coins ({savings.percent}%) vs. 3 meses de Gold
  </Pill>
);

/**
 * Una sola tarjeta para todos los planes. La destacada es el siguiente escalón
 * sobre tu plan (nunca un "más popular" sin datos): en mobile sube primera y
 * se agranda; en desktop queda en su lugar de la escalera, resaltada.
 */
const PlanCard: React.FC<{
  plan: PlanDefinition;
  item: ShopItem;
  state: PlanState;
  featured: boolean;
  currentTier: MembershipTier;
  savings: Savings;
  balance: number | null;
  onSelect: (item: ShopItem, source: 'featured' | 'card') => void;
}> = ({ plan, item, state, featured, currentTier, savings, balance, onSelect }) => {
  const isCurrent = state === 'current' || state === 'lifetime';
  const isGold = plan.accent === 'gold';
  const prev = previousPlan(plan);
  const headingId = `plan-${plan.tier}-title`;
  // En la destacada se cuenta lo que suma a TU plan; en el resto, la herencia de la escalera.
  const benefitHeading = featured
    ? currentTier === 'STANDARD'
      ? 'Lo que suma a tu cuenta'
      : `Lo que suma a tu ${TIER_SHORT_NAME[currentTier]}`
    : undefined;

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        'relative overflow-hidden flex flex-col gap-5 p-5 transition-shadow',
        tone.card,
        featured &&
          cn(
            'order-first lg:order-none shadow-elevation-md',
            isGold ? 'border-amber-400/70 dark:border-amber-300/50' : 'border-[var(--coral-500)]/70',
          ),
        isCurrent && 'border-emerald-500/70 dark:border-emerald-400/50',
        // En mobile, un plan inferior al tuyo no compite con tu plan ni con la recomendación.
        state === 'lower' && 'opacity-70 order-last lg:order-none',
      )}
    >
      {featured && (
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -top-24 -right-16 w-64 h-64 rounded-full blur-3xl opacity-50',
            isGold ? 'bg-amber-300/40' : 'bg-[var(--coral-500)]/30',
          )}
        />
      )}

      <header className="relative flex items-start gap-3.5">
        <div className={cn('w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center shrink-0', accentTile(plan.accent))}>
          <Icon name={plan.icon} filled className="text-[26px]" />
        </div>
        <div className="min-w-0 flex-1">
          {featured && <span className="section-kicker block mb-1.5">Tu próximo paso</span>}
          <div className="flex items-center gap-2 flex-wrap">
            <h4
              id={headingId}
              className={cn('italic font-semibold leading-tight', featured ? 'text-[26px]' : 'text-[22px]', tone.strong)}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {item.name}
            </h4>
            {isCurrent && (
              <Pill tone="ok" icon="check" className="h-6 px-2 text-[11px]">
                Tu plan
              </Pill>
            )}
          </div>
          <p className={cn('text-[13.5px] mt-1 leading-snug', tone.muted)}>{plan.tagline}</p>
        </div>
      </header>

      <div className={cn('relative flex flex-col gap-3 rounded-[var(--radius-md)] p-4', tone.sunken)}>
        <PriceBlock plan={plan} item={item} large={featured} />
        {((state === 'available' && balance !== null) || (savings && plan.tier === 'FOUNDING')) && (
          <div className="flex flex-wrap gap-1.5">
            {state === 'available' && balance !== null && <Affordability price={item.price} balance={balance} />}
            {savings && plan.tier === 'FOUNDING' && <SavingsTag savings={savings} />}
          </div>
        )}
      </div>

      <div className="relative">
        <BenefitList plan={plan} inheritsFrom={prev?.shortName} heading={benefitHeading} />
      </div>

      <div className="relative mt-auto flex flex-col gap-2.5">
        <Button
          variant={state === 'available' ? 'primary' : 'secondary'}
          disabled={state === 'lower' || state === 'lifetime'}
          onClick={() => onSelect(item, featured ? 'featured' : 'card')}
          className="w-full h-12 rounded-[var(--radius-pill)] gap-1.5 text-[15px]"
        >
          {ctaLabel(plan, state)}
          {state === 'available' && <Icon name="arrow_forward" className="text-[18px]" />}
        </Button>
        {featured && (
          <p className={cn('text-[12.5px] text-center leading-snug', tone.muted)}>
            Se paga con coins. Vence a los {plan.durationDays} días y no se renueva solo.
          </p>
        )}
      </div>
    </article>
  );
};

const CellValue: React.FC<{ value: ComparisonCell }> = ({ value }) => {
  if (value === true) {
    return (
      <>
        <Icon name="check_circle" filled className="text-[18px] text-emerald-500" />
        <span className="sr-only">Incluido</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <span aria-hidden="true" className={tone.muted}>—</span>
        <span className="sr-only">No incluido</span>
      </>
    );
  }
  return <span className="text-[12px] font-semibold leading-tight">{value}</span>;
};

const TABLE_TIERS: MembershipTier[] = ['STANDARD', 'PREMIUM', 'VIP', 'FOUNDING'];

/** Tabla real (no tarjetas sueltas) para comparar de un vistazo. Entra entera desde 360px; más angosto, scroll con la 1.ª columna fija. */
const PlanComparison: React.FC<{ currentTier: MembershipTier; offered: Set<MembershipTier> }> = ({ currentTier, offered }) => {
  const tiers = TABLE_TIERS.filter((t) => t === 'STANDARD' || offered.has(t));
  const ref = useRef<HTMLElement>(null);

  // Medimos si la gente llega a comparar: es la señal de que la decisión no fue obvia.
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        trackStore({ name: 'store_compare_viewed' });
        observer.disconnect();
      }
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="flex flex-col gap-3" aria-labelledby="compare-title">
      <div id="compare-title">
        <SectionTitle kicker="Sin letra chica" title="Compará los planes" />
      </div>
      <div className={cn('overflow-x-auto overflow-y-hidden', tone.card)}>
        <table className="w-full min-w-[300px] table-fixed border-collapse text-left">
          <caption className="sr-only">Beneficios incluidos en cada plan</caption>
          <thead>
            <tr>
              <th scope="col" className={cn('sticky left-0 z-10 w-[30%] lg:w-[34%] px-3 py-3.5 lg:px-5 text-[11px] font-bold uppercase tracking-[0.1em]', tone.faint, tone.surface)}>
                Beneficio
              </th>
              {tiers.map((t) => (
                <th
                  key={t}
                  scope="col"
                  className={cn(
                    'px-1 py-3.5 sm:p-3 text-center text-[13.5px] font-bold',
                    t === currentTier ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : tone.strong,
                  )}
                >
                  {TIER_SHORT_NAME[t]}
                  {t === currentTier && <span className="block text-[10.5px] font-semibold">Tu plan</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.label} className={cn('border-t', tone.divider)}>
                <th scope="row" className={cn('sticky left-0 z-10 px-3 py-3.5 lg:px-5 text-[13px] font-semibold leading-snug', tone.strong, tone.surface)}>
                  {row.label}
                </th>
                {tiers.map((t) => (
                  <td
                    key={t}
                    className={cn(
                      'px-1 py-3.5 sm:p-3 text-center align-middle',
                      tone.strong,
                      t === currentTier && 'bg-emerald-50/60 dark:bg-emerald-400/5',
                    )}
                  >
                    <span className="inline-flex flex-col items-center">
                      <CellValue value={row.values[t]} />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={cn('px-1 text-[12.5px] leading-relaxed', tone.faint)}>
        "Con coins" = podés comprarlo suelto en Poderes sin tener un plan. Ningún plan se renueva automáticamente.
      </p>
    </section>
  );
};

export const PlansSection: React.FC<PlansSectionProps> = ({ items, currentTier, currentIsLifetime, balance, onSelect }) => {
  const offered = PLANS.flatMap((plan) => {
    const item = items.find((i) => i.key === plan.key);
    return item ? [{ plan, item }] : [];
  });
  const nextStep = nextStepPlan(currentTier, items);
  const savings = blackSavings(items);

  return (
    <div className="flex flex-col gap-8">
      {currentTier === 'FOUNDING' && (
        <p className={cn('flex items-start gap-3 rounded-[var(--radius-md)] border p-4 text-[13.5px] leading-relaxed', tone.sunken, tone.divider, tone.strong)}>
          <Icon name="military_tech" filled className={cn('text-[22px] shrink-0', tone.gold)} />
          Tenés el plan más completo de Findy. Abajo ves todo lo que incluye y, si querés, podés renovarlo.
        </p>
      )}

      <section className="flex flex-col gap-3" aria-label="Planes">
        {/* Mobile: la destacada primero (order-first). Desktop: Plus → Gold → Black en fila. */}
        <div className={cn('grid gap-4 items-stretch', offered.length >= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>
          {offered.map(({ plan, item }) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              item={item}
              state={planState(plan, currentTier, currentIsLifetime)}
              featured={plan.key === nextStep?.key}
              currentTier={currentTier}
              savings={savings}
              balance={balance}
              onSelect={onSelect}
            />
          ))}
        </div>
      </section>

      <PlanComparison currentTier={currentTier} offered={new Set(offered.map(({ plan }) => plan.tier))} />
    </div>
  );
};
