import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo, MotionStyle } from 'motion/react';
import { toast } from 'sonner';
import type { Match, Profile } from '../types';
import type { DiscoverQuota } from '../lib/api/discover';
import { sounds } from '../utils/audio';
import { computeAffinity } from '../utils/compatibility';
import { INTENTIONS, getIntention } from '../utils/intentions';
import { DAILY_MOODS, getDailyMood } from '../utils/dailyMood';
import { suggestPlanSpot } from '../utils/planSuggestion';
import { rememberFragment } from '../utils/fragmentContext';
import { ReportBlockSheet } from './ReportBlockSheet';
import { EmptyState, ErrorState } from './StateViews';
import { useTheme } from '../context/ThemeContext';
import { Card } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { LocationPrompt } from './LocationPrompt';
import { OutOfProfilesView } from './OutOfProfilesView';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface DiscoverViewProps {
  profiles: Profile[];
  isLoading?: boolean;
  error?: unknown;
  /** Cuota diaria de perfiles (used/bonus/limit/remaining/resetsAt) — ya la devuelve
   * /discover, solo faltaba mostrarla. undefined mientras carga la primera vez. */
  quota?: DiscoverQuota;
  /** Selección editorial del día (/discover/person-of-the-day). null si hoy no hay o
   * si ya se reaccionó. */
  personOfTheDay?: Profile | null;
  onLike: (profile: Profile) => void;
  onPass: (profile: Profile) => void;
  onSuperLike: (profile: Profile) => void;
  onOpenFilters?: () => void;
  activeFiltersCount?: number;
  onOpenVerifiedSpots?: () => void;
  onOpenStore?: () => void;
  onReload?: () => void;
  /** Ids de mis intereses (para explicar la afinidad sin backend nuevo). */
  myInterestIds?: string[];
  /** Pilar 1: intención temporal activa (id de INTENTIONS) o null. */
  intentionId?: string | null;
  onSelectIntention?: (id: string | null) => void;
  /** Firma de los filtros que definen el mazo (ver App: verified+intereses+distancia).
   * Al cambiar, el mazo arranca de cero en vez de mezclar perfiles del filtro anterior. */
  resetKey?: string;
  /** Ritual diario "Hoy estoy para…" (id de DAILY_MOODS) o null. Solo suma una
   * señal explicada a la afinidad; nunca filtra ni reordena el mazo. */
  dailyMoodId?: string | null;
  onSelectDailyMood?: (id: string | null) => void;
  /** Matches activos: al quedarse sin perfiles se sugiere escribirles. */
  matches?: Match[];
  onOpenMatches?: () => void;
  onOpenChat?: (connectionId: string) => void;
}

/** Desde cuántos pases restantes se avisa que se viene el like obligatorio. */
const PASS_WARNING_AT = 3;

type StampKind = 'like' | 'pass' | 'star';

// Sello de decisión con el lenguaje que Findy ya tenía (mismos colores y
// formas): se usa tanto en vivo durante el drag como fijo en la carta que
// sale volando. Extraído para no duplicar el marcado 4 veces.
const STAMP_STYLE: Record<StampKind, { box: string; icon: string; label: string }> = {
  like: { box: '-rotate-12 border-emerald-500 bg-emerald-950/80 text-emerald-300', icon: 'favorite', label: 'Me gusta' },
  pass: { box: 'rotate-12 border-rose-500 bg-rose-950/80 text-rose-300', icon: 'close', label: 'Pasar' },
  star: { box: 'border-amber-400 bg-amber-950/85 text-amber-300', icon: 'star', label: 'SUPER SPARK' },
};

