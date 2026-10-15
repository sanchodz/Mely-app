import { describe, expect, it } from 'vitest';
import type { CoinPack, ShopItem } from '../../types';
import {
  blackSavings,
  coinsPerDay,
  COMPARISON_ROWS,
  describeLedgerReason,
  includedFrom,
  nextStepPlan,
  packBonusPercent,
  packEquivalent,
  packForShortfall,
  perkLabel,
  planEndDate,
  PLANS,
  POWER_PRESENTATION,
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

const pack = (key: string, coins: number, priceUsd: number): CoinPack => ({ key, coins, priceUsd, label: key });
const packs = [pack('S', 100, 1), pack('M', 550, 5), pack('L', 1200, 10)];

describe('packBonusPercent', () => {
  it('compara coins por dólar contra el paquete que menos rinde', () => {
    expect(packBonusPercent(packs)).toEqual({ M: 10, L: 20 });
  });

  it('no inventa bonus si todos rinden igual o hay un solo paquete', () => {
    expect(packBonusPercent([pack('A', 100, 1), pack('B', 500, 5)])).toEqual({});
    expect(packBonusPercent([pack('A', 100, 1)])).toEqual({});
  });
});

describe('packEquivalent', () => {
  const shop = [...allPlans, item('BOOST', 50), item('UNDO_PASS', 20)];

  it('dice el plan más alto que alcanza', () => {
    const eq = packEquivalent(500, shop);
    expect(eq?.kind === 'plan' && eq.plan.tier).toBe('VIP');
  });

  it('si no alcanza un plan, cuenta usos del poder más barato', () => {
    expect(packEquivalent(100, shop)).toMatchObject({ kind: 'power', count: 5, item: { key: 'UNDO_PASS' } });
  });

  it('null si no alcanza para nada', () => {
    expect(packEquivalent(10, shop)).toBeNull();
  });
});

describe('packForShortfall', () => {
  it('elige el paquete más chico que cubre lo que falta', () => {
    expect(packForShortfall(packs, 120)?.key).toBe('M');
    expect(packForShortfall(packs, 100)?.key).toBe('S');
  });

  it('null si no falta nada o ninguno alcanza', () => {
    expect(packForShortfall(packs, 0)).toBeNull();
    expect(packForShortfall(packs, 5000)).toBeNull();
  });
});

describe('planEndDate', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  const gold = PLANS.find((p) => p.tier === 'VIP')!;

  it('plan nuevo: vence a los N días desde hoy', () => {
    expect(planEndDate(gold, 'STANDARD', null, now).toISOString()).toBe('2026-11-13T12:00:00.000Z');
  });

  it('renovación: suma días al vencimiento vigente', () => {
    expect(planEndDate(gold, 'VIP', '2026-10-20T12:00:00Z', now).toISOString()).toBe('2026-11-19T12:00:00.000Z');
  });

  it('renovación vencida: cuenta desde hoy', () => {
    expect(planEndDate(gold, 'VIP', '2026-10-01T12:00:00Z', now).toISOString()).toBe('2026-11-13T12:00:00.000Z');
  });
});

describe('includedFrom', () => {
  it('lee de la tabla desde qué plan viene incluido cada poder', () => {
    expect(includedFrom('BOOST')).toEqual({ tier: 'PREMIUM', value: '1 por semana' });
    expect(includedFrom('UNDO_PASS')?.tier).toBe('VIP');
    expect(includedFrom('EXTRA_PROFILES')).toBeNull();
  });

  it('cada comparisonRow apunta a una fila que existe', () => {
    const labels = new Set(COMPARISON_ROWS.map((r) => r.label));
    for (const p of Object.values(POWER_PRESENTATION)) {
      if (p.comparisonRow) expect(labels).toContain(p.comparisonRow);
    }
  });
});
