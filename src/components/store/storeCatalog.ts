import type { CoinPack, MembershipTier, PerkItemStatus, ShopItem } from '../../types';

/*
 * Catálogo de presentación de la Tienda — lo que el backend NO expone (íconos,
 * duración, beneficios por plan) y por eso se mantiene a mano acá. Precios,
 * nombres y descripciones siempre vienen de GET /shop; nada de este archivo
 * inventa un precio ni un descuento.
 *
 * Fuente de verdad de los beneficios: MEMBERSHIP_PERKS y membershipDiscoverBonus
 * del backend. Si cambian allá, hay que cambiarlos acá (ver docs/TIENDA-PLANES.md).
 */

export type PaidTier = Exclude<MembershipTier, 'STANDARD'>;

/** Un beneficio contado como resultado: qué es y para qué te sirve en FINDY. */
export interface PlanBenefit {
  icon: string;
  title: string;
  outcome: string;
}

export interface PlanDefinition {
  key: string;
  tier: PaidTier;
  /** Nombre corto que usa toda la app (el backend devuelve el nombre comercial en item.name). */
  shortName: string;
  icon: string;
  /** Acento del plan dentro de la paleta existente (rosa / dorado). */
  accent: 'coral' | 'gold';
  durationDays: number;
  tagline: string;
  /** Lo que suma este plan sobre el anterior (no repite lo heredado). */
  benefits: PlanBenefit[];
}

export const PLANS: PlanDefinition[] = [
  {
    key: 'MEMBERSHIP_PREMIUM',
    tier: 'PREMIUM',
    shortName: 'Plus',
    icon: 'workspace_premium',
    accent: 'coral',
    durationDays: 7,
    tagline: 'Para probar una semana con más alcance.',
    benefits: [
      { icon: 'star', title: 'Perfil destacado en Descubrir', outcome: 'Tu tarjeta se ve destacada cuando otros te descubren.' },
      { icon: 'visibility', title: 'Ver quién te dio like', outcome: 'Respondés directo a quien ya mostró interés.' },
      { icon: 'person_add', title: '+20 historias extra por día', outcome: 'Seguís conociendo gente cuando se termina el cupo base.' },
      { icon: 'bolt', title: '1 Boost gratis por semana', outcome: 'Un empujón de visibilidad sin gastar coins.' },
    ],
  },
  {
    key: 'MEMBERSHIP_VIP',
    tier: 'VIP',
    shortName: 'Gold',
    icon: 'diamond',
    accent: 'gold',
    durationDays: 30,
    tagline: 'Un mes sin preocuparte por el cupo.',
    benefits: [
      { icon: 'all_inclusive', title: 'Historias casi sin límite por día', outcome: 'El cupo diario deja de ser un tope.' },
      { icon: 'replay', title: 'Deshacer pass ilimitado', outcome: 'Si pasaste a alguien sin querer, lo recuperás.' },
      { icon: 'auto_awesome', title: '3 Super Sparks por mes', outcome: 'Invitaciones destacadas para quien de verdad te interesa.' },
      { icon: 'favorite', title: '1 Reactivar match por mes', outcome: 'Una segunda oportunidad con un match que se enfrió.' },
    ],
  },
  {
    key: 'MEMBERSHIP_FOUNDING',
    tier: 'FOUNDING',
    shortName: 'Black',
    icon: 'military_tech',
    accent: 'gold',
    durationDays: 90,
    tagline: 'Tres meses, y tus citas reales rinden el doble.',
    benefits: [
      { icon: 'verified', title: 'Doble de coins por cada cita verificada', outcome: 'Cada cita real te devuelve el doble.' },
      { icon: 'redeem', title: '300 coins de bienvenida', outcome: 'Arrancás con saldo para poderes sueltos.' },
      { icon: 'military_tech', title: 'Sello exclusivo "Miembro Black"', outcome: 'Queda en tu pasaporte de conexiones.' },
      { icon: 'palette', title: 'Temas de chat exclusivos', outcome: 'Tus conversaciones con otra estética.' },
    ],
  },
];

export const TIER_RANK: Record<MembershipTier, number> = { STANDARD: 0, PREMIUM: 1, VIP: 2, FOUNDING: 3 };

export const TIER_SHORT_NAME: Record<MembershipTier, string> = {
  STANDARD: 'Gratis',
  PREMIUM: 'Plus',
  VIP: 'Gold',
  FOUNDING: 'Black',
};

