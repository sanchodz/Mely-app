import React, { useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { sounds } from '../utils/audio';
import { useAuth } from '../context/AuthContext';
import { usePerks, useShop, usePurchase } from '../hooks/useShop';
import { useClaimDailyBonus, useCoinPacks, useRecharge, useRedeemCode, useWallet, useWalletHistory } from '../hooks/useWallet';
import { useWhoLikedMe } from '../hooks/useDiscover';
import type { ShopItem } from '../types';
import { Skeleton } from './ui/skeleton';
import { ErrorState } from './StateViews';
import { cn } from '../lib/utils';
import { isMembershipItem, minutesLeft, perkLabel, planForKey, powerRedundantForTier } from './store/storeCatalog';
import { Icon, tone } from './store/storeUi';
import { CurrentPlanPanel } from './store/CurrentPlanPanel';
import { PlansSection } from './store/PlansSection';
import { PowersSection } from './store/PowersSection';
import { CoinsSection } from './store/CoinsSection';
import { PurchaseDialog, ReceiptDialog } from './store/PurchaseDialogs';

/*
 * Tienda FINDY — de arriba hacia abajo responde, en este orden:
 *   1. qué tengo hoy (CurrentPlanPanel),
 *   2. qué me conviene después y por qué (Planes: próximo paso + comparación),
 *   3. qué puedo comprar suelto (Poderes) y cómo consigo coins (Coins).
 * Nada bloquea Descubrir/Matches/Chats: la tienda solo se ve si entrás.
 */

const STORE_TABS = [
  { id: 'planes', label: 'Planes', icon: 'workspace_premium' },
  { id: 'poderes', label: 'Poderes', icon: 'bolt' },
  { id: 'coins', label: 'Coins', icon: 'monetization_on' },
] as const;
type StoreTab = (typeof STORE_TABS)[number]['id'];

const tabContentVariants = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
} satisfies Variants;

interface StoreViewProps {
  onOpenLikes?: () => void;
}