const StampChip: React.FC<{ kind: StampKind; style?: MotionStyle; className?: string; large?: boolean }> = ({
  kind,
  style,
  className = '',
  large = false,
}) => {
  const s = STAMP_STYLE[kind];
  return (
    <motion.div
      style={style}
      aria-hidden="true"
      className={`pointer-events-none border-2 rounded-[var(--radius-md)] shadow-elevation-md ${s.box} ${
        large ? 'px-5 py-2.5' : 'px-4 py-1.5'
      } ${className}`}
    >
      <div className={`flex items-center ${large ? 'gap-2' : 'gap-1.5'}`}>
        <span
          className={`material-symbols-outlined ${large ? 'text-[24px]' : 'text-[20px]'}`}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {s.icon}
        </span>
        <span className={`font-label-caps font-black ${large ? 'text-[13px] tracking-widest uppercase' : 'text-[13px]'}`}>
          {s.label}
        </span>
      </div>
    </motion.div>
  );
};

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  profiles,
  isLoading = false,
  error,
  quota,
  personOfTheDay,
  onLike,
  onPass,
  onSuperLike,
  onOpenFilters,
  activeFiltersCount = 0,
  onOpenVerifiedSpots,
  onOpenStore,
  onReload,
  myInterestIds = [],
  intentionId = null,
  onSelectIntention,
  resetKey = '',
  dailyMoodId = null,
  onSelectDailyMood,
  matches = [],
  onOpenMatches,
  onOpenChat,
}) => {
  const { isLight } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showFullNotebook, setShowFullNotebook] = useState(false);
  // Mazo continuo: la carta que sale vuela en su propia capa (`leaving`)
  // mientras la siguiente ya entra — nunca hay hueco en blanco ni flicker.
  // Guarda su punto de partida para que el vuelo continúe el gesto del dedo.
  const [leaving, setLeaving] = useState<{
    profile: Profile;
    dir: 'left' | 'right' | 'up';
    fromX: number;
    fromY: number;
    label: string | null;
  } | null>(null);
  // Candado anti-doble-tap: sin esto, dos taps rápidos mandaban dos likes y
  // saltaban dos perfiles (el índice todavía no había avanzado).
  const actionLock = useRef(false);
  // El navegador dispara un click fantasma al soltar un arrastre sobre las
  // zonas de foto — se suprime si el dedo se movió de verdad (ver guard).
  const dragEndAt = useRef(0);
  const dragMoved = useRef(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);
  const [isBlindMode, setIsBlindMode] = useState(false);
  const [unblurredCards, setUnblurredCards] = useState<Record<string, boolean>>({});
  const [personOfDayPromoted, setPersonOfDayPromoted] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  /** Fragmento que disparó el último "me gusta" (interés/prompt) — contexto local. */
  const [likedFragment, setLikedFragment] = useState<string | null>(null);
  /** Pista única: reaccionar a un fragmento también es un me gusta. */
  const [hintSeen, setHintSeen] = useState(() => {
    try {
      return localStorage.getItem('mely-fragment-hint-seen') === '1';
    } catch {
      return true;
    }
  });
  const dismissHint = () => {
    setHintSeen(true);
    try {
      localStorage.setItem('mely-fragment-hint-seen', '1');
    } catch {
      /* modo privado: se muestra una vez por sesión */
    }
  };

  // Mazo local, append-only: cada swipe dispara un refetch de /discover (para traer perfiles
  // nuevos), pero esa respuesta ya no incluye al que acabás de reaccionar — si indexáramos
  // directo sobre `profiles`, la posición actual pasaría a apuntar a otra persona y se salteaba
  // el siguiente perfil. Acá los nuevos se van agregando al final sin reordenar ni sacar nada.
  const [deck, setDeck] = useState<Profile[]>(profiles);
  const seenIds = useRef<Set<string>>(new Set(profiles.map((p) => p.id)));

  useEffect(() => {
    const fresh = profiles.filter((p) => !seenIds.current.has(p.id));
    if (fresh.length === 0) return;
    fresh.forEach((p) => seenIds.current.add(p.id));
    setDeck((prev) => [...prev, ...fresh]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles]);

  // Mazo nuevo al cambiar de filtros o de intención: sin este reset, los
  // perfiles del filtro anterior quedaban mezclados con los del nuevo.
  // `profiles` se lee del render donde cambió resetKey (mismo estado de App
  // que genera ambas cosas, y la query nueva todavía no trajo datos).
  useEffect(() => {
    seenIds.current = new Set(profiles.map((p) => p.id));
    setDeck(profiles);
    setCurrentIndex(0);
    setGalleryIndex(0);
    setShowFullNotebook(false);
    setLikedFragment(null);
    setLeaving(null);
    actionLock.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const unlimited = quota?.unlimited === true;
  const quotaExhausted = quota && !unlimited ? quota.remaining <= 0 : false;

  // "Sí o sí un like": el backend rechaza el pase número maxConsecutivePasses+1
  // (LIKE_REQUIRED). La racha se lleva también acá para bloquear al instante, sin
  // esperar a que vuelva la cuota del servidor después de cada pase.
  const maxPasses = quota?.maxConsecutivePasses ?? 0;
  const [passStreak, setPassStreak] = useState(quota?.passStreak ?? 0);
  useEffect(() => {
    if (quota?.passStreak !== undefined) setPassStreak(quota.passStreak);
  }, [quota?.passStreak]);
  const passLocked = maxPasses > 0 && passStreak >= maxPasses;
  const passesLeft = maxPasses > 0 ? Math.max(0, maxPasses - passStreak) : null;
  const [lockNudge, setLockNudge] = useState(0);

  // Tocar el banner de "Persona del día" adelanta ese perfil a la posición actual del
  // mazo (en vez de abrir un modal aparte) para que Me gusta/Pasar/Super Spark ya
  // funcionen sobre ella sin duplicar la lógica de swipe.
  const handleOpenPersonOfDay = () => {
    if (!personOfTheDay || personOfDayPromoted) return;
    sounds.playClick();
    seenIds.current.add(personOfTheDay.id);
    setDeck((prev) => {
      if (prev.some((p) => p.id === personOfTheDay.id)) return prev;
      const next = [...prev];
      next.splice(currentIndex, 0, personOfTheDay);
      return next;
    });
    setPersonOfDayPromoted(true);
  };

  const showPersonOfDayBanner = Boolean(personOfTheDay) && !personOfDayPromoted;

  // Motion values for gesture physics
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  // Transform drag distance into smooth rotation & opacity indicators.
  // Todo visual del gesto vive en MotionValues: cero re-renders durante el
  // pointermove, solo transform/opacity por composición del navegador.
  const rotate = useTransform(dragX, [-220, 220], [-18, 18]);
  const likeOpacity = useTransform(dragX, [30, 140], [0, 1]);
  const passOpacity = useTransform(dragX, [-30, -140], [0, 1]);
  const superLikeOpacity = useTransform(dragY, [-30, -120], [0, 1]);
  // La carta "respira" un poco al arrastrarla: sensación física, sin costo.
  const cardScale = useTransform([dragX, dragY], ([x, y]: number[]) => 1 - Math.min(0.045, (Math.abs(x) + Math.abs(y)) * 0.0002));

  const currentProfile = deck[currentIndex];
  const nextProfile = deck[currentIndex + 1];

  // Datos incómodos: perfiles sin fotos no pueden romper la tarjeta.
  const mainPhotoUrl = currentProfile?.photos[galleryIndex]?.url || currentProfile?.photos[0]?.url || null;

  // Explicador de afinidad: aritmética client-side sobre datos que ya trae el
  // perfil (intereses, verificación, audio, distancia). Sin backend nuevo.
  const moodKeywords = useMemo(() => getDailyMood(dailyMoodId)?.keywords ?? [], [dailyMoodId]);
  const affinity = useMemo(
    () => (currentProfile ? computeAffinity(currentProfile, myInterestIds, moodKeywords) : null),
    [currentProfile, myInterestIds, moodKeywords],
  );

  const intention = getIntention(intentionId);

  // Pilar 2: hipótesis concreta de primera cita por perfil (rincón verificado
  // real + interés real). Null honesto cuando nada matchea: no se inventa.
  const planSuggestion = useMemo(
    () => (currentProfile ? suggestPlanSpot(currentProfile) : null),
    [currentProfile],
  );

  // Ronda 7: el motivo nunca puede quedar vacío. Cadena honesta: señal real →
  // ciudad real → curiosidad honesta (nunca datos inventados).
  const primaryReason = currentProfile
    ? affinity?.signals[0]?.label ??
      (currentProfile.city ? `En ${currentProfile.city}` : 'Historia por descubrir')
    : null;

  // La pista de fragmentos solo existe si hay fragmentos: enseñar una
  // interacción imposible es peor que no enseñar nada.
  const hasFragments =
    currentProfile &&
    (currentProfile.prompts.length > 0 || currentProfile.interests.length > 0 || Boolean(currentProfile.audioBio));

  // Ronda 8: el card revela UNA pieza de historia sin abrir el cuaderno (una
  // pregunta, no la respuesta; una voz, no el audio). Solo lectura: tocar abre
  // la profundidad. Si no hay nada, no hay peek — nunca relleno.
  const storyPeek = currentProfile
    ? currentProfile.prompts.length > 0
      ? {
          icon: 'format_quote',
          text: `“${currentProfile.prompts[0].question}”`,
          hint: 'Tiene una respuesta — tocá para leerla',
        }
      : currentProfile.audioBio
        ? {
            icon: 'mic',
            text: 'Se presentó con su voz',
            hint:
              currentProfile.audioBio.durationSec != null
                ? `Escuchá su audio de ${Math.floor(currentProfile.audioBio.durationSec / 60)}:${String(currentProfile.audioBio.durationSec % 60).padStart(2, '0')}`
                : 'Escuchá su audio',
          }
        : null
    : null;

  // El cuaderno solo se ofrece si tiene algo adentro.
  const hasNotebookContent =
    currentProfile &&
    Boolean(
      currentProfile.bio || currentProfile.audioBio || currentProfile.interests.length > 0 || currentProfile.prompts.length > 0,
    );



  if (error && deck.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <LocationPrompt />
        <ErrorState
          title="No pudimos cargar Descubrir"
          body="Revisá tu conexión e intentá de nuevo — tu cupo de hoy sigue intacto."
          onRetry={() => onReload?.()}
          retryLabel="Reintentar"
        />
      </div>
    );
  }

  if (isLoading && deck.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <div className="w-full min-h-[min(560px,68dvh)] rounded-[var(--radius-lg)] overflow-hidden flex flex-col gap-3 p-0">
          <Skeleton className="h-[380px] w-full rounded-none" />
          <div className="p-5 flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (quotaExhausted || !currentProfile) {
    return (
      <div className="flex flex-col gap-4">
        <LocationPrompt />
        <OutOfProfilesView
          reason={quotaExhausted ? 'quota' : 'empty'}
          matches={matches}
          resetsAt={quota?.resetsAt}
          canExpandQuota={!unlimited}
          onOpenMatches={onOpenMatches}
          onOpenChat={onOpenChat}
          onOpenStore={onOpenStore}
          onReload={onReload}
          isReloading={isLoading}
          extraActions={
            !quotaExhausted && intentionId && onSelectIntention
              ? [{ label: 'Ver sin filtro de intención', onClick: () => onSelectIntention(null) }]
              : []
          }
        />
      </div>
    );
  }

  const triggerAction = (type: 'liked' | 'passed' | 'starred', fragmentLabel?: string | null) => {
    if (actionLock.current || leaving || !currentProfile) return;
    if (type === 'passed' && passLocked) {
      // La carta vuelve sola con el spring; se marca el aviso para que se note.
      sounds.playClick();
      setLockNudge((n) => n + 1);
      return;
    }
    actionLock.current = true;
    dismissHint();
    const dir = type === 'liked' ? 'right' : type === 'passed' ? 'left' : 'up';
    const profile = currentProfile;
    // La carta que sale arranca desde donde se soltó el dedo (continuidad
    // física) y la entrante parte de valores frescos: sin snaps ni flicker.
    const fromX = dragX.get();
    const fromY = dragY.get();
    dragX.set(0);
    dragY.set(0);
    setLeaving({ profile, dir, fromX, fromY, label: fragmentLabel ?? likedFragment });

    setPassStreak((n) => (type === 'passed' ? n + 1 : 0));

    if (type === 'liked') {
      sounds.playStamp();
      onLike(profile);
    } else if (type === 'starred') {
      sounds.playCoins();
      onSuperLike(profile);
    } else {
      sounds.playClick();
      onPass(profile);
    }

    // Latido de 120ms para registrar el sello, y la siguiente carta ya entra
    // mientras la anterior todavía vuela: mazo continuo, sin hueco en blanco.
    timers.current.push(
      window.setTimeout(() => {
        setGalleryIndex(0);
        setShowFullNotebook(false);
        setLikedFragment(null);
        setCurrentIndex((prev) => prev + 1);
      }, 120),
    );
    timers.current.push(
      window.setTimeout(() => {
        setLeaving(null);
        actionLock.current = false;
      }, 480),
    );
  };

  /** "Me gusta" nacido de un fragmento concreto (un interés, un prompt). El
   * backend recibe el mismo like de siempre — el contexto vive en la UI y en
   * el toast, y mañana puede persistirse como {fragment} sin romper el contrato. */
  const likeFromFragment = (fragmentLabel: string) => {
    if (!currentProfile || leaving || actionLock.current) return;
    dismissHint();
    setLikedFragment(fragmentLabel);
    // Pilar 3: el contexto viaja con el perfil hacia el match y el plan.
    rememberFragment(currentProfile.id, fragmentLabel);
    toast.success(`Te gustó: ${fragmentLabel}`, {
      description: `${currentProfile.displayName} va a ver que algo concreto te llamó la atención.`,
    });
    triggerAction('liked', fragmentLabel);
  };

  const handleDragStart = () => {
    dragMoved.current = false;
  };

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) + Math.abs(info.offset.y) > 12) dragMoved.current = true;
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    dragEndAt.current = Date.now();
    const threshold = 100;
    const velocityThreshold = 400;

    if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      triggerAction('liked');
    } else if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      triggerAction('passed');
    } else if (info.offset.y < -threshold || info.velocity.y < -velocityThreshold) {
      triggerAction('starred');
    }
    // Si no hubo umbral, el spring elástico la devuelve sola (dragConstraints
    // en 0 + dragElastic): acá no se toca ningún estado.
  };

  // Click fantasma post-arrastre: si el dedo se movió de verdad, el click que
  // el navegador dispara al soltar (típicamente sobre una zona de foto) se
  // traga acá — evita avances de galería y taps accidentales en botones.
  const suppressClickAfterDrag = (e: React.SyntheticEvent) => {
    if (dragMoved.current && Date.now() - dragEndAt.current < 300) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-8 select-none">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="section-kicker">Descubrir</p>
          <h2 className={`discover-header-title mt-1 text-[22px] font-bold tracking-tight ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
            Una conexión a la vez
          </h2>
          <p className={`mt-1 max-w-[250px] text-[12px] leading-relaxed ${isLight ? 'text-[#5b6478]' : 'text-[#ffa3c4]/70'}`}>
            Conocé la historia antes de decidir si hay chispa.
          </p>
          {quota && (
            <div
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                quotaExhausted
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                  : isLight
                  ? 'bg-[#efe7d8] text-[#5b6478]'
                  : 'bg-white/8 text-[#a9b2c9]'
              }`}
              title={
                unlimited
                  ? 'Tu plan no tiene tope diario de perfiles'
                  : `Se renueva ${new Date(quota.resetsAt).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
              }
            >
              <span className="material-symbols-outlined text-[13px]">bolt</span>
              {unlimited
                ? 'Sin límite'
                : quotaExhausted
                ? 'Por hoy está bien'
                : `${quota.remaining} ${quota.remaining === 1 ? 'historia' : 'historias'} hoy`}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Rincones & Beneficios, Modo Cita a Ciegas y Filtros son funcionalidad real que
              antes vivía como 3 íconos sueltos compitiendo con la card — el mockup aprobado
              (Discover.dc.html) solo deja un ícono de ajustes en la cabecera. Se mantiene todo,
              pero re-acomodado detrás de un único trigger colapsado; un puntito coral avisa
              cuando hay algo activo (cita a ciegas o filtros) sin ocupar más espacio visual. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={() => sounds.playClick()}
                className={`tap-target relative w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                  isLight ? 'bg-[#efe7d8] text-[#16223b] hover:bg-[#efe7d8]' : 'bg-white/8 text-[#f5f1e8] hover:bg-white/14'
                }`}
                title="Más opciones de Descubrir"
                aria-label="Más opciones de Descubrir"
              >
                <span className="material-symbols-outlined text-[16px]">tune</span>
                {(isBlindMode || activeFiltersCount > 0) && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#ec4d86] border-2 border-[var(--midnight-900)]" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Opciones de Descubrir</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {onOpenVerifiedSpots && (
                <DropdownMenuItem
                  onClick={() => {
                    sounds.playClick();
                    onOpenVerifiedSpots();
                  }}
                  className="gap-2"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#ec4d86]">storefront</span>
                  Rincones & Beneficios
                </DropdownMenuItem>
              )}
              <DropdownMenuCheckboxItem
                checked={isBlindMode}
                onCheckedChange={() => {
                  sounds.playClick();
                  setIsBlindMode(!isBlindMode);
                }}
                onSelect={(e) => e.preventDefault()}
                className="gap-2"
              >
                <span className="material-symbols-outlined text-[16px] text-[#ec4d86]">
                  {isBlindMode ? 'visibility' : 'visibility_off'}
                </span>
                Modo Cita a Ciegas
              </DropdownMenuCheckboxItem>
              {onOpenFilters && (
                <DropdownMenuItem
                  onClick={() => {
                    sounds.playClick();
                    onOpenFilters();
                  }}
                  className="gap-2"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#ec4d86]">tune</span>
                  <span className="flex-1">Filtros</span>
                  {activeFiltersCount > 0 && (
                    <span className="w-4 h-4 bg-[#ec4d86] text-white font-mono text-[9px] font-bold rounded-full flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </DropdownMenuItem>
              )}
              {currentProfile && (
                <DropdownMenuItem
                  onClick={() => {
                    sounds.playClick();
                    setIsReportOpen(true);
                  }}
                  className="gap-2"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#ec4d86]">flag</span>
                  <span className="flex-1">Reportar o bloquear</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Pilar 1: la intención manda. Ritual semanal en un tap — declara qué
          querés esta semana y el descubrimiento se ordena alrededor de eso. */}
      {onSelectIntention && (
        <div>
          <div
            className="chip-row-compact flex gap-1.5 overflow-x-auto no-scrollbar px-1 -mx-1 py-0.5"
            role="group"
            aria-label="Intención de la semana"
          >
            {INTENTIONS.map((item) => {
              const active = intentionId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onSelectIntention(active ? null : item.id);
                  }}
                  aria-pressed={active}
                  title={item.blurb}
                  className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border-[1.5px] text-[12px] font-bold whitespace-nowrap transition-all active:scale-95 ${
                    active
                      ? 'bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] border-transparent text-white shadow-elevation-md'
                      : isLight
                        ? 'bg-white border-[rgba(22,34,59,0.14)] text-[#5b6478]'
                        : 'bg-white/5 border-white/10 text-[#a9b2c9]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={intentionId ?? 'none'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={`mt-1.5 px-1 text-[11px] leading-snug ${isLight ? 'text-[#5b6478]' : 'text-[#ffa3c4]/70'}`}
              aria-live="polite"
            >
              {intention
                ? `Tu intención: ${intention.label.toLowerCase()} — ${intention.blurb}. Queda guardada hasta que la cambies.`
                : '¿Qué querés estos días? Elegí una intención y te mostramos personas en esa sintonía.'}
            </motion.p>
          </AnimatePresence>
        </div>
      )}

      {/* Ritual diario: el pulso de hoy en un tap. Expira solo a la medianoche y
          solo suma una señal explicada a la afinidad — jamás filtra ni oculta. */}
      {onSelectDailyMood && (
        <div>
          <div
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1 -mx-1 py-0.5"
            role="group"
            aria-label="Ánimo de hoy"
          >
            <span
              className={`shrink-0 text-[10px] font-bold tracking-wider ${isLight ? 'text-[#5b6478]' : 'text-[#ffa3c4]/70'}`}
              aria-hidden="true"
            >
              HOY
            </span>
            {DAILY_MOODS.map((mood) => {
              const active = dailyMoodId === mood.id;
              return (
                <button
                  key={mood.id}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onSelectDailyMood(active ? null : mood.id);
                  }}
                  aria-pressed={active}
                  title={mood.blurb}
                  className={`shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full border text-[11px] font-bold whitespace-nowrap transition-all active:scale-95 ${
                    active
                      ? 'bg-[#ec4d86] border-transparent text-white shadow-elevation-sm'
                      : isLight
                        ? 'bg-transparent border-[rgba(22,34,59,0.14)] text-[#5b6478]'
                        : 'bg-transparent border-white/10 text-[#a9b2c9]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{mood.icon}</span>
                  {mood.label}
                </button>
              );
            })}
          </div>
          {dailyMoodId && (
            <p className={`mt-1 px-1 text-[11px] leading-snug ${isLight ? 'text-[#5b6478]' : 'text-[#ffa3c4]/70'}`} aria-live="polite">
              Hoy estás para {getDailyMood(dailyMoodId)?.label.toLowerCase()} — la afinidad lo tiene en cuenta. Se reinicia a la medianoche.
            </p>
          )}
        </div>
      )}

      <LocationPrompt />

      {showPersonOfDayBanner && personOfTheDay && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleOpenPersonOfDay}
          className={`flex items-center gap-3 rounded-[var(--radius-md)] border p-2.5 text-left tactile-btn shadow-elevation-sm ${
            isLight ? 'bg-white border-[#ffe0ec]' : 'bg-[#0f1a2e] border-[#ec4d86]/25'
          }`}
        >
          <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-[#0a1120] flex items-center justify-center">
            {personOfTheDay.photos[0]?.url ? (
              <img
                src={personOfTheDay.photos[0]?.url}
                alt={personOfTheDay.displayName}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="material-symbols-outlined text-[24px] text-white/40" aria-hidden="true">person</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-label-caps text-[9.5px] uppercase font-bold tracking-wider text-[#ec4d86] flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
              Persona del día
            </span>
            <p className={`text-[13.5px] font-bold truncate ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
              {personOfTheDay.displayName}, {personOfTheDay.age}
            </p>
            <p className={`text-[11.5px] truncate ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
              Elegida a mano para vos — dale un vistazo antes que el resto.
            </p>
          </div>
          <span className={`material-symbols-outlined text-[18px] shrink-0 ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
            chevron_right
          </span>
        </motion.button>
      )}

      {/* Card Deck Container — en teléfonos chicos la altura se adapta al viewport. */}
      <div className="relative w-full min-h-[min(560px,68dvh)]">
        {/* Next Card in Background (Smooth Depth Stack) */}
        {nextProfile && (
          <div
            className={`absolute inset-0 rounded-[var(--radius-lg)] border overflow-hidden pointer-events-none transition-transform duration-300 shadow-elevation-sm ${
              isLight ? 'bg-white border-[#ffe0ec]/60' : 'bg-[#0f1a2e] border-[#ec4d86]/20'
            }`}
            style={{
              transform: 'scale(0.95) translateY(12px)',
              opacity: 0.7,
              zIndex: 1,
            }}
          >
            <div className="relative h-[300px] min-[380px]:h-[360px] w-full bg-[#0a1120] overflow-hidden">
              {nextProfile.photos[0]?.url && (
                <img
                  src={nextProfile.photos[0]?.url}
                  alt=""
                  aria-hidden="true"
                  // Precarga visual del siguiente perfil: eager para que la
                  // transición no muestre un lienzo vacío ni parpadee.
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  draggable={false}
                  className="w-full h-full object-cover filter blur-[0.5px]"
                  referrerPolicy="no-referrer"
                />
              )}
              <div
                className={`absolute inset-0 bg-gradient-to-t ${
                  isLight ? 'from-black/75 via-black/20 to-transparent' : 'from-[#0f1a2e] via-black/30 to-transparent'
                }`}
              />
            </div>
          </div>
        )}

        {/* Active Forefront Card — entra desde la pose exacta de la carta de
            atrás (scale .95 / y 12), así el handoff al avanzar es invisible.
            El gesto vive en la foto (superficie de arrastre); esta capa solo
            entra y sostiene los MotionValues compartidos. */}
          <motion.div
            key={`card-${currentProfile.id}`}
            initial={{ opacity: 0.65, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 27 }}
            onClickCapture={suppressClickAfterDrag}
            className="w-full relative"
            style={{ zIndex: 10 }}
          >
          <motion.div style={{ x: dragX, y: dragY, rotate, scale: cardScale }} className="w-full">
            <Card
              className={`rounded-[var(--radius-lg)] border overflow-hidden relative shadow-elevation-lg transition-shadow duration-300 ${
                isLight ? 'bg-white border-[#ffe0ec]' : 'bg-[#0f1a2e] border-[#ec4d86]/30'
              }`}
            >
              {/* Sellos en vivo del gesto: el usuario ve qué está por hacer antes
                  de soltar. Sin backdrop-blur: con el fondo ya 80-85% opaco el
                  blur aportaba poco, pero recalcularlo en cada frame del drag
                  dispara el glitch de Chrome Android que deja "pegado" un frame
                  viejo (reportado por usuarios). El feedback de botón vive en
                  la capa `leaving`, que vuela con el sello puesto. */}
              <StampChip kind="like" style={{ opacity: likeOpacity }} className="absolute top-8 left-6 z-30" />
              <StampChip kind="pass" style={{ opacity: passOpacity }} className="absolute top-8 right-6 z-30" />
              <StampChip
                kind="star"
                style={{ opacity: superLikeOpacity }}
                className="absolute top-[38%] left-1/2 -translate-x-1/2 z-30"
                large
              />

              {/* Superficie de arrastre: solo la foto es `touch-none` — así el
                  gesto vertical (Super Spark) funciona en táctil sin matar el
                  scroll de la página, que sigue disponible desde el contenido
                  de abajo. directionLock fija el eje dominante (evita Super
                  Sparks accidentales en diagonal) y momentum=false deja la
                  carta donde se suelta o vuelve con spring. */}
              <motion.div
                data-drag-surface
                drag={!leaving}
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0.7}
                dragDirectionLock
                dragMomentum={false}
                onDragStart={handleDragStart}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                className="relative h-[min(380px,42dvh)] w-full bg-[#0a1120] overflow-hidden group touch-none cursor-grab active:cursor-grabbing"
              >
                {mainPhotoUrl ? (
                  <motion.img
                    key={`${currentProfile.id}-${galleryIndex}`}
                    src={mainPhotoUrl}
                    alt={currentProfile.displayName}
                    loading="eager"
                    decoding="async"
                    // Fundido corto al cambiar de foto: la galería se siente
                    // continua en vez de "cortar" entre imágenes.
                    initial={{ opacity: 0.35 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    onError={(e) => {
                      // Imagen rota: se oculta y queda el lienzo midnight con la
                      // info encima, nunca un ícono de imagen rota.
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                    className={`w-full h-full object-cover select-none transition-all duration-700 ${
                      isBlindMode && !unblurredCards[currentProfile.id]
                        ? 'filter blur-2xl scale-110'
                        : 'group-hover:scale-105'
                    }`}
                    referrerPolicy="no-referrer"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/40" role="img" aria-label={`Sin fotos: ${currentProfile.displayName}`}>
                    <span className="material-symbols-outlined text-[56px]">person</span>
                    <span className="text-[12px] font-bold">Sin fotos todavía</span>
                  </div>
                )}

                {/* Blind Mode Overlay if blurred */}
                {isBlindMode && !unblurredCards[currentProfile.id] && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-black/40 backdrop-blur-md">
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-300 mb-2 shadow-elevation-md">
                      <span className="material-symbols-outlined text-[26px]">visibility_off</span>
                    </div>
                    <span className="font-label-caps text-[10px] uppercase tracking-widest text-amber-300 font-bold">
                      CITA A CIEGAS FINDY
                    </span>
                    <p className="font-body-sm text-[12px] text-white/90 mt-1 max-w-[240px] leading-snug">
                      {currentProfile.blindPrompt?.teaser || 'Conoce primero su voz y reflexiones antes de descubrir la mirada.'}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sounds.playSpark();
                        setUnblurredCards((prev) => ({ ...prev, [currentProfile.id]: true }));
                      }}
                      className="mt-3 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white font-label-caps text-[9px] uppercase font-bold tracking-wider shadow-elevation-md hover:scale-105 transition-transform flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[13px]">sparkles</span>
                      Revelar Mirada
                    </button>
                  </div>
                )}

                {/* Left/Right Photo Tap Zones — botones reales: navegables por
                    teclado y con nombre para lector de pantalla. */}
                {(!isBlindMode || unblurredCards[currentProfile.id]) && currentProfile.photos.length > 1 && (
                  <div className="absolute inset-0 z-10 flex">
                    <button
                      type="button"
                      className="w-1/2 h-full cursor-pointer focus:outline-none focus-visible:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (galleryIndex > 0) {
                          sounds.playClick();
                          setGalleryIndex((prev) => prev - 1);
                        }
                      }}
                      title="Foto anterior"
                      aria-label={`Foto anterior (${galleryIndex} de ${currentProfile.photos.length})`}
                    />
                    <button
                      type="button"
                      className="w-1/2 h-full cursor-pointer focus:outline-none focus-visible:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (galleryIndex < currentProfile.photos.length - 1) {
                          sounds.playClick();
                          setGalleryIndex((prev) => prev + 1);
                        }
                      }}
                      title="Foto siguiente"
                      aria-label={`Foto siguiente (${galleryIndex + 2} de ${currentProfile.photos.length})`}
                    />
                  </div>
                )}

                {/* Vignette & Gradient */}
                <div
                  className={`absolute inset-0 pointer-events-none bg-gradient-to-t ${
                    isLight
                      ? 'from-black/80 via-black/25 to-transparent'
                      : 'from-[#0f1a2e] via-[#0f1a2e]/30 to-transparent'
                  }`}
                />

                {/* Photo progress segments, top */}
                {currentProfile.photos.length > 1 && (
                  <div className="absolute top-3 inset-x-4 flex gap-1.5 z-20 pointer-events-none" aria-hidden="true">
                    {currentProfile.photos.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          idx === galleryIndex ? 'bg-white/90' : 'bg-white/35'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Primary Name & Intro Overlay — name/verified/location/bio-teaser directly on the photo, no separate white panel by default */}
                <div className="absolute bottom-4 left-5 right-5 z-20 flex justify-between items-end">
                  <div className="min-w-0 flex-1 pr-2">
                    {/* Intención primero: qué busca, antes que la foto decida por vos. */}
                    <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 border border-white/25 px-2.5 py-1 text-[10.5px] font-bold text-white backdrop-blur-xs">
                      <span className="material-symbols-outlined text-[12px] text-[#ff6b9e]">explore</span>
                      Busca: {currentProfile.lookingForLabel}
                    </span>
                    <div className="flex items-center gap-2">
                      <h2 className="font-headline-md text-[27px] font-extrabold text-white tracking-tight drop-shadow-xs truncate">
                        {currentProfile.displayName}, {currentProfile.age}
                      </h2>
                      {currentProfile.badges.trusted && (
                        <span
                          className="material-symbols-outlined text-[20px] text-[#ec4d86] shrink-0"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                          title="Citas verificadas"
                        >
                          verified
                        </span>
                      )}
                      {currentProfile.badges.verified && (
                        <span
                          className="material-symbols-outlined text-[20px] text-sky-400 shrink-0"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                          title="Identidad verificada"
                        >
                          verified
                        </span>
                      )}
                    </div>
                    {/* Solo si hay dato real: con ciudad/distancia nulas se leía
                        un "•" flotando sin nada al lado. */}
                    {[currentProfile.city, currentProfile.distance].filter(Boolean).length > 0 && (
                      <p className="text-[13.5px] text-white/90 flex items-center gap-1 mt-1.5">
                        <span className="material-symbols-outlined text-[13px] text-[#ff6b9e]">location_on</span>
                        {[currentProfile.city, currentProfile.distance].filter(Boolean).join(' • ')}
                      </p>
                    )}
                    {/* Capítulo 1 cierra con el motivo humano (no con la bio
                        truncada, que vive completa en el cuaderno): en 1 segundo
                        entendés por qué apareció esta persona. */}
                    {primaryReason && (
                      <p className="text-[13.5px] font-semibold text-white mt-1.5 truncate flex items-center gap-1.5 drop-shadow-xs">
                        <span className="material-symbols-outlined text-[14px] text-[#ff6b9e] shrink-0">
                          {affinity?.signals[0]?.icon ?? 'location_on'}
                        </span>
                        <span className="truncate">{primaryReason}</span>
                      </p>
                    )}
                  </div>

                  {/* Sin contenido no hay cuaderno: el botón no se ofrece. */}
                  {hasNotebookContent && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        sounds.playClick();
                        setShowFullNotebook(!showFullNotebook);
                      }}
                      className="relative p-2.5 bg-black/60 text-white hover:bg-black/80 rounded-full border border-white/30 backdrop-blur-xs shadow-elevation-md transition-colors"
                      title={`Abrir cuaderno: ${currentProfile.prompts.length} respuestas${currentProfile.audioBio ? ' + audio' : ''}`}
                      aria-label={`Abrir cuaderno de ${currentProfile.displayName}: ${currentProfile.prompts.length} respuestas${currentProfile.audioBio ? ' y audio' : ''}`}
                    >
                      <motion.span
                        animate={{ rotate: showFullNotebook ? 180 : 0 }}
                        transition={{ duration: 0.25 }}
                        className="material-symbols-outlined text-[20px] block"
                      >
                        expand_more
                      </motion.span>
                      {/* Promesa de contenido: el chevron ya no es genérico, dice
                          cuánta historia hay adentro. */}
                      {(currentProfile.prompts.length > 0 || currentProfile.audioBio) && !showFullNotebook && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ec4d86] text-white text-[10px] font-bold flex items-center justify-center font-mono">
                          {currentProfile.prompts.length + (currentProfile.audioBio ? 1 : 0)}
                        </span>
                      )}
                    </motion.button>
                  )}
                </div>
              </motion.div>

              {/* Capítulo 2 — por qué esta persona: razones humanas primero, el %
                  como sello que las respalda (nunca "Compatibilidad: 87%"). Vive
                  DENTRO de la tarjeta para que todo salga junto con ella: un
                  mismo espacio, no bloques sueltos compitiendo. */}
              {affinity && (
                <motion.div
                  key={`affinity-${currentProfile.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className={`mx-4 mt-3 flex items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 ${
                    isLight ? 'bg-[#fcf9f2] border-[#ffe0ec]' : 'bg-[#0a1120] border-[#ec4d86]/20'
                  }`}
                  aria-live="polite"
                >
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12px] font-bold truncate ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
                      {primaryReason ?? 'Seleccionada para vos hoy'}
                    </p>
                    {affinity.signals.length > 1 && (
                      <p className={`text-[11px] truncate ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                        {affinity.signals
                          .slice(1)
                          .map((s) => s.label)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <span
                    className="shrink-0 rounded-full bg-gradient-to-br from-[#ec4d86] to-[#ff6b9e] text-white text-[12px] font-extrabold px-2 py-0.5 font-mono"
                    title="Afinidad estimada con tus datos"
                  >
                    {affinity.score}
                  </span>
                </motion.div>
              )}

              {/* Capítulo 3 — qué podrían hacer: hipótesis concreta de primera
                  cita con rincón real. Si no hay match honesto, no existe. */}
              {planSuggestion && onOpenVerifiedSpots && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onOpenVerifiedSpots();
                  }}
                  className={`mx-4 mt-2 flex items-center gap-2 rounded-[var(--radius-md)] border px-2.5 py-2 text-left transition-colors active:scale-[0.99] ${
                    isLight ? 'bg-white border-[#ffe0ec] hover:bg-[#fcf9f2]' : 'bg-[#131f36] border-[#ec4d86]/20 hover:bg-white/5'
                  }`}
                  title={`Ver ${planSuggestion.spot.name}`}
                >
                  <span className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-[#ec4d86]/25">
                    <img
                      src={planSuggestion.spot.image}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[12px] font-bold truncate ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
                      Podrían ir a {planSuggestion.spot.name}
                    </span>
                    <span className={`block text-[11px] truncate ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                      {planSuggestion.spot.neighborhood} · {planSuggestion.reason}
                    </span>
                  </span>
                  <span className={`material-symbols-outlined text-[16px] shrink-0 ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                    chevron_right
                  </span>
                </button>
              )}

              {/* Nivel 3 — un fragmento sin abrir el cuaderno: la pregunta (no la
                  respuesta), la voz (no el audio). Tocar abre la profundidad.
                  El motivo sigue siendo la única entrada; esto es la promesa. */}
              {storyPeek && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    sounds.playClick();
                    setShowFullNotebook(true);
                  }}
                  className={`mx-4 mt-2 flex items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors active:scale-[0.99] ${
                    isLight ? 'bg-white border-[#ffe0ec] hover:bg-[#fcf9f2]' : 'bg-[#0a1120] border-[#ec4d86]/20 hover:bg-white/5'
                  }`}
                  title="Abrir el cuaderno"
                  aria-label={`${storyPeek.text}. ${storyPeek.hint}`}
                >
                  <span className="material-symbols-outlined text-[18px] text-[#ec4d86] shrink-0" aria-hidden="true">
                    {storyPeek.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[12px] italic truncate ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
                      {storyPeek.text}
                    </span>
                    <span className={`block text-[11px] truncate ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                      {storyPeek.hint}
                    </span>
                  </span>
                  <span className={`material-symbols-outlined text-[16px] shrink-0 ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`} aria-hidden="true">
                    chevron_right
                  </span>
                </button>
              )}

              {/* Everything below lives behind the expand chevron — by default the card is just
                  the photo + actions, matching the restrained direction. Nothing here is lost,
                  it's one tap away instead of always competing for space. */}
              <AnimatePresence>
                {showFullNotebook && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className={`p-5 flex flex-col gap-4 ${isLight ? 'bg-white' : 'bg-[#0f1a2e]'}`}>
                      {currentProfile.bio && (
                        <p className={`text-[14px] leading-relaxed ${isLight ? 'text-[#2e5570]' : 'text-[#ffe0ec]/90'}`}>
                          {currentProfile.bio}
                        </p>
                      )}

                      {currentProfile.audioBio && (
                        <div
                          className={`p-3.5 rounded-[var(--radius-md)] flex items-center gap-3 transition-all ${
                            isLight ? 'bg-[#fcf9f2]' : 'bg-[#131f36]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px] text-[#ec4d86] shrink-0">mic</span>
                          <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[10px] font-bold text-[#ec4d86] block mb-1">Audio-bio</span>
                            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                            <audio controls preload="none" className="w-full h-8" src={currentProfile.audioBio.url} />
                          </div>
                        </div>
                      )}

                      {currentProfile.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {currentProfile.interests.map((interest) => (
                            <button
                              key={interest.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                likeFromFragment(`interés en ${interest.name}`);
                              }}
                              title={`Me gusta su interés en ${interest.name}`}
                              aria-label={`Me gusta su interés en ${interest.name}`}
                              className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 min-h-[32px] rounded-full transition-transform active:scale-95 ${
                                isLight ? 'bg-[#fcf9f2] text-[#ec4d86] font-bold' : 'bg-[#131f36] text-[#ffa3c4]'
                              }`}
                            >
                              {interest.name}
                              <span className="material-symbols-outlined text-[13px]">favorite</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {currentProfile.prompts.map((prompt, pIdx) => (
                        <motion.div
                          key={pIdx}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: pIdx * 0.08 }}
                          className={`p-3.5 rounded-[var(--radius-md)] ${isLight ? 'bg-[#fcf9f2]' : 'bg-[#0a1120]'}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-[11px] font-bold text-[#ec4d86] block">{prompt.question}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                likeFromFragment(`respuesta sobre “${prompt.question}”`);
                              }}
                              title="Me gusta esta respuesta"
                              aria-label={`Me gusta su respuesta sobre ${prompt.question}`}
                              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[#ec4d86] hover:bg-[#ec4d86]/10 active:scale-90 transition-all"
                            >
                              <span className="material-symbols-outlined text-[16px]">favorite</span>
                            </button>
                          </div>
                          <p
                            title={prompt.answer}
                            className={`text-[13px] leading-relaxed break-words line-clamp-8 ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}
                          >
                            {prompt.answer}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Pista única anti-Tinder: el camino principal no es el botón
                  grande, es reaccionar a algo concreto. Desaparece para siempre
                  con la primera acción. */}
              {!hintSeen && hasFragments && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    sounds.playClick();
                    dismissHint();
                    setShowFullNotebook(true);
                  }}
                  className={`mx-4 mt-3 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11.5px] font-bold transition-colors animate-fadeIn ${
                    isLight ? 'bg-[#ec4d86]/8 text-[#ec4d86]' : 'bg-white/5 text-[#ffa3c4]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">favorite</span>
                  Tocá el corazón en lo que te guste — eso también es un me gusta
                </button>
              )}

              {/* Like obligatorio: aviso suave cuando quedan pocos pases, y bloqueo
                  claro cuando se acabaron (el backend responde LIKE_REQUIRED). */}
              <AnimatePresence initial={false}>
                {(passLocked || (passesLeft !== null && passesLeft <= PASS_WARNING_AT)) && (
                  <motion.div
                    key={passLocked ? 'locked' : 'warning'}
                    role="status"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="mx-4 mt-3"
                  >
                  {/* key por intento: cada vez que se intenta pasar bloqueado, se sacude de nuevo. */}
                  <motion.div
                    key={passLocked ? `nudge-${lockNudge}` : 'warning'}
                    animate={passLocked && lockNudge > 0 ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
                    transition={{ duration: 0.4 }}
                    className={`flex items-start gap-2 rounded-[var(--radius-md)] px-3 py-2.5 text-left text-[12px] leading-snug ${
                      passLocked
                        ? 'bg-[#ec4d86]/12 text-[#c23a6c] dark:text-[#ffa3c4]'
                        : isLight
                        ? 'bg-[#efe7d8] text-[#5b6478]'
                        : 'bg-white/6 text-[#a9b2c9]'
                    }`}
                  >
                    <span className="material-symbols-outlined mt-px text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {passLocked ? 'favorite' : 'info'}
                    </span>
                    <span>
                      {passLocked ? (
                        <>
                          <strong className="font-bold">Pasaste {maxPasses} perfiles seguidos.</strong> Para seguir viendo, dale
                          me gusta a alguien que te interese: así le das una chance real al match.
                        </>
                      ) : passesLeft === 1 ? (
                        'Te queda 1 pase: después vas a tener que dar un me gusta para seguir.'
                      ) : (
                        `Te quedan ${passesLeft} pases: después vas a tener que dar un me gusta para seguir.`
                      )}
                    </span>
                  </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action row: pasar / me gusta / destacar, con deshacer discreto. */}
              <div className="pt-4 pb-2 flex items-center justify-center gap-4">
                <motion.button
                  whileHover={{ scale: currentIndex > 0 ? 1.08 : 1 }}
                  whileTap={{ scale: currentIndex > 0 ? 0.92 : 1 }}
                  id="btn-discover-rewind"
                  onClick={() => {
                    if (leaving || currentIndex === 0) return;
                    sounds.playClick();
                    setCurrentIndex((prev) => prev - 1);
                  }}
                  disabled={currentIndex === 0 || leaving !== null}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    currentIndex === 0
                      ? 'opacity-30 cursor-not-allowed text-slate-400 dark:text-white/30'
                      : isLight
                      ? 'text-slate-400 hover:text-[#ec4d86]'
                      : 'text-white/40 hover:text-[#ffa3c4]'
                  }`}
                  title="Deshacer"
                  aria-label="Deshacer perfil"
                >
                  <span className="material-symbols-outlined text-[18px]">replay</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: passLocked ? 1 : 1.1 }}
                  whileTap={{ scale: passLocked ? 1 : 0.9 }}
                  id="btn-discover-pass"
                  onClick={() => triggerAction('passed')}
                  aria-disabled={passLocked}
                  className={`w-[46px] h-[46px] rounded-full flex items-center justify-center shadow-elevation-sm transition-colors ${
                    passLocked
                      ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-white/5 dark:text-white/40'
                      : isLight
                      ? 'bg-white text-[#ff6b9e]'
                      : 'bg-[#131f3690] text-[#ffa3c4]'
                  }`}
                  title={passLocked ? 'Dale me gusta a alguien para seguir pasando' : 'Pasar'}
                  aria-label={passLocked ? 'Pasar bloqueado: dale me gusta a alguien para seguir' : 'Pasar perfil'}
                >
                  <span className="material-symbols-outlined text-[22px]">{passLocked ? 'lock' : 'close'}</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.88 }}
                  id="btn-discover-stamp-like"
                  onClick={() => triggerAction('liked')}
                  className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-[#ec4d86] to-[#ff6b9e] text-white flex items-center justify-center shadow-[0_10px_22px_-6px_rgba(225,29,72,0.55)] transition-all"
                  title="Me gusta"
                  aria-label="Me gusta y conectar"
                >
                  <span className="material-symbols-outlined text-[27px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    favorite
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  id="btn-discover-superlike"
                  onClick={() => triggerAction('starred')}
                  className={`w-[46px] h-[46px] rounded-full flex items-center justify-center shadow-elevation-sm transition-colors ${
                    isLight ? 'bg-white text-[#6fa8c9]' : 'bg-[#131f3690] text-[#6fa8c9]'
                  }`}
                  title="Super Spark: le llega tu perfil destacado"
                  aria-label="Super Spark"
                >
                  <span className="material-symbols-outlined text-[21px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                </motion.button>
              </div>
            </Card>
          </motion.div>
          </motion.div>

        {/* La carta que sale vuela en su propia capa mientras la siguiente ya
            entra: mazo continuo. Visual simplificada (foto + sello + nombre)
            porque a esa velocidad el detalle no se lee — y sale más barato de
            animar que la carta completa. */}
        {leaving && (
          <motion.div
            key={`leaving-${leaving.profile.id}`}
            aria-hidden="true"
            initial={{
              x: leaving.fromX,
              y: leaving.fromY,
              rotate: (leaving.fromX / 220) * 16,
              scale: 1,
              opacity: 1,
            }}
            animate={{
              x: leaving.dir === 'right' ? 420 : leaving.dir === 'left' ? -420 : leaving.fromX * 0.4,
              y: leaving.dir === 'up' ? -420 : 72,
              rotate: leaving.dir === 'right' ? 22 : leaving.dir === 'left' ? -22 : 0,
              scale: 0.9,
              opacity: 0,
            }}
            transition={{ type: 'spring', stiffness: 250, damping: 25 }}
            className="absolute inset-0 z-30 pointer-events-none"
          >
            <div
              className={`relative h-full rounded-[var(--radius-lg)] border overflow-hidden ${
                isLight ? 'bg-white border-[#ffe0ec]' : 'bg-[#0f1a2e] border-[#ec4d86]/30'
              }`}
            >
              {leaving.profile.photos[0]?.url && (
                <img
                  src={leaving.profile.photos[0].url}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center pb-16">
                <StampChip kind={leaving.dir === 'right' ? 'like' : leaving.dir === 'left' ? 'pass' : 'star'} large />
              </div>
              {leaving.label && (
                <div className="absolute inset-x-0 top-[58%] flex justify-center px-8">
                  <p className="text-white text-[13px] font-bold leading-snug text-center drop-shadow-md">
                    Te gustó: {leaving.label}
                  </p>
                </div>
              )}
              <div className="absolute bottom-4 left-5 right-5">
                <p className="text-white text-[20px] font-extrabold tracking-tight truncate drop-shadow-md">
                  {leaving.profile.displayName}, {leaving.profile.age}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Seguridad integrada: reportar o bloquear sin tener que matchear primero. */}
      {currentProfile && (
        <ReportBlockSheet
          open={isReportOpen}
          onOpenChange={setIsReportOpen}
          partnerId={currentProfile.id}
          partnerName={currentProfile.displayName}
          // Si hay un vuelo en curso, el avance ya está programado: no duplicar.
          onActionComplete={() => { if (!actionLock.current) setCurrentIndex((prev) => prev + 1); }}
        />
      )}
    </div>
  );
};