export function planForKey(key: string): PlanDefinition | undefined {
  return PLANS.find((p) => p.key === key);
}

export function planForTier(tier: MembershipTier): PlanDefinition | undefined {
  return PLANS.find((p) => p.tier === tier);
}

/** El plan anterior en la escalera — "Todo lo de X, y además…". */
export function previousPlan(plan: PlanDefinition): PlanDefinition | undefined {
  const idx = PLANS.indexOf(plan);
  return idx > 0 ? PLANS[idx - 1] : undefined;
}

/**
 * Plan recomendado = el siguiente escalón sobre el plan actual, nunca un "más
 * popular" sin datos que lo respalden. Black no tiene siguiente paso.
 */
export function nextStepPlan(current: MembershipTier, available: ShopItem[]): PlanDefinition | undefined {
  return PLANS.find((p) => TIER_RANK[p.tier] > TIER_RANK[current] && available.some((i) => i.key === p.key));
}

/** Costo por día en coins, redondeado a 1 decimal. null si el precio no es válido. */
export function coinsPerDay(price: number, days: number): number | null {
  if (!Number.isFinite(price) || price <= 0 || days <= 0) return null;
  return Math.round((price / days) * 10) / 10;
}

/**
 * Ahorro real de Black frente a pagar Gold el mismo tiempo (90 días = 3 × 30),
 * calculado con los precios de /shop. null si no hay ahorro — en ese caso no se
 * muestra nada, en vez de prometer un descuento que no existe.
 */
export function blackSavings(items: ShopItem[]): { coins: number; percent: number } | null {
  const gold = PLANS.find((p) => p.tier === 'VIP')!;
  const black = PLANS.find((p) => p.tier === 'FOUNDING')!;
  const goldItem = items.find((i) => i.key === gold.key);
  const blackItem = items.find((i) => i.key === black.key);
  if (!goldItem || !blackItem || goldItem.price <= 0) return null;
  const equivalent = goldItem.price * (black.durationDays / gold.durationDays);
  const coins = Math.round(equivalent - blackItem.price);
  if (coins <= 0) return null;
  return { coins, percent: Math.round((coins / equivalent) * 100) };
}

/* ---------- Comparación entre planes ---------- */

/** Celda de la tabla: true = incluido, false = no, string = valor concreto. */
export type ComparisonCell = boolean | string;

export interface ComparisonRow {
  label: string;
  hint?: string;
  values: Record<MembershipTier, ComparisonCell>;
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: 'Historias por día',
    values: { STANDARD: 'Cupo base', PREMIUM: '+20 extra', VIP: 'Casi sin límite', FOUNDING: 'Casi sin límite' },
  },
  { label: 'Perfil destacado en Descubrir', values: { STANDARD: false, PREMIUM: true, VIP: true, FOUNDING: true } },
  {
    label: 'Ver quién te dio like',
    values: { STANDARD: 'Con coins', PREMIUM: true, VIP: true, FOUNDING: true },
  },
  {
    label: 'Boost',
    values: { STANDARD: 'Con coins', PREMIUM: '1 por semana', VIP: '1 por semana', FOUNDING: '1 por semana' },
  },
  {
    label: 'Deshacer pass',
    values: { STANDARD: 'Con coins', PREMIUM: 'Con coins', VIP: 'Ilimitado', FOUNDING: 'Ilimitado' },
  },
  {
    label: 'Super Spark',
    values: { STANDARD: 'Con coins', PREMIUM: 'Con coins', VIP: '3 por mes', FOUNDING: '3 por mes' },
  },
  {
    label: 'Reactivar match',
    values: { STANDARD: 'Con coins', PREMIUM: 'Con coins', VIP: '1 por mes', FOUNDING: '1 por mes' },
  },
  {
    label: 'Coins por cita verificada',
    values: { STANDARD: 'Normal', PREMIUM: 'Normal', VIP: 'Normal', FOUNDING: 'Doble' },
  },
  { label: 'Coins de bienvenida', values: { STANDARD: false, PREMIUM: false, VIP: false, FOUNDING: '300' } },
  {
    label: 'Sello Black y temas de chat',
    values: { STANDARD: false, PREMIUM: false, VIP: false, FOUNDING: true },
  },
  { label: 'Bono diario de coins', values: { STANDARD: true, PREMIUM: true, VIP: true, FOUNDING: true } },
];

/* ---------- Poderes ---------- */

