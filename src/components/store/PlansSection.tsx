import React from 'react';
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
import { accentText, accentTile, Coins, Icon, SectionTitle, tone } from './storeUi';

interface PlansSectionProps {
  items: ShopItem[];
  currentTier: MembershipTier;
  /** El plan actual no vence (Black "para siempre" de antes): no hay nada que renovar. */
  currentIsLifetime: boolean;
  onSelect: (item: ShopItem) => void;
}

type PlanState = 'current' | 'lifetime' | 'lower' | 'available';

function planState(plan: PlanDefinition, currentTier: MembershipTier, currentIsLifetime: boolean): PlanState {
  if (plan.tier === currentTier) return currentIsLifetime ? 'lifetime' : 'current';
  // Comprar un plan menor con uno mayor activo lo pisaba (el backend lo rechaza).
  if (TIER_RANK[plan.tier] < TIER_RANK[currentTier]) return 'lower';
  return 'available';
}

function ctaLabel(plan: PlanDefinition, item: ShopItem, state: PlanState): string {
  switch (state) {
    case 'lower':
      return 'Ya tenés un plan superior';
    case 'lifetime':
      return 'Tu plan · sin vencimiento';
    case 'current':
      return `Renovar +${plan.durationDays} días`;
    default:
      return `Obtener ${plan.shortName} · ${item.price.toLocaleString('es-AR')} coins`;
  }
}

/** Precio + duración + costo por día (+ USD aprox. si el backend lo informa). */
const PriceBlock: React.FC<{ plan: PlanDefinition; item: ShopItem; large?: boolean }> = ({ plan, item, large }) => {
  const perDay = coinsPerDay(item.price, plan.durationDays);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-1.5">
        <Coins amount={item.price} className={cn('font-bold', large ? 'text-[30px]' : 'text-[22px]', tone.strong)} />
        <span className={cn('text-[13px]', tone.muted)}>/ {plan.durationDays} días</span>
      </div>
      <span className={cn('text-[12px]', tone.muted)}>
        {perDay !== null && <>≈ {perDay.toLocaleString('es-AR')} coins por día</>}
        {item.priceUsd != null && <> · ≈ US$ {item.priceUsd.toFixed(2)}</>}
      </span>
    </div>
  );
};

const BenefitList: React.FC<{ plan: PlanDefinition; inheritsFrom?: string }> = ({ plan, inheritsFrom }) => (
  <div className="flex flex-col gap-2">
    {inheritsFrom && <p className={cn('text-[12px] font-semibold', tone.muted)}>Todo lo de {inheritsFrom}, y además:</p>}
    <ul className="flex flex-col gap-2">
      {plan.adds.map((benefit) => (
        <li key={benefit} className={cn('flex items-start gap-2 text-[13.5px] leading-snug', tone.strong)}>
          <Icon name="check_circle" filled className={cn('text-[17px] mt-px shrink-0', accentText(plan.accent))} />
          <span>{benefit}</span>
        </li>
      ))}
    </ul>
  </div>
);

/**
 * Plan recomendado: el siguiente escalón sobre el plan actual, explicado como
 * "qué suma a lo que ya tenés". No hay "más popular" ni urgencia: no tenemos
 * datos que lo respalden.
 */
const NextStepSpotlight: React.FC<{
  plan: PlanDefinition;
  item: ShopItem;
  currentTier: MembershipTier;
  savings: { coins: number; percent: number } | null;
  onSelect: (item: ShopItem) => void;
}> = ({ plan, item, currentTier, savings, onSelect }) => {
  const isGold = plan.accent === 'gold';
  return (
    <section
      aria-labelledby="next-step-title"
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-lg)] border-2 p-5 flex flex-col gap-4 shadow-elevation-md',
        tone.surface,
        isGold ? 'border-amber-400/70 dark:border-amber-300/50' : 'border-[var(--coral-500)]/70',
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-40',
          isGold ? 'bg-amber-300/50' : 'bg-[var(--coral-300)]/50',
        )}
      />
      <div className="relative flex items-start gap-3">
        <div className={cn('w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center shrink-0', accentTile(plan.accent))}>
          <Icon name={plan.icon} filled className="text-[26px]" />
        </div>
        <div className="min-w-0">
          <span className="section-kicker block mb-1">Tu próximo paso</span>
          <h3
            id="next-step-title"
            className={cn('text-[24px] leading-tight italic font-semibold', tone.strong)}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {item.name}
          </h3>
          <p className={cn('text-[13px] mt-1', tone.muted)}>{plan.tagline}</p>
        </div>
      </div>

      <div className="relative flex flex-col gap-2">
        <p className={cn('text-[12px] font-semibold uppercase tracking-[0.12em]', tone.muted)}>
          {currentTier === 'STANDARD' ? 'Lo que suma a tu cuenta' : `Lo que suma a tu ${TIER_SHORT_NAME[currentTier]}`}
        </p>
        <BenefitList plan={plan} />
      </div>

      <div className={cn('relative flex flex-col gap-3 pt-4 border-t', tone.divider)}>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <PriceBlock plan={plan} item={item} large />
          {savings && plan.tier === 'FOUNDING' && <SavingsTag savings={savings} />}
        </div>
        <Button size="lg" onClick={() => onSelect(item)} className="w-full rounded-[var(--radius-pill)] h-12 gap-1.5">
          Obtener {plan.shortName}
          <Icon name="arrow_forward" className="text-[18px]" />
        </Button>
        <p className={cn('text-[12px] text-center', tone.muted)}>
          Se paga con coins. Vence a los {plan.durationDays} días y no se renueva solo.
        </p>
      </div>
    </section>
  );
};

