import { apiRequest } from '../apiClient';
import type { Profile } from '../../types';

export type DiscoverQuota = {
  used: number;
  bonus: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  /** Gold y Black: sin tope diario (limit/remaining son de relleno para apps viejas). */
  unlimited?: boolean;
  /** PASS seguidos desde el último like. */
  passStreak?: number;
  /** Pases seguidos permitidos antes de exigir un like (0 = sin regla). */
  maxConsecutivePasses?: number;
  likeRequired?: boolean;
};

export type SwipeResult = {
  action: 'LIKE' | 'PASS' | 'SUPER_INVITE';
  match: { id: string; status: string; superInvite: boolean; coinsEarned: number } | null;
  /** Solo en Super Spark: true si salió del cupo del plan en vez de cobrar coins. */
  includedInPlan?: boolean;
};

export function listDiscover(opts: { limit?: number; onlyVerified?: boolean; interests?: string[]; maxDistanceKm?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.onlyVerified) params.set('onlyVerified', 'true');
  if (opts.interests?.length) params.set('interests', opts.interests.join(','));
  // El slider de distancia existía en la UI pero nunca viajaba al server:
  // mismo nombre que la preferencia guardada (/me/preferences) para no inventar contrato.
  if (opts.maxDistanceKm) params.set('maxDistanceKm', String(opts.maxDistanceKm));
  const qs = params.toString();
  return apiRequest<{ quota: DiscoverQuota; profiles: Profile[] }>(`/discover${qs ? `?${qs}` : ''}`);
}

export function getDiscoverQuota() {
  return apiRequest<DiscoverQuota>('/discover/quota');
}

export function getPersonOfTheDay() {
  return apiRequest<{ day: string; person: Profile | null }>('/discover/person-of-the-day');
}

export function like(userId: string) {
  return apiRequest<SwipeResult>(`/discover/like/${userId}`, { method: 'POST' });
}

export function pass(userId: string) {
  return apiRequest<SwipeResult>(`/discover/pass/${userId}`, { method: 'POST' });
}

export function superLike(userId: string) {
  return apiRequest<SwipeResult>(`/discover/super/${userId}`, { method: 'POST' });
}

export type WhoLikedMe = {
  count: number;
  unlocked: boolean;
  profiles: Profile[];
};

export function getWhoLikedMe() {
  return apiRequest<WhoLikedMe>('/discover/likes');
}