export interface PowerPresentation {
  icon: string;
  accent: 'coral' | 'gold';
  /** Cuándo conviene comprarlo — el uso práctico, no la mecánica. */
  useCase: string;
  /** Fila de COMPARISON_ROWS que dice desde qué plan viene incluido (una sola fuente). */
  comparisonRow?: string;
}

export const POWER_PRESENTATION: Record<string, PowerPresentation> = {
  UNDO_PASS: { icon: 'replay', accent: 'coral', useCase: 'Para cuando pasaste a alguien sin querer.', comparisonRow: 'Deshacer pass' },
  EXTRA_PROFILES: { icon: 'person_add', accent: 'coral', useCase: 'Para seguir conociendo gente cuando se termina tu cupo del día.' },
  SUPER_INVITE: { icon: 'star', accent: 'gold', useCase: 'Para que alguien que te interesa vea tu invitación primero.', comparisonRow: 'Super Spark' },
  REACTIVATE_MATCH: { icon: 'favorite', accent: 'coral', useCase: 'Para retomar un match que se enfrió.', comparisonRow: 'Reactivar match' },
  BOOST: { icon: 'bolt', accent: 'gold', useCase: 'Para que más gente vea tu perfil ahora.', comparisonRow: 'Boost' },
  LIKES_UNLOCK: { icon: 'visibility', accent: 'coral', useCase: 'Para ver quién ya te dio like y responder directo.', comparisonRow: 'Ver quién te dio like' },
};

const PAID_TIERS: PaidTier[] = ['PREMIUM', 'VIP', 'FOUNDING'];

/**
 * Primer plan que incluye un poder, leído de la tabla comparativa (no de una
 * copia aparte). "Con coins" o false = no incluido en ese plan.
 */
export function includedFrom(itemKey: string): { tier: PaidTier; value: ComparisonCell } | null {
  const rowLabel = POWER_PRESENTATION[itemKey]?.comparisonRow;
  const row = rowLabel ? COMPARISON_ROWS.find((r) => r.label === rowLabel) : undefined;
  if (!row) return null;
  const tier = PAID_TIERS.find((t) => row.values[t] !== false && row.values[t] !== 'Con coins');
  return tier ? { tier, value: row.values[tier] } : null;
}

/** Poderes que no se activan desde la tienda sino en su contexto. */
export const CONTEXTUAL_HINT: Record<string, string> = {
  SUPER_INVITE: 'Se usa desde Descubrir, al enviar una invitación destacada.',
  REACTIVATE_MATCH: 'Se usa desde Matches, en "Se enfriaron".',
};

export function isMembershipItem(item: ShopItem): boolean {
  return item.key.startsWith('MEMBERSHIP_');
}

/** Cupo incluido que se puede usar hoy: "sin límite", "queda 1", "quedan 2", o null si no hay. */
export function perkDetail(perk: PerkItemStatus | undefined): string | null {
  if (!perk) return null;
  if (perk.unlimited) return 'sin límite';
  if ((perk.remaining ?? 0) > 0) return perk.remaining === 1 ? 'queda 1' : `quedan ${perk.remaining}`;
  return null;
}

/** Texto corto del cupo incluido: "Incluido", "Incluido · quedan 2", o null si no hay cupo. */
export function perkLabel(perk: PerkItemStatus | undefined): string | null {
  const detail = perkDetail(perk);
  if (!detail) return null;
  return perk?.unlimited ? 'Incluido' : `Incluido · ${detail}`;
}

export function perkResetLabel(perk: PerkItemStatus | undefined): string | null {
  if (!perk || perk.unlimited || (perk.remaining ?? 0) > 0 || !perk.resetsAt) return null;
  const date = new Date(perk.resetsAt);
  if (!Number.isFinite(date.getTime())) return null;
  return `Tu plan suma otro el ${date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`;
}

export function minutesLeft(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 60000));
}

export function formatRemaining(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  return h < 24 ? `${h} h` : `${Math.floor(h / 24)} d`;
}

/* ---------- Coins ---------- */

export const REWARD_REASON_LABELS: Record<string, { icon: string; label: string }> = {
  match: { icon: 'favorite', label: 'Nuevo match' },
  conversation: { icon: 'chat_bubble', label: 'Charla iniciada' },
  date_accepted: { icon: 'event_available', label: 'Cita aceptada' },
  date_verified: { icon: 'verified', label: 'Cita verificada' },
  second_date_verified: { icon: 'workspace_premium', label: 'Segunda cita verificada' },
  daily_bonus: { icon: 'today', label: 'Bono diario' },
  membership_welcome: { icon: 'diamond', label: 'Bienvenida a Findy Black' },
};