const SavingsTag: React.FC<{ savings: { coins: number; percent: number } }> = ({ savings }) => (
  <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-[12px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
    <Icon name="savings" className="text-[15px]" />
    Ahorrás {savings.coins.toLocaleString('es-AR')} coins ({savings.percent}%) vs. 3 meses de Gold
  </span>
);

const PlanCard: React.FC<{
  plan: PlanDefinition;
  item: ShopItem;
  state: PlanState;
  savings: { coins: number; percent: number } | null;
  onSelect: (item: ShopItem) => void;
}> = ({ plan, item, state, savings, onSelect }) => {
  const isCurrent = state === 'current' || state === 'lifetime';
  const prev = previousPlan(plan);
  return (
    <article
      aria-label={`Plan ${plan.shortName}`}
      className={cn(
        'relative rounded-[var(--radius-lg)] border p-4 flex flex-col gap-4',
        tone.surface,
        isCurrent && 'border-2 border-emerald-500/70 dark:border-emerald-400/50',
        state === 'lower' && 'opacity-70',
      )}
    >
      <header className="flex items-start gap-3">
        <div className={cn('w-10 h-10 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0', accentTile(plan.accent))}>
          <Icon name={plan.icon} filled className="text-[22px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={cn('text-[17px] font-bold', tone.strong)}>{item.name}</h4>
            {isCurrent && (
              <span className="inline-flex items-center gap-0.5 rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-bold bg-emerald-500 text-white">
                <Icon name="check" className="text-[13px]" />
                Tu plan
              </span>
            )}
          </div>
          <p className={cn('text-[12.5px] mt-0.5', tone.muted)}>{plan.tagline}</p>
        </div>
      </header>

      <PriceBlock plan={plan} item={item} />
      {savings && plan.tier === 'FOUNDING' && <SavingsTag savings={savings} />}

      <BenefitList plan={plan} inheritsFrom={prev?.shortName} />

      <Button
        variant={state === 'available' ? 'primary' : 'secondary'}
        disabled={state === 'lower' || state === 'lifetime'}
        onClick={() => onSelect(item)}
        className="w-full mt-auto rounded-[var(--radius-pill)]"
      >
        {ctaLabel(plan, item, state)}
      </Button>
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
  return (
    <section className="flex flex-col gap-3" aria-labelledby="compare-title">
      <div id="compare-title">
        <SectionTitle kicker="Sin letra chica" title="Compará los planes" />
      </div>
      <div className={cn('rounded-[var(--radius-lg)] border overflow-x-auto', tone.surface)}>
        <table className="w-full min-w-[300px] table-fixed border-collapse text-left">
          <caption className="sr-only">Beneficios incluidos en cada plan</caption>
          <thead>
            <tr>
              <th scope="col" className={cn('sticky left-0 z-10 w-[30%] px-2 py-3 sm:p-3 text-[11px] font-semibold uppercase tracking-[0.1em]', tone.muted, tone.surface)}>
                Beneficio
              </th>
              {tiers.map((t) => (
                <th
                  key={t}
                  scope="col"
                  className={cn(
                    'px-1 py-3 sm:p-3 text-center text-[13px] font-bold',
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
                <th scope="row" className={cn('sticky left-0 z-10 px-2.5 py-3 sm:p-3 text-[12.5px] font-semibold leading-snug', tone.strong, tone.surface)}>
                  {row.label}
                </th>
                {tiers.map((t) => (
                  <td
                    key={t}
                    className={cn(
                      'px-1 py-3 sm:p-3 text-center align-middle',
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
      <p className={cn('px-1 text-[12px] leading-relaxed', tone.muted)}>
        "Con coins" = podés comprarlo suelto en Poderes sin tener un plan. Ningún plan se renueva automáticamente.
      </p>
    </section>
  );
};

export const PlansSection: React.FC<PlansSectionProps> = ({ items, currentTier, currentIsLifetime, onSelect }) => {
  const offered = PLANS.flatMap((plan) => {
    const item = items.find((i) => i.key === plan.key);
    return item ? [{ plan, item }] : [];
  });
  const nextStep = nextStepPlan(currentTier, items);
  const nextStepItem = nextStep ? items.find((i) => i.key === nextStep.key) : undefined;
  const savings = blackSavings(items);
  const rest = offered.filter(({ plan }) => plan.key !== nextStep?.key);

  return (
    <div className="flex flex-col gap-7">
      {nextStep && nextStepItem && (
        <NextStepSpotlight plan={nextStep} item={nextStepItem} currentTier={currentTier} savings={savings} onSelect={onSelect} />
      )}

      {currentTier === 'FOUNDING' && (
        <p className={cn('rounded-[var(--radius-md)] p-4 text-[13px] leading-relaxed', tone.sunken, tone.strong)}>
          Tenés el plan más completo de FINDY. Abajo ves todo lo que incluye y, si querés, podés renovarlo.
        </p>
      )}

      {rest.length > 0 && (
        <section className="flex flex-col gap-3" aria-label={nextStep ? 'Otros planes' : 'Planes'}>
          <SectionTitle title={nextStep ? 'Otros planes' : 'Planes'} />
          <div className="grid gap-3 md:grid-cols-2">
            {rest.map(({ plan, item }) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                item={item}
                state={planState(plan, currentTier, currentIsLifetime)}
                savings={savings}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      )}

      <PlanComparison currentTier={currentTier} offered={new Set(offered.map(({ plan }) => plan.tier))} />
    </div>
  );
};