export const StoreView: React.FC<StoreViewProps> = ({ onOpenLikes }) => {
  const { user, refreshUser } = useAuth();
  const shopQuery = useShop();
  const shopItems = shopQuery.data ?? [];
  const { data: wallet } = useWallet();
  const { data: history } = useWalletHistory();
  const { data: coinPacks = [] } = useCoinPacks();
  const { data: whoLikedMe } = useWhoLikedMe();
  const { data: perks } = usePerks();
  const purchase = usePurchase();
  const recharge = useRecharge();
  const redeemCode = useRedeemCode();
  const claimDailyBonus = useClaimDailyBonus();

  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StoreTab>('planes');

  const walletBalance = wallet?.balance ?? 0;
  const membershipTier = user?.membership.tier ?? 'STANDARD';
  // El Black "para siempre" de antes no vence: no hay nada que renovar.
  const currentIsLifetime = membershipTier !== 'STANDARD' && !user?.membership.expiresAt;
  const perkFor = (itemKey: string) => perks?.items.find((p) => p.itemKey === itemKey);
  const selectedIncluded = selectedItem ? perkLabel(perkFor(selectedItem.key)) !== null : false;

  const memberships = shopItems.filter(isMembershipItem);
  const powers = shopItems.filter((i) => !isMembershipItem(i) && !powerRedundantForTier(i.key, membershipTier));

  const celebrate = () => {
    try {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#ec4d86', '#ff6b9e', '#ffa3c4', '#d9b45c', '#ffffff'] });
    } catch {
      // safe fallback
    }
  };

  const selectItem = (item: ShopItem) => {
    sounds.playClick();
    setPurchaseError(null);
    setSelectedItem(item);
  };

  const changeTab = (tab: StoreTab) => {
    sounds.playClick();
    setActiveTab(tab);
  };

  const handleConfirmPurchase = () => {
    if (!selectedItem) return;
    setPurchaseError(null);
    sounds.playCoins();
    purchase.mutate(
      { itemKey: selectedItem.key },
      {
        onSuccess: (res) => {
          celebrate();
          const plan = planForKey(selectedItem.key);
          setReceipt(
            res.includedInPlan
              ? `${selectedItem.name} · incluido en tu plan`
              : plan
                ? `${selectedItem.name} activo por ${plan.durationDays} días`
                : selectedItem.name,
          );
          setSelectedItem(null);
          // usePurchase invalida react-query, pero AuthContext.user (plan, boost,
          // likes desbloqueados) vive aparte y necesita su propio refresh.
          refreshUser();
        },
        onError: (err: any) => setPurchaseError(err?.message ?? 'No se pudo completar la compra'),
      },
    );
  };

  const handleRecharge = (packKey: string) => {
    sounds.playCoins();
    recharge.mutate(packKey, {
      onSuccess: (res) => {
        celebrate();
        setReceipt(`+${res.amount} Findy Coins (demo)`);
      },
      onError: (err: any) => toast.error(err?.message ?? 'No se pudo recargar'),
    });
  };

  const handleClaimDailyBonus = () => {
    if (claimDailyBonus.isPending) return;
    sounds.playCoins();
    claimDailyBonus.mutate(undefined, {
      onSuccess: (res) => {
        celebrate();
        toast.success(`¡Bono diario reclamado! +${res.amount} Findy Coins.`);
      },
      onError: (err: any) => toast.error(err?.message ?? 'No se pudo reclamar el bono'),
    });
  };

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    sounds.playClick();
    redeemCode.mutate(promoCode.trim(), {
      onSuccess: (res) => {
        toast.success(`¡Código canjeado! +${res.amount} Findy Coins.`);
        setPromoCode('');
        celebrate();
      },
      onError: (err: any) => toast.error(err?.message ?? 'Código inválido'),
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-12 animate-fadeIn w-full">
      <CurrentPlanPanel
        user={user}
        balance={walletBalance}
        perks={perks}
        shopItems={shopItems}
        dailyBonusAvailable={Boolean(wallet?.dailyBonusAvailable)}
        claimingBonus={claimDailyBonus.isPending}
        onClaimBonus={handleClaimDailyBonus}
      />

      {whoLikedMe && whoLikedMe.count > 0 && (
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onOpenLikes?.();
          }}
          className={cn(
            'flex items-center gap-3 rounded-[var(--radius-md)] border p-3.5 text-left transition-transform active:scale-[0.98]',
            tone.surface,
          )}
        >
          <span className="w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--coral-600)] to-[var(--coral-500)] flex items-center justify-center text-white shrink-0">
            <Icon name="favorite" filled className="text-[20px]" />
          </span>
          <span className="flex-1 min-w-0">
            <span className={cn('block text-[14px] font-bold', tone.strong)}>
              {whoLikedMe.count} {whoLikedMe.count === 1 ? 'persona te dio like' : 'personas te dieron like'}
            </span>
            <span className={cn('block text-[12.5px]', tone.muted)}>
              {whoLikedMe.unlocked ? 'Tocá para verlas y responder' : 'Tocá para ver quiénes son'}
            </span>
          </span>
          <Icon name="chevron_right" className={cn('text-[22px] shrink-0', tone.accent)} />
        </button>
      )}

      {/* Error/carga solo sin datos: un refetch fallido no debe tapar una tienda ya cargada. */}
      {shopQuery.isLoading ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando la tienda">
          <Skeleton className="h-11 w-full rounded-[var(--radius-pill)]" />
          <Skeleton className="h-[340px] w-full rounded-[var(--radius-lg)]" />
          <Skeleton className="h-40 w-full rounded-[var(--radius-lg)]" />
        </div>
      ) : shopQuery.isError && shopItems.length === 0 ? (
        <ErrorState
          title="No pudimos cargar la tienda"
          body="Tu saldo y tu plan siguen intactos. Revisá la conexión y probá de nuevo."
          onRetry={() => shopQuery.refetch()}
        />
      ) : (
        <>
          {/* Planes / poderes / coins son decisiones distintas: cada una en su pestaña. */}
          <div
            role="tablist"
            aria-label="Secciones de la tienda"
            className="sticky z-20 flex items-center gap-1 p-1 rounded-[var(--radius-pill)] border bg-white/90 border-[var(--coral-100)] dark:bg-[var(--midnight-850)]/90 dark:border-[var(--hairline)] backdrop-blur-sm"
            style={{ top: 'calc(4.5rem + env(safe-area-inset-top))' }}
          >
            {STORE_TABS.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`store-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="store-tabpanel"
                  onClick={() => changeTab(tab.id)}
                  className={cn(
                    'flex-1 h-10 rounded-[var(--radius-pill)] text-[13px] font-bold flex items-center justify-center gap-1.5 transition-colors',
                    selected ? 'bg-gradient-to-r from-[var(--coral-600)] to-[var(--coral-500)] text-white shadow-elevation-sm' : tone.muted,
                  )}
                >
                  <Icon name={tab.icon} filled={selected} className="text-[17px]" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              id="store-tabpanel"
              role="tabpanel"
              aria-labelledby={`store-tab-${activeTab}`}
              variants={tabContentVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'planes' &&
                (memberships.length > 0 ? (
                  <PlansSection
                    items={memberships}
                    currentTier={membershipTier}
                    currentIsLifetime={currentIsLifetime}
                    onSelect={selectItem}
                  />
                ) : (
                  <p className={cn('rounded-[var(--radius-md)] p-5 text-[13px] text-center', tone.sunken, tone.muted)}>
                    No hay planes disponibles en este momento.
                  </p>
                ))}

              {activeTab === 'poderes' &&
                (powers.length > 0 ? (
                  <PowersSection
                    items={powers}
                    perkFor={perkFor}
                    boostMinutesLeft={minutesLeft(user?.boostedUntil ?? null)}
                    likesUnlockMinutesLeft={minutesLeft(user?.likesUnlockedUntil ?? null)}
                    likesIncludedInPlan={membershipTier !== 'STANDARD'}
                    onSelect={selectItem}
                  />
                ) : (
                  <p className={cn('rounded-[var(--radius-md)] p-5 text-[13px] text-center', tone.sunken, tone.muted)}>
                    No hay poderes disponibles en este momento.
                  </p>
                ))}

              {activeTab === 'coins' && (
                <CoinsSection
                  packs={coinPacks}
                  history={history?.entries ?? []}
                  shopItems={shopItems}
                  recharging={recharge.isPending}
                  onRecharge={handleRecharge}
                  promoCode={promoCode}
                  onPromoCodeChange={setPromoCode}
                  redeeming={redeemCode.isPending}
                  onRedeem={handleRedeem}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}

      <PurchaseDialog
        item={selectedItem}
        currentTier={membershipTier}
        balance={walletBalance}
        includedInPlan={selectedIncluded}
        pending={purchase.isPending}
        error={purchaseError}
        onConfirm={handleConfirmPurchase}
        onClose={() => setSelectedItem(null)}
        onGetCoins={() => {
          setSelectedItem(null);
          changeTab('coins');
        }}
      />

      <ReceiptDialog
        receipt={receipt}
        onClose={() => {
          sounds.playClick();
          setReceipt(null);
        }}
      />
    </div>
  );
};
