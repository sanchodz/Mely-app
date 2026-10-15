/*
 * Eventos de la Tienda. FINDY todavía no tiene proveedor de analítica: esto
 * emite un CustomEvent en window ('findy:analytics') al que cualquier
 * proveedor futuro se suscribe sin tocar la tienda. Sin datos personales:
 * solo claves de ítem, tier y montos en coins. Lista y experimentos
 * propuestos en docs/TIENDA-PLANES.md.
 */

export type StoreTabId = 'planes' | 'poderes' | 'coins';

export type StoreEvent =
  | { name: 'store_viewed'; tier: string; balance: number }
  | { name: 'store_tab_changed'; tab: StoreTabId }
  | { name: 'store_item_selected'; itemKey: string; price: number; affordable: boolean; source: 'featured' | 'card' | 'power' }
  | { name: 'store_purchase_confirmed'; itemKey: string; price: number; includedInPlan: boolean }
  | { name: 'store_purchase_succeeded'; itemKey: string; price: number; includedInPlan: boolean }
  | { name: 'store_purchase_failed'; itemKey: string; message: string }
  | { name: 'store_purchase_cancelled'; itemKey: string }
  | { name: 'store_insufficient_coins'; itemKey: string; shortfall: number }
  | { name: 'store_pack_selected'; packKey: string; coins: number; recommended: boolean }
  | { name: 'store_recharge_succeeded'; packKey: string; coins: number }
  | { name: 'store_resume_after_recharge'; itemKey: string }
  | { name: 'store_daily_bonus_claimed'; amount: number }
  | { name: 'store_promo_redeemed'; amount: number }
  | { name: 'store_compare_viewed' };

export const STORE_ANALYTICS_EVENT = 'findy:analytics';

export function trackStore(event: StoreEvent): void {
  try {
    window.dispatchEvent(new CustomEvent(STORE_ANALYTICS_EVENT, { detail: { ...event, at: Date.now() } }));
    if (import.meta.env.DEV) console.debug('[store]', event);
  } catch {
    // La analítica nunca puede romper una compra.
  }
}
