import React, { lazy, Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { recordSentLike } from './utils/sentLikes';
import { DEFAULT_DISCOVERY_FILTERS } from './data/mockData';
import { TabType, DiscoveryFilters, Profile, Match } from './types';
import { TopAppBar } from './components/TopAppBar';
import { BottomNavBar } from './components/BottomNavBar';
import { DiscoverView } from './components/DiscoverView';
import type { GooglePrefill } from './components/LoginView';
import { VerifiedSpotsModal } from './components/VerifiedSpotsModal';
import { DiscoveryFiltersModal } from './components/DiscoveryFiltersModal';
import { ProposeDateModal, StampModal, MenuDrawer } from './components/Modals';
import { MatchCelebrationModal } from './components/MatchCelebrationModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { sounds } from './utils/audio';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';
import { useDiscover, usePersonOfTheDay, useSwipe, useWhoLikedMe } from './hooks/useDiscover';
import { useInterests } from './hooks/useProfile';
import { getIntention, loadIntention, resolveIntentionSlugs, saveIntention } from './utils/intentions';
import { loadDailyMood, saveDailyMood } from './utils/dailyMood';
import { consumeFragment } from './utils/fragmentContext';
import { useMatches } from './hooks/useMatches';
import { useShop } from './hooks/useShop';
import { useWallet } from './hooks/useWallet';
import { useAllDateProposals } from './hooks/useDates';
import { useSendMessage } from './hooks/useChat';
import { useBackHandler } from './hooks/useBackHandler';
import { subscribeUserNotifications } from './lib/realtime';
import { resolveNotificationTarget } from './lib/notificationRouting';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from './lib/apiClient';
import type { Stamp } from './types';

// Todo lo que no hace falta en el primer paint (pantallas fuera de Descubrir, y los
// modales que solo se abren con una acción explícita) se carga bajo demanda: reduce
// bastante el bundle inicial, sobre todo DateQRModal (arrastra qr-scanner + qrcode).
const LikesView = lazy(() => import('./components/LikesView').then((m) => ({ default: m.LikesView })));
const MatchesView = lazy(() => import('./components/MatchesView').then((m) => ({ default: m.MatchesView })));
const MessagesView = lazy(() => import('./components/MessagesView').then((m) => ({ default: m.MessagesView })));
const StoreView = lazy(() => import('./components/StoreView').then((m) => ({ default: m.StoreView })));
const DatesView = lazy(() => import('./components/DatesView').then((m) => ({ default: m.DatesView })));
const ProfileView = lazy(() => import('./components/ProfileView').then((m) => ({ default: m.ProfileView })));
const SettingsView = lazy(() => import('./components/SettingsView').then((m) => ({ default: m.SettingsView })));
const WelcomeView = lazy(() => import('./components/WelcomeView').then((m) => ({ default: m.WelcomeView })));
const LoginView = lazy(() => import('./components/LoginView').then((m) => ({ default: m.LoginView })));
const RegisterView = lazy(() => import('./components/RegisterView').then((m) => ({ default: m.RegisterView })));
const IcebreakerWheelModal = lazy(() =>
  import('./components/IcebreakerWheelModal').then((m) => ({ default: m.IcebreakerWheelModal })),
);
const DateQRModal = lazy(() => import('./components/DateQRModal').then((m) => ({ default: m.DateQRModal })));

const TabFallback: React.FC = () => (
  <div className="w-full flex-1 flex items-center justify-center py-20">
    <span className="material-symbols-outlined text-[32px] text-[#ec4d86] animate-pulse">favorite</span>
  </div>
);

type ProposeModalState = { connectionId: string; partnerName: string; initialNote?: string } | null;
type DateQRModalState = { connectionId: string; partnerName: string; partnerAvatar: string } | null;
type IcebreakerState = { connectionId: string; partnerName: string } | null;

function AppContent() {
  const { isLight } = useTheme();
  const { status, user, logout } = useAuth();
  const queryClient = useQueryClient();
  // Antes el login arrancaba directo en el formulario, sin ningún momento de marca
  // (Main.dc.html define una pantalla de bienvenida hero con headline editorial y 2
  // CTAs antes de llegar ahí). 'welcome' es la pantalla inicial; login/register se
  // acceden desde sus CTAs.
  const [authScreen, setAuthScreen] = useState<'welcome' | 'login' | 'register'>('welcome');
  const [googlePrefill, setGooglePrefill] = useState<GooglePrefill | null>(null);

  const [currentTab, setCurrentTab] = useState<TabType>('descubrir');
  const [previousTab, setPreviousTab] = useState<TabType>('descubrir');
  // Dirección de la transición: entrar a una pantalla secundaria (push desde
  // el menú) desliza desde la derecha; volver, hacia la derecha. Las tabs
  // principales solo funden con una deriva vertical mínima.
  const [navDir, setNavDir] = useState<1 | -1>(1);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [proposeModal, setProposeModal] = useState<ProposeModalState>(null);
  const [selectedStamp, setSelectedStamp] = useState<Stamp | null>(null);
  const [dateQRModal, setDateQRModal] = useState<DateQRModalState>(null);
  const [icebreaker, setIcebreaker] = useState<IcebreakerState>(null);
  const [matchCelebration, setMatchCelebration] = useState<{ profile: Profile; connectionId: string; coinsEarned: number; contextLabel: string | null } | null>(
    null,
  );
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);

  const [discoveryFilters, setDiscoveryFilters] = useState<DiscoveryFilters>(DEFAULT_DISCOVERY_FILTERS);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isVerifiedSpotsOpen, setIsVerifiedSpotsOpen] = useState(false);

  // Pilar 1: la intención manda. Vive en localStorage (semanal, expira cuando el
  // usuario la pausa) y mientras está activa ES el filtro de intereses — se
  // traduce a slugs del catálogo real de /interests, nunca inventados.
  const [intentionId, setIntentionId] = useState<string | null>(() => loadIntention());
  // Ritual diario: el ánimo de hoy (expira solo a la medianoche, ver dailyMood.ts).
  const [dailyMoodId, setDailyMoodId] = useState<string | null>(() => loadDailyMood());
  const handleSelectDailyMood = (id: string | null) => {
    setDailyMoodId(id);
    saveDailyMood(id);
  };
  const interestsQuery = useInterests();

  useEffect(() => {
    if (!intentionId || !interestsQuery.data) return;
    const intention = getIntention(intentionId);
    if (!intention) return;
    const slugs = resolveIntentionSlugs(intention, interestsQuery.data);
    setDiscoveryFilters((prev) => ({ ...prev, selectedInterests: slugs }));
  }, [intentionId, interestsQuery.data]);

  const handleSelectIntention = (id: string | null) => {
    setIntentionId(id);
    saveIntention(id);
    if (!id) {
      setDiscoveryFilters((prev) => ({ ...prev, selectedInterests: [] }));
    }
  };

  // Seed discovery filters from the user's persisted preferences once loaded.
  useEffect(() => {
    if (!user) return;
    setDiscoveryFilters((prev) => ({
      ...prev,
      minAge: user.minAge,
      maxAge: user.maxAge,
      maxDistanceKm: user.maxDistanceKm,
    }));
  }, [user?.minAge, user?.maxAge, user?.maxDistanceKm]);

  const discoverQuery = useDiscover(discoveryFilters);
  // Firma del mazo: lo que define QUÉ perfiles trae el server. Cambiarla
  // reinicia el deck en DiscoverView (ver resetKey).
  const discoverResetKey = [
    discoveryFilters.onlyVerifiedMembers ? 'v1' : 'v0',
    ...discoveryFilters.selectedInterests,
    `d${discoveryFilters.maxDistanceKm}`,
  ].join('|');
  const personOfTheDayQuery = usePersonOfTheDay();
  const swipe = useSwipe();
  const matchesQuery = useMatches();
  const walletQuery = useWallet();
  const whoLikedMeQuery = useWhoLikedMe();
  const shopQuery = useShop();
  const icebreakerSendMessage = useSendMessage(icebreaker?.connectionId ?? '');

  const matches: Match[] = matchesQuery.data ?? [];
  const { items: dateItems } = useAllDateProposals(matches);
  const walletBalance = walletQuery.data?.balance ?? 0;
  const unreadMessagesCount = matches.reduce((sum, m) => sum + m.unread, 0);
  const pendingDatesCount = dateItems.filter(
    (it) => it.dateMeet.status === 'AGREED' || it.dateMeet.status === 'CHECKED_IN',
  ).length;
  // Sólo cuenta como "nuevo" para el badge de la tab si todavía no se desbloqueó la
  // lista — una vez desbloqueada, el usuario ya la vio, así que no tiene sentido
  // seguir mostrando el número en rojo indefinidamente.
  const newLikesCount = whoLikedMeQuery.data && !whoLikedMeQuery.data.unlocked ? whoLikedMeQuery.data.count : 0;
  const likesUnlockPrice = shopQuery.data?.find((i) => i.key === 'LIKES_UNLOCK')?.price ?? 60;

  useEffect(() => {
    if (!(matchesQuery.error instanceof ApiError) || matchesQuery.error.status !== 401) return;
    void logout();
  }, [matchesQuery.error, logout]);

  const activeFiltersCount =
    (discoveryFilters.onlyVerifiedMembers ? 1 : 0) +
    (discoveryFilters.withAudioBioOnly ? 1 : 0) +
    (discoveryFilters.selectedInterests.length > 0 ? 1 : 0) +
    (discoveryFilters.minAge > 20 || discoveryFilters.maxAge < 40 ? 1 : 0) +
    (discoveryFilters.maxDistanceKm < 50 ? 1 : 0);

  const handleTabChange = (tab: TabType) => {
    // Si un input queda enfocado cuando su vista se desmonta, el teclado del celular
    // puede quedar "pegado" en pantalla flotando sobre la pestaña nueva.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (currentTab !== 'ajustes') setPreviousTab(currentTab);
    setNavDir(1);
    // Cada pantalla arranca arriba: sin esto, el scroll de la pestaña
    // anterior se heredaba y la nueva aparecía a mitad de camino.
    window.scrollTo({ top: 0 });
    setCurrentTab(tab);
  };

  const handleBackToPrevious = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setNavDir(-1);
    window.scrollTo({ top: 0 });
    setCurrentTab(previousTab);
  };

  // "Atrás" del sistema: primero cierra lo que esté abierto encima, después sale del
  // chat, después vuelve a Descubrir. Recién desde ahí deja salir de la app.
  useBackHandler(() => {
    if (dateQRModal) { setDateQRModal(null); return true; }
    if (icebreaker) { setIcebreaker(null); return true; }
    if (proposeModal) { setProposeModal(null); return true; }
    if (selectedStamp) { setSelectedStamp(null); return true; }
    if (matchCelebration) { setMatchCelebration(null); return true; }
    if (isFiltersOpen) { setIsFiltersOpen(false); return true; }
    if (isVerifiedSpotsOpen) { setIsVerifiedSpotsOpen(false); return true; }
    if (isMenuOpen) { setIsMenuOpen(false); return true; }
    if (!user) {
      if (authScreen === 'welcome') return false;
      setAuthScreen('welcome');
      return true;
    }
    if (currentTab === 'mensajes' && activeConnectionId) { setActiveConnectionId(null); return true; }
    if (currentTab !== 'descubrir') { handleTabChange('descubrir'); return true; }
    return false;
  });

  // A qué pantalla te lleva tocar una notificación (toast, campanita, o push del SO).
  const handleNotificationNavigate = (category?: string, data?: Record<string, unknown>) => {
    const target = resolveNotificationTarget(category, data);
    if (!target) return;
    if (target.connectionId) setActiveConnectionId(target.connectionId);
    handleTabChange(target.tab);
  };

  // Si el push llegó con la app cerrada, el Service Worker abre una URL con estos
  // query params (no tiene acceso al estado de React) — los leemos una sola vez al
  // arrancar y limpiamos la URL para que no se re-dispare en un refresh.
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as TabType | null;
    if (!tab) return;
    const connectionId = params.get('connectionId');
    if (connectionId) setActiveConnectionId(connectionId);
    handleTabChange(tab);
    window.history.replaceState({}, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Si el push llegó con una pestaña ya abierta, el Service Worker la enfoca y le
  // manda un postMessage en vez de navegar por URL (focus() no cambia la URL).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'notification-navigate') return;
      const target = event.data.target as { tab: TabType; connectionId?: string } | undefined;
      if (!target) return;
      if (target.connectionId) setActiveConnectionId(target.connectionId);
      handleTabChange(target.tab);
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global realtime: refresh matches/dates y avisa con un toast + la campanita cuando
  // llega una notificación (nuevo match, propuesta, check-in, monedas, sello, etc).
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeUserNotifications(user.id, (raw) => {
      const payload = raw as
        | { category?: string; title?: string; body?: string; data?: Record<string, unknown> }
        | null;
      if (payload?.title) {
        const target = resolveNotificationTarget(payload.category, payload.data);
        toast(payload.title, {
          description: payload.body,
          action: target
            ? { label: 'Ver', onClick: () => handleNotificationNavigate(payload.category, payload.data) }
            : undefined,
        });
      }
      if (payload?.category !== 'message') {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['dateMeet'] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['stamps'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, queryClient]);

  const handleLike = (profile: Profile) => {
    sounds.playStamp();
    // Historial local de "Enviados" (el backend no expone a quién le di like).
    recordSentLike({ profileId: profile.id, displayName: profile.displayName, age: profile.age, photoUrl: profile.photos[0]?.url ?? null });
    swipe.like.mutate(profile.id, {
      onSuccess: (res) => {
        if (res.match) {
          sounds.playHeart();
          // Pilar 3: el fragmento que originó el like viaja a la celebración.
          setMatchCelebration({ profile, connectionId: res.match.id, coinsEarned: res.match.coinsEarned, contextLabel: consumeFragment(profile.id) });
        }
      },
    });
  };

  const handlePass = (profile: Profile) => {
    swipe.pass.mutate(profile.id);
  };

  const handleSuperLike = (profile: Profile) => {
    sounds.playCoins();
    recordSentLike({ profileId: profile.id, displayName: profile.displayName, age: profile.age, photoUrl: profile.photos[0]?.url ?? null });
    swipe.superLike.mutate(profile.id, {
      onSuccess: (res) => {
        if (res.match) {
          sounds.playHeart();
          setMatchCelebration({ profile, connectionId: res.match.id, coinsEarned: res.match.coinsEarned, contextLabel: consumeFragment(profile.id) });
        }
      },
      // Super Spark ahora sale del cupo del plan o cuesta coins: si no alcanzan, la
      // tarjeta ya se fue del mazo, así que se recarga Descubrir para que vuelva.
      onError: (err) => {
        discoverQuery.refetch();
        if (err instanceof ApiError && err.code === 'INSUFFICIENT_FUNDS') {
          toast.error('No te alcanzan los coins para un Super Spark', {
            description: 'Recargá en la Tienda, o con Findy Gold tenés 3 por mes incluidos.',
            action: { label: 'Tienda', onClick: () => handleTabChange('tienda') },
          });
        } else {
          toast.error(err instanceof Error ? err.message : 'No se pudo enviar el Super Spark');
        }
      },
    });
  };

  // Contexto de origen por conversación (pilar 3): cuando el chat se abre desde
  // una celebración con fragmento, el chat vacío muestra el punto de partida.
  // Vive en memoria de sesión; desaparece solo al enviar el primer mensaje.
  const [chatContext, setChatContext] = useState<Record<string, string>>({});

  const handleOpenChat = (connectionId: string, contextLabel?: string | null) => {
    if (contextLabel) {
      setChatContext((prev) => ({ ...prev, [connectionId]: contextLabel }));
    }
    setActiveConnectionId(connectionId);
    handleTabChange('mensajes');
  };

  const handleProposeDate = (match: Match) => {
    setProposeModal({ connectionId: match.id, partnerName: match.other.displayName });
  };

  const handleSignOut = () => {
    // Volver a la entrada diseñada (bienvenida), no al último formulario pisado.
    setAuthScreen('welcome');
    setGooglePrefill(null);
    logout();
  };

  // --- AUTH SCREENS ---
  if (status === 'loading') {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <span className="material-symbols-outlined text-[36px] text-[#ec4d86] animate-pulse">favorite</span>
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return (
      <div className={`min-h-dvh bg-transparent ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'} antialiased flex flex-col items-center justify-center selection:bg-[#ec4d86] selection:text-white p-2`}>
        <Suspense fallback={<TabFallback />}>
          {authScreen === 'welcome' ? (
            <WelcomeView onCreateAccount={() => setAuthScreen('register')} onGoToLogin={() => setAuthScreen('login')} />
          ) : authScreen === 'login' ? (
            <LoginView
              onGoToRegister={() => setAuthScreen('register')}
              onGoogleNeedsProfile={(data) => {
                setGooglePrefill(data);
                setAuthScreen('register');
              }}
            />
          ) : (
            <RegisterView
              onGoToLogin={() => {
                setGooglePrefill(null);
                setAuthScreen('login');
              }}
              googlePrefill={googlePrefill}
            />
          )}
        </Suspense>
      </div>
    );
  }

  // --- MAIN APPLICATION ---
  // Igual que WhatsApp/Telegram: adentro de una conversación puntual, el chrome de
  // navegación de la app (header + tab bar) se saca por completo — el chat ya tiene su
  // propio header con botón de volver, y así aprovecha toda la altura de la pantalla.
  const isChatDetail = currentTab === 'mensajes' && Boolean(activeConnectionId);
  // Descubrir / Me gusta / Tienda / Chats / Perfil son las 5 tabs de primer nivel de la
  // bottom nav. Matches, Citas y Ajustes se llegan desde el menú hamburguesa — como son
  // pantallas "secundarias" empujadas desde el menú, llevan header con flecha de volver
  // en vez de la bottom nav.
  const isSecondaryScreen = currentTab === 'ajustes' || currentTab === 'matches' || currentTab === 'citas';

  return (
    <div className={`min-h-dvh bg-transparent ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'} antialiased flex flex-col items-center justify-start selection:bg-[#ec4d86] selection:text-white`}>
      {!isChatDetail && (
        <TopAppBar
          currentTab={currentTab}
          walletBalance={walletBalance}
          onTabChange={handleTabChange}
          onNavigateNotification={handleNotificationNavigate}
          onOpenMenu={() => setIsMenuOpen(true)}
          showBackButton={isSecondaryScreen}
          onBack={handleBackToPrevious}
          customTitle={
            currentTab === 'ajustes'
              ? 'Ajustes'
              : currentTab === 'tienda'
                ? 'Tienda'
                : currentTab === 'mensajes'
                  ? 'Mensajes'
                  : currentTab === 'matches'
                    ? 'Matches'
                    : currentTab === 'likes'
                      ? 'Me gusta'
                      : 'FINDY'
          }
        />
      )}

      <main
        style={{
          paddingTop: isChatDetail ? 'env(safe-area-inset-top)' : `calc(${currentTab === 'mensajes' ? '4rem' : '5rem'} + env(safe-area-inset-top))`,
          // La bottom nav ahora queda pegada al borde inferior (78px + safe-area) en vez de
          // flotar con margen — el padding se ajusta a esa altura real. En las pantallas
          // secundarias (Ajustes/Matches/Citas) la nav no se muestra, así que ahí
          // alcanza con el safe-area, igual que en el detalle de un chat.
          paddingBottom:
            isChatDetail || isSecondaryScreen
              ? 'env(safe-area-inset-bottom)'
              : `calc(5.5rem + env(safe-area-inset-bottom))`,
        }}
        className={`app-page ${currentTab === 'tienda' ? 'app-page--wide' : ''} ${isChatDetail ? '' : currentTab === 'mensajes' ? 'px-2 sm:px-3' : 'px-3 min-[380px]:px-4'} flex-1 flex flex-col min-h-0`}
      >
        {/* popLayout en vez de mode="wait": la pantalla que sale y la que entra
            se solapan (crossfade) en vez de dejar un hueco en blanco entre
            ambas. Las secundarias deslizan horizontal según dirección. */}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, x: isSecondaryScreen ? navDir * 32 : 0, y: isSecondaryScreen ? 0 : 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: isSecondaryScreen ? navDir * -24 : 0, y: isSecondaryScreen ? 0 : -10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex-1 flex flex-col min-h-0"
          >
            <Suspense fallback={<TabFallback />}>
            {currentTab === 'descubrir' && (
              <DiscoverView
                profiles={discoverQuery.data?.profiles ?? []}
                isLoading={discoverQuery.isLoading || discoverQuery.isFetching}
                error={discoverQuery.error}
                quota={discoverQuery.data?.quota}
                personOfTheDay={personOfTheDayQuery.data?.person ?? null}
                onLike={handleLike}
                onPass={handlePass}
                onSuperLike={handleSuperLike}
                onOpenFilters={() => setIsFiltersOpen(true)}
                activeFiltersCount={activeFiltersCount}
                onOpenVerifiedSpots={() => setIsVerifiedSpotsOpen(true)}
                onOpenStore={() => handleTabChange('tienda')}
                onReload={() => discoverQuery.refetch()}
                myInterestIds={user.interests.map((i) => i.id)}
                intentionId={intentionId}
                onSelectIntention={handleSelectIntention}
                resetKey={discoverResetKey}
                dailyMoodId={dailyMoodId}
                onSelectDailyMood={handleSelectDailyMood}
              />
            )}

            {currentTab === 'likes' && (
              <LikesView
                likesUnlockPrice={likesUnlockPrice}
                onOpenChat={handleOpenChat}
                onExploreMore={() => handleTabChange('descubrir')}
              />
            )}

            {currentTab === 'matches' && (
              <MatchesView
                matches={matches}
                isLoading={matchesQuery.isLoading || matchesQuery.isFetching}
                error={matchesQuery.error}
                onOpenChat={handleOpenChat}
                onProposeDate={handleProposeDate}
                onRetry={() => matchesQuery.refetch()}
                onExploreMore={() => handleTabChange('descubrir')}
              />
            )}

            {currentTab === 'mensajes' && (
              <MessagesView
                matches={matches}
                isLoadingMatches={matchesQuery.isLoading || matchesQuery.isFetching}
                activeConnectionId={activeConnectionId}
                contextLabel={activeConnectionId ? chatContext[activeConnectionId] ?? null : null}
                onSelectConnection={setActiveConnectionId}
                onOpenProposeModal={(connectionId) => {
                  const match = matches.find((m) => m.id === connectionId);
                  setProposeModal({ connectionId, partnerName: match?.other.displayName ?? '' });
                }}
                onOpenIcebreaker={(partnerName) => {
                  if (!activeConnectionId) return;
                  setIcebreaker({ connectionId: activeConnectionId, partnerName });
                }}
                onOpenDateQR={(connectionId, partnerName, partnerAvatar) => {
                  setDateQRModal({ connectionId, partnerName, partnerAvatar });
                }}
                onExploreMore={() => handleTabChange('descubrir')}
              />
            )}

            {currentTab === 'tienda' && (
              <StoreView onOpenLikes={() => handleTabChange('likes')} onOpenDiscover={() => handleTabChange('descubrir')} />
            )}

            {currentTab === 'citas' && (
              <DatesView
                matches={matches}
                onOpenChat={handleOpenChat}
                onExploreMatches={() => handleTabChange('matches')}
                onOpenDateQR={(connectionId, partnerName, partnerAvatar) => {
                  setDateQRModal({ connectionId, partnerName, partnerAvatar });
                }}
              />
            )}

            {currentTab === 'perfil' && (
              <ProfileView
                onSelectStamp={(stamp) => setSelectedStamp(stamp)}
                onOpenFullSettings={() => handleTabChange('ajustes')}
                onOpenStore={() => handleTabChange('tienda')}
                onSignOut={handleSignOut}
              />
            )}

            {currentTab === 'ajustes' && (
              <SettingsView onSignOut={handleSignOut} />
            )}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {!isSecondaryScreen && !isChatDetail && (
        <BottomNavBar
          currentTab={currentTab}
          onTabChange={handleTabChange}
          unreadMessagesCount={unreadMessagesCount}
          newLikesCount={newLikesCount}
          userAvatar={user.photos[0]?.url}
        />
      )}

      {/* Modals */}
      <MatchCelebrationModal
        profile={matchCelebration?.profile ?? null}
        coinsEarned={matchCelebration?.coinsEarned ?? 0}
        contextLabel={matchCelebration?.contextLabel ?? null}
        myAvatar={user.photos[0]?.url}
        onSendMessage={() => {
          if (!matchCelebration) return;
          const connectionId = matchCelebration.connectionId;
          const contextLabel = matchCelebration.contextLabel;
          setMatchCelebration(null);
          handleOpenChat(connectionId, contextLabel);
        }}
        onProposePlan={() => {
          if (!matchCelebration) return;
          // Pilar 3: el contexto llega hasta la nota del plan.
          setProposeModal({
            connectionId: matchCelebration.connectionId,
            partnerName: matchCelebration.profile.displayName,
            initialNote: matchCelebration.contextLabel ? `Nos conectó: ${matchCelebration.contextLabel}. ` : undefined,
          });
          setMatchCelebration(null);
        }}
        onClose={() => setMatchCelebration(null)}
      />

      {proposeModal && (
        <ProposeDateModal
          isOpen={Boolean(proposeModal)}
          onClose={() => setProposeModal(null)}
          connectionId={proposeModal.connectionId}
          partnerName={proposeModal.partnerName}
          initialNote={proposeModal.initialNote}
        />
      )}

      <StampModal stamp={selectedStamp} onClose={() => setSelectedStamp(null)} />

      <MenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={handleTabChange}
        onSignOut={handleSignOut}
        user={user}
        badges={{ citas: pendingDatesCount }}
      />

      <DiscoveryFiltersModal
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        filters={discoveryFilters}
        onApplyFilters={(newFilters) => {
          // La intención es dueña de los intereses mientras está activa; si el
          // usuario toma control manual, la intención se pausa (con aviso).
          if (intentionId) {
            setIntentionId(null);
            saveIntention(null);
            toast('Intención pausada', {
              description: 'Ajustaste filtros manualmente — elegí una intención cuando quieras volver.',
            });
          }
          setDiscoveryFilters(newFilters);
          setIsFiltersOpen(false);
        }}
      />

      <VerifiedSpotsModal isOpen={isVerifiedSpotsOpen} onClose={() => setIsVerifiedSpotsOpen(false)} />

      {icebreaker && (
        <Suspense fallback={null}>
          <IcebreakerWheelModal
            isOpen={Boolean(icebreaker)}
            onClose={() => setIcebreaker(null)}
            partnerName={icebreaker.partnerName}
            onSendIcebreakerToChat={(qText) => {
              icebreakerSendMessage.mutate({ body: qText });
              setIcebreaker(null);
            }}
          />
        </Suspense>
      )}

      {dateQRModal && (
        <Suspense fallback={null}>
          <DateQRModal
            isOpen={Boolean(dateQRModal)}
            onClose={() => setDateQRModal(null)}
            connectionId={dateQRModal.connectionId}
            partnerName={dateQRModal.partnerName}
            partnerAvatar={dateQRModal.partnerAvatar}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        {/* reducedMotion="user": toda animación JS de motion respeta el ajuste
            de accesibilidad del sistema; el CSS ya lo cubre con su media query. */}
        <MotionConfig reducedMotion="user">
          <AppContent />
          <Toaster />
        </MotionConfig>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
