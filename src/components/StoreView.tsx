import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { sounds } from '../utils/audio';
import { useAuth } from '../context/AuthContext';
import { usePerks, useShop, usePurchase } from '../hooks/useShop';
import { useClaimDailyBonus, useCoinPacks, useRecharge, useRedeemCode, useWallet, useWalletHistory } from '../hooks/useWallet';
import { useWhoLikedMe } from '../hooks/useDiscover';
import type { CoinPack, ShopItem } from '../types';
import { Skeleton } from './ui/skeleton';
import { ErrorState } from './StateViews';
import { cn } from '../lib/utils';
import { isMembershipItem, minutesLeft, packForShortfall, perkLabel, planForKey } from './store/storeCatalog';
import { type StoreTabId, trackStore } from './store/storeAnalytics';
import { Icon, tone } from './store/storeUi';
import { CurrentPlanPanel } from './store/CurrentPlanPanel';
import { PlansSection } from './store/PlansSection';
import { PowersSection } from './store/PowersSection';
import { type CoinTarget, CoinsSection } from './store/CoinsSection';
import { PurchaseDialog, type Receipt, ReceiptDialog } from './store/PurchaseDialogs';

/*
 * Tienda FINDY — de arriba hacia abajo responde, en este orden:
 *   1. qué tengo hoy (CurrentPlanPanel),
 *   2. qué me conviene después y por qué (Planes: próximo paso + comparación),
 *   3. qué puedo comprar suelto (Poderes) y cómo consigo coins (Coins).
 * Cada compra termina en un "y ahora usalo" (recibo con destino), y quedarse
 * sin coins no corta la compra: se recarga y se retoma.
 * Nada bloquea Descubrir/Matches/Chats: la tienda solo se ve si entrás.
 */

/** Cada pestaña es una decisión distinta; la línea dice qué resuelve antes de entrar. */
const STORE_TABS: { id: StoreTabId; label: string; icon: string; promise: string }[] = [
  { id: 'planes', label: 'Planes', icon: 'workspace_premium', promise: 'Más alcance por días, sin renovación automática.' },
  { id: 'poderes', label: 'Poderes', icon: 'bolt', promise: 'Un empujón puntual, solo cuando lo necesitás.' },
  { id: 'coins', label: 'Coins', icon: 'monetization_on', promise: 'Tu saldo: recargá, ganá gratis o canjeá un código.' },
];
type StoreTab = StoreTabId;

/** Adónde ir a usar lo que se acaba de comprar. */
const USE_IT_IN: Record<string, 'likes' | 'discover'> = {
  LIKES_UNLOCK: 'likes',
  BOOST: 'discover',
  EXTRA_PROFILES: 'discover',
  UNDO_PASS: 'discover',
};

const tabContentVariants = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
} satisfies Variants;

interface StoreViewProps {
  onOpenLikes?: () => void;
  onOpenDiscover?: () => void;
}

