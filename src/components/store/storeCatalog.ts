import type { MembershipTier, PerkItemStatus, ShopItem } from '../../types';

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
  adds: string[];
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
    adds: ['Perfil destacado en Descubrir', 'Ver quién te dio like', '40 historias por día (el doble que Gratis)', '1 Boost gratis por semana'],
  },
  {
    key: 'MEMBERSHIP_VIP',
    tier: 'VIP',
    shortName: 'Gold',
    icon: 'diamond',
    accent: 'gold',
    durationDays: 30,
    tagline: 'Un mes sin tope de historias.',
    adds: ['Historias sin límite por día', 'Deshacer pass ilimitado', '3 Super Sparks por mes', '1 Reactivar match por mes'],
  },
  {
    key: 'MEMBERSHIP_FOUNDING',
    tier: 'FOUNDING',
    shortName: 'Black',
    icon: 'military_tech',
    accent: 'gold',
    durationDays: 90,
    tagline: 'Tres meses, y tus citas reales rinden el doble.',
    adds: [
      'Doble de coins por cada cita verificada',
      '300 coins de bienvenida',
      'Sello exclusivo "Miembro Black" en tu pasaporte',
      'Temas de chat exclusivos',
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
    values: { STANDARD: '20', PREMIUM: '40', VIP: 'Sin límite', FOUNDING: 'Sin límite' },
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

export const POWER_PRESENTATION: Record<string, { icon: string; accent: 'coral' | 'gold' }> = {
  UNDO_PASS: { icon: 'replay', accent: 'coral' },
  EXTRA_PROFILES: { icon: 'person_add', accent: 'coral' },
  SUPER_INVITE: { icon: 'star', accent: 'gold' },
  REACTIVATE_MATCH: { icon: 'favorite', accent: 'coral' },
  BOOST: { icon: 'bolt', accent: 'gold' },
  LIKES_UNLOCK: { icon: 'visibility', accent: 'coral' },
};

/** Poderes que no se activan desde la tienda sino en su contexto. */
export const CONTEXTUAL_HINT: Record<string, string> = {
  SUPER_INVITE: 'Se usa desde Descubrir, al enviar una invitación destacada.',
  REACTIVATE_MATCH: 'Se usa desde Matches, en "Se enfriaron".',
};

/** Planes sin tope diario de historias (unlimitedDiscover en el backend). */
export const UNLIMITED_DISCOVER_TIERS: readonly MembershipTier[] = ['VIP', 'FOUNDING'];

/** Poderes que el plan actual vuelve inútiles: con historias sin límite, comprar extra es cobrar por nada. */
export function powerRedundantForTier(itemKey: string, tier: MembershipTier): boolean {
  return itemKey === 'EXTRA_PROFILES' && UNLIMITED_DISCOVER_TIERS.includes(tier);
}

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