/** Formas reales de ganar coins (los motivos que el backend acredita). Sin montos: no los exponemos. */
export const EARN_WAYS = ['daily_bonus', 'match', 'conversation', 'date_accepted', 'date_verified', 'second_date_verified'] as const;

/**
 * El historial trae el `reason` interno ("shop_BOOST", "recharge_PACK_LARGE");
 * esto arma ícono + texto en español reusando el nombre real del ítem.
 */
export function describeLedgerReason(reason: string, shopItems: ShopItem[]): { icon: string; label: string } {
  if (reason in REWARD_REASON_LABELS) return REWARD_REASON_LABELS[reason];
  if (reason.startsWith('shop_refund_')) {
    const itemKey = reason.replace('shop_refund_', '');
    const item = shopItems.find((i) => i.key === itemKey);
    return { icon: 'undo', label: `Reembolso · ${item?.name ?? itemKey}` };
  }
  if (reason.startsWith('shop_')) {
    const itemKey = reason.replace('shop_', '');
    const item = shopItems.find((i) => i.key === itemKey);
    const icon = planForKey(itemKey)?.icon ?? POWER_PRESENTATION[itemKey]?.icon ?? 'shopping_bag';
    return { icon, label: item?.name ?? itemKey };
  }
  if (reason.startsWith('recharge_')) return { icon: 'monetization_on', label: 'Recarga de coins' };
  if (reason.startsWith('promo_')) return { icon: 'redeem', label: `Código ${reason.replace('promo_', '')}` };
  return { icon: 'receipt_long', label: reason };
}

export function formatShortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

/* ---------- Valor de compra (aritmética con precios reales, nada inventado) ---------- */

/** Fecha en que vence el plan si se compra hoy. Renovar suma días al vencimiento vigente. */
export function planEndDate(plan: PlanDefinition, currentTier: MembershipTier, currentExpiresAt: string | null, now = new Date()): Date {
  const current = currentExpiresAt ? new Date(currentExpiresAt) : null;
  const base =
    plan.tier === currentTier && current && Number.isFinite(current.getTime()) && current.getTime() > now.getTime() ? current : now;
  return new Date(base.getTime() + plan.durationDays * 86_400_000);
}

/**
 * Cuántas coins más por dólar da cada paquete frente al que menos rinde, en %.
 * Solo aparece si es real (> 0): el paquete base nunca muestra "ahorro".
 */
export function packBonusPercent(packs: CoinPack[]): Record<string, number> {
  const rates = packs.filter((p) => p.priceUsd > 0 && p.coins > 0).map((p) => ({ key: p.key, rate: p.coins / p.priceUsd }));
  if (rates.length < 2) return {};
  const base = Math.min(...rates.map((r) => r.rate));
  return Object.fromEntries(
    rates.flatMap(({ key, rate }) => {
      const pct = Math.round((rate / base - 1) * 100);
      return pct > 0 ? [[key, pct]] : [];
    }),
  );
}

export type PackEquivalent =
  | { kind: 'plan'; plan: PlanDefinition; item: ShopItem }
  | { kind: 'power'; item: ShopItem; count: number };

/** Qué se consigue con un paquete: el plan más alto que alcanza o, si no, cuántos del poder más barato. */
export function packEquivalent(coins: number, shopItems: ShopItem[]): PackEquivalent | null {
  const plan = [...PLANS].reverse().find((p) => {
    const item = shopItems.find((i) => i.key === p.key);
    return item && item.price > 0 && item.price <= coins;
  });
  if (plan) return { kind: 'plan', plan, item: shopItems.find((i) => i.key === plan.key)! };
  const cheapest = shopItems
    .filter((i) => !isMembershipItem(i) && i.price > 0)
    .sort((a, b) => a.price - b.price)[0];
  const count = cheapest ? Math.floor(coins / cheapest.price) : 0;
  return cheapest && count > 0 ? { kind: 'power', item: cheapest, count } : null;
}

/** El paquete más chico que cubre lo que falta. null si ninguno alcanza. */
export function packForShortfall(packs: CoinPack[], shortfall: number): CoinPack | null {
  if (shortfall <= 0) return null;
  return [...packs].sort((a, b) => a.coins - b.coins).find((p) => p.coins >= shortfall) ?? null;
}
