export type Gender = 'WOMAN' | 'MAN' | 'NON_BINARY' | 'OTHER';
export type LookingFor = 'RELATIONSHIP' | 'CASUAL' | 'FRIENDSHIP' | 'UNSURE';
export type VerificationLevel = 'NONE' | 'EMAIL' | 'PHONE' | 'PHOTO' | 'VERIFIED';
export type MembershipTier = 'STANDARD' | 'PREMIUM' | 'FOUNDING' | 'VIP';
export type ConnectionStatus =
  | 'MATCH'
  | 'TALKING'
  | 'PROPOSAL'
  | 'DATE_AGREED'
  | 'DATE_VERIFIED'
  | 'SECOND_DATE'
  | 'INACTIVE';
export type PlanType = 'COFFEE' | 'FOOD' | 'BAR' | 'CINEMA' | 'ACTIVITY' | 'CHILL' | 'OTHER';
export type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'COUNTERED' | 'DECLINED' | 'EXPIRED';
export type DateMeetStatus = 'AGREED' | 'CANCELLED' | 'CHECKED_IN' | 'VERIFIED' | 'NO_SHOW';
export type CancelReason = 'SOMETHING_CAME_UP' | 'CHANGED_MIND' | 'NOT_COMFORTABLE' | 'OTHER';
export type MessageType = 'TEXT' | 'SYSTEM' | 'IMAGE';

export interface Prompt {
  id: string;
  question: string;
  answer: string;
}

export interface Photo {
  id: string;
  url: string;
  isPrimary: boolean;
}

export interface Membership {
  tier: MembershipTier;
  tierLabel: string;
  expiresAt: string | null;
}

export interface AudioBio {
  url: string;
  durationSec: number | null;
}

export interface BlindPrompt {
  teaser: string | null;
  philosophy: string | null;
  idealDate: string | null;
}

/** Perfil público — lo que devuelve el backend de cualquier otro usuario. */
export interface Profile {
  id: string;
  displayName: string;
  age: number;
  gender: Gender;
  genderLabel: string;
  lookingFor: LookingFor;
  lookingForLabel: string;
  bio: string | null;
  city: string | null;
  zone: string | null;
  distance: string | null;
  photos: Photo[];
  interests: { id: string; slug: string; name: string }[];
  badges: {
    verified: boolean;
    verification: VerificationLevel;
    verificationLabel: string;
    trusted: boolean;
  };
  lastActive: string | null;
  membership: Membership;
  prompts: Prompt[];
  audioBio: AudioBio | null;
  blindPrompt: BlindPrompt | null;
}

/** Mi propio perfil — extiende Profile con datos privados (GET /me). */
export interface MeProfile extends Profile {
  email: string;
  phone: string | null;
  dateOfBirth: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';
  role: 'USER' | 'ADMIN';
  notificationPrefs: Record<string, boolean>;
  seeking: Gender[];
  maxDistanceKm: number;
  minAge: number;
  maxAge: number;
  job: string | null;
  studies: string | null;
  onboardingCompleted: boolean;
  hasLocation: boolean;
  lastActiveAt: string | null;
  boostedUntil: string | null;
  likesUnlockedUntil: string | null;
}

export interface Match {
  id: string;
  status: ConnectionStatus;
  label: string;
  matchedAt: string;
  lastMessageAt: string | null;
  expiresAt: string | null;
  unread: number;
  verifiedDateCount: number;
  other: Profile;
}

export interface MessageReplyPreview {
  id: string;
  body: string;
  type: MessageType;
  senderId: string;
  imageUrl: string | null;
}

export interface Message {
  id: string;
  connectionId: string;
  senderId: string;
  type: MessageType;
  body: string;
  imageUrl: string | null;
  replyToId: string | null;
  replyTo: MessageReplyPreview | null;
  createdAt: string;
  readAt: string | null;
}

export interface ChatThread {
  id: string; // connectionId
  partner: Profile;
  status: ConnectionStatus;
  statusLabel: string;
  lastMessageAt: string | null;
  unread: number;
  messages: Message[];
}

export interface DateProposal {
  id: string;
  connectionId: string;
  proposerId: string;
  scheduledAt: string | null;
  zone: string;
  planType: PlanType;
  note: string | null;
  status: ProposalStatus;
  createdAt: string;
}

export interface DateMeet {
  id: string;
  connectionId: string;
  proposalId: string;
  scheduledAt: string | null;
  zone: string;
  planType: PlanType;
  status: DateMeetStatus;
  checkedInAt: string | null;
  verifiedAt: string | null;
}

export interface LedgerEntry {
  id: string;
  amount: number;
  direction: 'CREDIT' | 'DEBIT';
  source: 'EARNED' | 'PURCHASED' | 'ADJUSTMENT' | 'SPENT';
  reason: string;
  createdAt: string;
}

export interface PerkItemStatus {
  itemKey: string;
  unlimited: boolean;
  limit: number | null;
  periodDays: number | null;
  remaining: number | null;
  resetsAt: string | null;
}

export interface PerkStatus {
  tier: MembershipTier;
  dateRewardMultiplier: number;
  items: PerkItemStatus[];
}

export interface ShopItem {
  key: string;
  name: string;
  description: string;
  price: number;
  priceUsd: number | null;
}

export interface CoinPack {
  key: string;
  coins: number;
  label: string;
  priceUsd: number;
}

export interface Stamp {
  key: string;
  title: string;
  description: string;
  iconName: string;
  color: 'secondary' | 'primary' | 'tertiary' | 'sage';
  unlocked: boolean;
  unlockedAt: string | null;
  location: string | null;
  partnerName: string | null;
  notes: string | null;
}

export interface DiscoveryFilters {
  minAge: number;
  maxAge: number;
  maxDistanceKm: number;
  selectedInterests: string[];
  onlyVerifiedMembers: boolean;
  withAudioBioOnly: boolean;
  selectedCity: string;
}

export interface UserSettings {
  theme?: ThemeMode;
  twoFactorEnabled: boolean;
  incognitoMode: boolean;
  biometricLock: boolean;
  notifyDateProposals: boolean;
  notifyNewMessages: boolean;
}

export interface IcebreakerQuestion {
  id: string;
  category: 'profunda' | 'divertida' | 'citas' | 'dilemas';
  question: string;
  context: string;
  options?: string[];
}

export interface VerifiedSpot {
  id: string;
  name: string;
  category: 'cafe' | 'wine' | 'cocktail' | 'books' | 'park' | 'culture';
  neighborhood: string;
  city: string;
  address: string;
  rating: number;
  melyPerk: string;
  image: string;
  vibe: string;
  averagePrice: string;
  specialStampTitle: string;
  recommendedTime: string;
}

export type ThemeMode = 'dark' | 'light';
export type TabType = 'descubrir' | 'likes' | 'matches' | 'mensajes' | 'tienda' | 'citas' | 'perfil' | 'ajustes';
export type AuthScreenType = 'login' | 'register' | 'forgot_password';