export const StoreView: React.FC<StoreViewProps> = ({ onOpenLikes, onOpenDiscover }) => {
  const { user, refreshUser } = useAuth();
  const shopQuery = useShop();
  const shopItems = shopQuery.data ?? [];
  const walletQuery = useWallet();
  const wallet = walletQuery.data;
  const historyQuery = useWalletHistory();
  const packsQuery = useCoinPacks();
  const coinPacks = packsQuery.data ?? [];
  const { data: whoLikedMe } = useWhoLikedMe();
  const { data: perks } = usePerks();
  const purchase = usePurchase();
  const recharge = useRecharge();
  const redeemCode = useRedeemCode();
  const claimDailyBonus = useClaimDailyBonus();

  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StoreTab>('planes');
  const [coinTarget, setCoinTarget] = useState<CoinTarget | null>(null);
  const [rechargingKey, setRechargingKey] = useState<string | null>(null);
  const tabRefs = useRef<Partial<Record<StoreTab, HTMLButtonElement | null>>>({});

  const walletBalance = wallet?.balance ?? 0;
  const membershipTier = user?.membership.tier ?? 'STANDARD';
  // El Black "para siempre" de antes no vence: no hay nada que renovar.
  const currentIsLifetime = membershipTier !== 'STANDARD' && !user?.membership.expiresAt;
  const perkFor = (itemKey: string) => perks?.items.find((p) => p.itemKey === itemKey);
  const selectedIncluded = selectedItem ? perkLabel(perkFor(selectedItem.key)) !== null : false;

  const memberships = shopItems.filter(isMembershipItem);
  const powers = shopItems.filter((i) => !isMembershipItem(i));
  const activeTabMeta = STORE_TABS.find((t) => t.id === activeTab)!;

  // Una vista por montaje, cuando ya sabemos el saldo real.
  const viewTracked = useRef(false);
  useEffect(() => {
    if (viewTracked.current || !wallet) return;
    viewTracked.current = true;
    trackStore({ name: 'store_viewed', tier: membershipTier, balance: wallet.balance });
  }, [wallet, membershipTier]);

  const celebrate = () => {
    try {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#ec4d86', '#ff6b9e', '#ffa3c4', '#d9b45c', '#ffffff'] });
    } catch {
      // safe fallback
    }
  };

  const selectItem = (item: ShopItem, source: 'featured' | 'card' | 'power' = 'power') => {
    sounds.playClick();
    setPurchaseError(null);
    setSelectedItem(item);
    trackStore({ name: 'store_item_selected', itemKey: item.key, price: item.price, affordable: walletBalance >= item.price, source });
  };

  const changeTab = (tab: StoreTab) => {
    if (tab === activeTab) return;
    sounds.playClick();
    setActiveTab(tab);
    trackStore({ name: 'store_tab_changed', tab });
  };

  // Patrón de tabs WAI-ARIA: flechas / Inicio / Fin mueven foco y selección.
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const idx = STORE_TABS.findIndex((t) => t.id === activeTab);
    const nextIdx =
      e.key === 'ArrowRight'
        ? (idx + 1) % STORE_TABS.length
        : e.key === 'ArrowLeft'
          ? (idx - 1 + STORE_TABS.length) % STORE_TABS.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? STORE_TABS.length - 1
              : -1;
    if (nextIdx < 0) return;
    e.preventDefault();
    const next = STORE_TABS[nextIdx].id;
    changeTab(next);
    tabRefs.current[next]?.focus();
  };

  const closeReceiptAnd = (go?: () => void) => () => {
    setReceipt(null);
    go?.();
  };

  const purchaseReceipt = (item: ShopItem, includedInPlan: boolean): Receipt => {
    const plan = planForKey(item.key);
    const destination = plan ? 'discover' : USE_IT_IN[item.key];
    const action =
      destination === 'likes' && onOpenLikes
        ? { label: 'Ver quién te dio like', icon: 'favorite', onClick: closeReceiptAnd(onOpenLikes) }
        : destination === 'discover' && onOpenDiscover
          ? { label: 'Ir a Descubrir', icon: 'arrow_forward', onClick: closeReceiptAnd(onOpenDiscover) }
          : undefined;
    return {
      title: includedInPlan ? `${item.name} · incluido en tu plan` : plan ? `${item.name} activo por ${plan.durationDays} días` : item.name,
      detail: plan ? 'Ya está activo en tu cuenta. Lo ves en "Tu plan", arriba.' : 'Ya está disponible en tu cuenta.',
      action,
    };
  };

  const handleConfirmPurchase = () => {
    if (!selectedItem) return;
    setPurchaseError(null);
    sounds.playCoins();
    const item = selectedItem;
    trackStore({ name: 'store_purchase_confirmed', itemKey: item.key, price: item.price, includedInPlan: selectedIncluded });
    purchase.mutate(
      { itemKey: item.key },
      {
        onSuccess: (res) => {
          celebrate();
          trackStore({ name: 'store_purchase_succeeded', itemKey: item.key, price: item.price, includedInPlan: res.includedInPlan });
          setReceipt(purchaseReceipt(item, res.includedInPlan));
          setSelectedItem(null);
          setCoinTarget(null);
          // usePurchase invalida react-query, pero AuthContext.user (plan, boost,
          // likes desbloqueados) vive aparte y necesita su propio refresh.
          refreshUser();
        },
        onError: (err: any) => {
          const message = err?.message ?? 'No se pudo completar la compra';
          setPurchaseError(message);
          trackStore({ name: 'store_purchase_failed', itemKey: item.key, message });
        },
      },
    );
  };

  const handleRecharge = (pack: CoinPack) => {
    sounds.playCoins();
    setRechargingKey(pack.key);
    trackStore({ name: 'store_pack_selected', packKey: pack.key, coins: pack.coins, recommended: coinTarget?.packKey === pack.key });
    recharge.mutate(pack.key, {
      onSuccess: (res) => {
        celebrate();
        trackStore({ name: 'store_recharge_succeeded', packKey: pack.key, coins: res.amount });
        // Si veníamos de "te faltan coins" y ahora alcanza, la compra se retoma en un toque.
        const resume = coinTarget && res.balance >= coinTarget.item.price ? coinTarget.item : null;
        if (resume) setCoinTarget(null);
        else if (coinTarget) {
          const shortfall = coinTarget.item.price - res.balance;
          setCoinTarget({ ...coinTarget, shortfall, packKey: packForShortfall(coinPacks, shortfall)?.key ?? null });
        }
        setReceipt({
          title: `+${res.amount.toLocaleString('es-AR')} Findy Coins`,
          detail: `Modo demo: no se cobró dinero real. Saldo: ${res.balance.toLocaleString('es-AR')} coins.`,
          action: resume
            ? {
                label: `Continuar con ${resume.name}`,
                icon: 'arrow_forward',
                onClick: closeReceiptAnd(() => {
                  trackStore({ name: 'store_resume_after_recharge', itemKey: resume.key });
                  changeTab(isMembershipItem(resume) ? 'planes' : 'poderes');
                  selectItem(resume);
                }),
              }
            : undefined,
        });
      },
      onError: (err: any) => toast.error(err?.message ?? 'No se pudo recargar'),
      onSettled: () => setRechargingKey(null),
    });
  };

  const handleClaimDailyBonus = () => {
    if (claimDailyBonus.isPending) return;
    sounds.playCoins();
    claimDailyBonus.mutate(undefined, {
      onSuccess: (res) => {
        celebrate();
        trackStore({ name: 'store_daily_bonus_claimed', amount: res.amount });
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
        trackStore({ name: 'store_promo_redeemed', amount: res.amount });
        toast.success(`¡Código canjeado! +${res.amount} Findy Coins.`);
        setPromoCode('');
        celebrate();
      },
      onError: (err: any) => toast.error(err?.message ?? 'Código inválido'),
    });
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-8 pb-12 animate-fadeIn w-full">
      <CurrentPlanPanel
        user={user}
        balance={walletBalance}
        balanceLoading={walletQuery.isLoading}
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
          <Skeleton className="h-11 w-full lg:max-w-[480px] rounded-[var(--radius-pill)]" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-[420px] w-full rounded-[var(--radius-lg)]" />
            <Skeleton className="hidden lg:block h-[420px] w-full rounded-[var(--radius-lg)]" />
            <Skeleton className="hidden lg:block h-[420px] w-full rounded-[var(--radius-lg)]" />
          </div>
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
            className="sticky z-20 -mx-1 px-1 py-1 flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-5"
            style={{ top: 'calc(4.5rem + env(safe-area-inset-top))' }}
          >
            <div
              role="tablist"
              aria-label="Secciones de la tienda"
              className="flex items-center gap-1 p-1 w-full lg:w-[480px] lg:shrink-0 rounded-[var(--radius-pill)] border bg-white/90 border-[var(--coral-100)] dark:bg-[var(--midnight-850)]/90 dark:border-[var(--hairline)] backdrop-blur-sm shadow-elevation-sm"
            >
              {STORE_TABS.map((tab) => {
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(node) => {
                      tabRefs.current[tab.id] = node;
                    }}
                    id={`store-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls="store-tabpanel"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => changeTab(tab.id)}
                    onKeyDown={handleTabKeyDown}
                    className={cn(
                      'flex-1 h-10 rounded-[var(--radius-pill)] text-[13px] font-bold flex items-center justify-center gap-1.5 transition-colors',
                      selected
                        ? 'bg-gradient-to-r from-[var(--coral-600)] to-[var(--coral-500)] text-white shadow-elevation-sm'
                        : cn(tone.muted, 'hover:text-[var(--coral-600)] dark:hover:text-[var(--coral-300)]'),
                    )}
                  >
                    <Icon name={tab.icon} filled={selected} className="text-[17px]" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <p className={cn('hidden lg:block text-[13px]', tone.muted)}>{activeTabMeta.promise}</p>
          </div>
          <p className={cn('lg:hidden -mt-3 px-1 text-[12.5px] text-center', tone.muted)}>{activeTabMeta.promise}</p>

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
                    balance={walletBalance}
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
                    currentTier={membershipTier}
                    perkFor={perkFor}
                    boostMinutesLeft={minutesLeft(user?.boostedUntil ?? null)}
                    likesUnlockMinutesLeft={minutesLeft(user?.likesUnlockedUntil ?? null)}
                    likesIncludedInPlan={membershipTier !== 'STANDARD'}
                    onSelect={(item) => selectItem(item, 'power')}
                    onSeePlans={() => changeTab('planes')}
                  />
                ) : (
                  <p className={cn('rounded-[var(--radius-md)] p-5 text-[13px] text-center', tone.sunken, tone.muted)}>
                    No hay poderes disponibles en este momento.
                  </p>
                ))}

              {activeTab === 'coins' && (
                <CoinsSection
                  packs={coinPacks}
                  packsLoading={packsQuery.isLoading}
                  packsError={packsQuery.isError}
                  onRetryPacks={() => packsQuery.refetch()}
                  history={historyQuery.data?.entries ?? []}
                  historyLoading={historyQuery.isLoading}
                  shopItems={shopItems}
                  target={coinTarget}
                  onClearTarget={() => setCoinTarget(null)}
                  rechargingKey={rechargingKey}
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
        currentExpiresAt={user?.membership.expiresAt ?? null}
        balance={walletBalance}
        includedInPlan={selectedIncluded}
        pending={purchase.isPending}
        error={purchaseError}
        onConfirm={handleConfirmPurchase}
        onClose={() => {
          if (selectedItem && !purchase.isPending) trackStore({ name: 'store_purchase_cancelled', itemKey: selectedItem.key });
          setSelectedItem(null);
        }}
        onGetCoins={() => {
          if (!selectedItem) return;
          const shortfall = Math.max(0, selectedItem.price - walletBalance);
          trackStore({ name: 'store_insufficient_coins', itemKey: selectedItem.key, shortfall });
          setCoinTarget({ item: selectedItem, shortfall, packKey: packForShortfall(coinPacks, shortfall)?.key ?? null });
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
