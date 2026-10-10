import { describe, expect, it } from 'vitest';
import type { Match } from '../types';
import { matchesToNudge } from './OutOfProfilesView';

const match = (id: string, matchedAt: string, lastMessageAt: string | null) =>
  ({ id, matchedAt, lastMessageAt }) as Match;

describe('matchesToNudge', () => {
  it('sugiere primero los matches sin charla, y dentro de cada grupo los más nuevos', () => {
    const ordered = matchesToNudge([
      match('charla-vieja', '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z'),
      match('sin-charla-vieja', '2026-10-01T00:00:00Z', null),
      match('sin-charla-nueva', '2026-10-09T00:00:00Z', null),
      match('charla-nueva', '2026-10-08T00:00:00Z', '2026-10-09T00:00:00Z'),
    ]);
    expect(ordered.map((m) => m.id)).toEqual(['sin-charla-nueva', 'sin-charla-vieja', 'charla-nueva', 'charla-vieja']);
  });
});
