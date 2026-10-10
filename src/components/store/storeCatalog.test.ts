import { describe, expect, it } from 'vitest';
import type { ShopItem } from '../../types';
import {
  blackSavings,
  coinsPerDay,
  COMPARISON_ROWS,
  describeLedgerReason,
  nextStepPlan,
  perkLabel,
  PLANS,
  powerRedundantForTier,
} from './storeCatalog';

const item = (key: string, price: number): ShopItem => ({ key, name: key, description: '', price, priceUsd: null });
const allPlans = [item('MEMBERSHIP_PREMIUM', 150), item('MEMBERSHIP_VIP', 400), item('MEMBERSHIP_FOUNDING', 900)];

describe('nextStepPlan', () => {
  it('recomienda el escalón siguiente, no uno fijo', () => {
    expect(nextStepPlan('STANDARD', allPlans)?.tier).toBe('PREMIUM');
    expect(nextStepPlan('PREMIUM', allPlans)?.tier).toBe('VIP');
    expect(nextStepPlan('VIP', allPlans)?.tier).toBe('FOUNDING');
  });

  it('no recomienda nada al plan más alto', () => {
    expect(nextStepPlan('FOUNDING', allPlans)).toBeUndefined();
  });

  it('salta planes que el backend no ofrece', () => {
    expect(nextStepPlan('STANDARD', [item('MEMBERSHIP_VIP', 400)])?.tier).toBe('VIP');
  });
});

describe('blackSavings', () => {
  it('calcula el ahorro contra 3 meses de Gold con precios reales', () => {
    expect(blackSavings(allPlans)).toEqual({ coins: 300, percent: 25 });
  });

  it('no muestra ahorro si no lo hay', () => {
    expect(blackSavings([item('MEMBERSHIP_VIP', 300), item('MEMBERSHIP_FOUNDING', 900)])).toBeNull();
    expect(blackSavings([item('MEMBERSHIP_VIP', 300), item('MEMBERSHIP_FOUNDING', 1000)])).toBeNull();
  });

  it('no inventa ahorro si falta un plan', () => {
    expect(blackSavings([item('MEMBERSHIP_FOUNDING', 900)])).toBeNull();
  });
});

describe('coinsPerDay', () => {
  it('redondea a un decimal y rechaza precios inválidos', () => {
    expect(coinsPerDay(400, 30)).toBe(13.3);
    expect(coinsPerDay(0, 30)).toBeNull();
  });
});

describe('perkLabel', () => {
  const base = { itemKey: 'BOOST', limit: 1, periodDays: 7, resetsAt: null };
  it('describe el cupo incluido', () => {
    expect(perkLabel({ ...base, unlimited: true, remaining: null })).toBe('Incluido');
    expect(perkLabel({ ...base, unlimited: false, remaining: 1 })).toBe('Incluido · queda 1');
    expect(perkLabel({ ...base, unlimited: false, remaining: 0 })).toBeNull();
  });
});

describe('describeLedgerReason', () => {
  it('traduce motivos internos a texto legible', () => {
    expect(describeLedgerReason('daily_bonus', []).label).toBe('Bono diario');
    expect(describeLedgerReason('shop_BOOST', [{ ...item('BOOST', 50), name: 'Boost 30 min' }]).label).toBe('Boost 30 min');
    expect(describeLedgerReason('recharge_PACK_LARGE', []).label).toBe('Recarga de coins');
  });
});

describe('catálogo', () => {
  it('cada fila de la comparación cubre los cuatro niveles', () => {
    for (const row of COMPARISON_ROWS) {
      expect(Object.keys(row.values).sort()).toEqual(['FOUNDING', 'PREMIUM', 'STANDARD', 'VIP']);
    }
  });

  it('los planes van de menor a mayor duración', () => {
    const days = PLANS.map((p) => p.durationDays);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });
});

describe('historias por día', () => {
  it('coincide con el backend: Gratis 20, Plus 40, Gold y Black sin límite', () => {
    const row = COMPARISON_ROWS.find((r) => r.label === 'Historias por día')!;
    expect(row.values).toEqual({ STANDARD: '20', PREMIUM: '40', VIP: 'Sin límite', FOUNDING: 'Sin límite' });
  });

  it('no ofrece perfiles extra a quien ya no tiene tope', () => {
    expect(powerRedundantForTier('EXTRA_PROFILES', 'VIP')).toBe(true);
    expect(powerRedundantForTier('EXTRA_PROFILES', 'FOUNDING')).toBe(true);
    expect(powerRedundantForTier('EXTRA_PROFILES', 'PREMIUM')).toBe(false);
    expect(powerRedundantForTier('BOOST', 'FOUNDING')).toBe(false);
  });
});
