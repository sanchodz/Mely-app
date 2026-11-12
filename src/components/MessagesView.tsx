import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConnectionStatus, Match, Message } from '../types';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useMarkRead, useMessages, useSendMessage, useSendPhoto, useTypingIndicator, useTypingPing } from '../hooks/useChat';
import { useVisualViewportHeight } from '../hooks/useVisualViewportHeight';
import { useAcceptProposal, useCounterProposal, useProposals } from '../hooks/useDates';
import { ReportBlockSheet } from './ReportBlockSheet';
import { ProfilePhoto } from './ProfilePhoto';
import { EmptyState, ErrorState } from './StateViews';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';

interface MessagesViewProps {
  matches: Match[];
  isLoadingMatches?: boolean;
  activeConnectionId: string | null;
  /** Fragmento que originó el match (pilar 3): el chat vacío lo usa como punto de partida. */
  contextLabel?: string | null;
  onSelectConnection: (connectionId: string | null) => void;
  onOpenProposeModal?: (connectionId: string) => void;
  onOpenIcebreaker?: (partnerName: string) => void;
  onOpenDateQR?: (connectionId: string, partnerName: string, partnerAvatar: string) => void;
  onExploreMore?: () => void;
}

interface WhatsAppSticker {
  id: string;
  packId: string;
  title: string;
  emoji: string;
  badgeText?: string;
  category: string;
}

interface ChatThemePreset {
  id: string;
  name: string;
  description: string;
  accentColor: string;
  userBubbleLight: string;
  userBubbleDark: string;
  wallpaperPattern: 'dots' | 'grid' | 'stars' | 'clean' | 'warm';
  previewBadge: string;
  /** Solo para miembros Findy Black (beneficio del plan). */
  blackOnly?: boolean;
}

const CHAT_THEME_PRESETS: ChatThemePreset[] = [
  {
    id: 'mely-cherry',
    name: 'FINDY Carmesí & Cereza',
    description: 'El estilo original y apasionado de FINDY',
    accentColor: '#ec4d86',
    userBubbleLight: 'bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white border border-[#ffa3c4]/30',
    userBubbleDark: 'bg-gradient-to-r from-[#c9366d] to-[#ec4d86] text-white border border-[#ec4d86]/40',
    wallpaperPattern: 'dots',
    previewBadge: '🌹 Cereza',
  },
  {
    id: 'lavender-cyber',
    name: 'Lavanda & Cyber Romance',
    description: 'Tonos violetas, misterio y poesía contemporánea',
    accentColor: '#b98fd1',
    userBubbleLight: 'bg-[#b98fd1] text-white border border-[#f1e4f7]/30',
    userBubbleDark: 'bg-gradient-to-r from-[#5b3b75] to-[#b98fd1] text-white border border-[#b98fd1]/40',
    wallpaperPattern: 'stars',
    previewBadge: '🔮 Lavanda',
  },
  {
    id: 'emerald-san-telmo',
    name: 'Esmeralda & San Telmo',
    description: 'Frescura botánica y elegancia porteña',
    accentColor: '#3f7a5c',
    userBubbleLight: 'bg-[#3f7a5c] text-white border border-[#dcf0e4]/30',
    userBubbleDark: 'bg-[#3f7a5c] text-white border border-[#3f7a5c]/40',
    wallpaperPattern: 'grid',
    previewBadge: '🌿 Esmeralda',
  },
  {
    id: 'amber-espresso',
    name: 'Café de Especialidad & Caramelo',
    description: 'Cálido, tostado y perfecto para planear una cita',
    accentColor: '#e3b873',
    userBubbleLight: 'bg-gradient-to-r from-[#8a5a28] to-[#e3b873] text-white border border-[#f3e4be]/30',
    userBubbleDark: 'bg-[#8a5a28] text-white border border-[#e3b873]/40',
    wallpaperPattern: 'warm',
    previewBadge: '☕ Caramelo',
  },
  {
    id: 'midnight-sapphire',
    name: 'Zafiro & Noche de Jazz',
    description: 'Azul profundo, introspección y serenidad',
    accentColor: '#2e5570',
    userBubbleLight: 'bg-gradient-to-r from-[#2e5570] to-[#6fa8c9] text-white border border-[#d8ecf5]/30',
    userBubbleDark: 'bg-gradient-to-r from-[#2e5570] to-[#2e5570] text-white border border-[#2e5570]/40',
    wallpaperPattern: 'stars',
    previewBadge: '🌌 Zafiro',
  },
  {
    id: 'minimal-clean',
    name: 'Minimalista & Blanco Puro',
    description: 'Limpio, sobrio y con máxima legibilidad',
    accentColor: '#2e5570',
    userBubbleLight: 'bg-slate-800 text-white',
    userBubbleDark: 'bg-slate-200 text-slate-900',
    wallpaperPattern: 'clean',
    previewBadge: '◻️ Minimal',
  },
  {
    id: 'black-onyx-gold',
    name: 'Ónix & Oro',
    description: 'Negro profundo con filo dorado · exclusivo Black',
    accentColor: '#d9b45c',
    userBubbleLight: 'bg-gradient-to-r from-[#111111] to-[#2b2b2b] text-[#f3e4be] border border-[#d9b45c]/60',
    userBubbleDark: 'bg-gradient-to-r from-[#0b0b0b] to-[#1f1f1f] text-[#f3e4be] border border-[#d9b45c]/70',
    wallpaperPattern: 'stars',
    previewBadge: '🖤 Ónix',
    blackOnly: true,
  },
  {
    id: 'black-champagne',
    name: 'Champagne & Medianoche',
    description: 'Brindis en terraza a la medianoche · exclusivo Black',
    accentColor: '#c9a96e',
    userBubbleLight: 'bg-gradient-to-r from-[#c9a96e] to-[#e8d5a8] text-[#16223b] border border-[#f3e4be]/40',
    userBubbleDark: 'bg-gradient-to-r from-[#16223b] to-[#c9a96e] text-white border border-[#c9a96e]/50',
    wallpaperPattern: 'warm',
    previewBadge: '🥂 Champagne',
    blackOnly: true,
  },
];

const STICKER_PACKS: { id: string; name: string; icon: string; stickers: WhatsAppSticker[] }[] = [
  {
    id: 'pack-romance',
    name: 'FINDY Romance & Café',
    icon: '☕',
    stickers: [
      { id: 'stk-coffee', packId: 'pack-romance', title: '¿Pinta café?', emoji: '☕', badgeText: 'CAFÉ ☕', category: 'romance' },
      { id: 'stk-wine', packId: 'pack-romance', title: 'Brindis Malbec', emoji: '🍷', badgeText: 'VINITO 🍷', category: 'romance' },
      { id: 'stk-spark', packId: 'pack-romance', title: 'Sparks mutuos', emoji: '✨', badgeText: 'SPARK ✨', category: 'romance' },
      { id: 'stk-heart', packId: 'pack-romance', title: 'Flechazo', emoji: '💖', badgeText: 'LOVE 💖', category: 'romance' },
      { id: 'stk-fire', packId: 'pack-romance', title: 'Fuego puro', emoji: '🔥', badgeText: 'FUEGO 🔥', category: 'romance' },
      { id: 'stk-mate', packId: 'pack-romance', title: 'Unos mates', emoji: '🧉', badgeText: 'MATES 🧉', category: 'romance' },
      { id: 'stk-croissant', packId: 'pack-romance', title: 'Medialuna', emoji: '🥐', badgeText: 'MEDIALUNA 🥐', category: 'romance' },
      { id: 'stk-rose', packId: 'pack-romance', title: 'Rosa roja', emoji: '🌹', badgeText: 'PARA VOS 🌹', category: 'romance' },
    ],
  },
  {
    id: 'pack-cats',
    name: 'Gatitos & Reacciones',
    icon: '🐱',
    stickers: [
      { id: 'cat-love', packId: 'pack-cats', title: 'Gato Enamorado', emoji: '😻', badgeText: 'TE QUIERO 😻', category: 'cats' },
      { id: 'cat-coffee', packId: 'pack-cats', title: 'Gato con Café', emoji: '☕🐱', badgeText: 'DESPERTANDO ☕', category: 'cats' },
      { id: 'cat-kiss', packId: 'pack-cats', title: 'Besito Gatuno', emoji: '😽', badgeText: 'BESITO 😽', category: 'cats' },
      { id: 'cat-laugh', packId: 'pack-cats', title: 'Tentado', emoji: '😹', badgeText: 'JAJAJA 😹', category: 'cats' },
      { id: 'cat-cool', packId: 'pack-cats', title: 'Alta facha', emoji: '😎🐱', badgeText: 'ALTA FACHA 😎', category: 'cats' },
      { id: 'cat-shock', packId: 'pack-cats', title: 'Sorprendido', emoji: '🙀', badgeText: '¿QUÉ? 🙀', category: 'cats' },
    ],
  },
  {
    id: 'pack-porteno',
    name: 'Frases Porteñas',
    icon: '🇦🇷',
    stickers: [
      { id: 'fr-deuna', packId: 'pack-porteno', title: '¡De una!', emoji: '🚀', badgeText: '¡DE UNA! 🚀', category: 'porteno' },
      { id: 'fr-vamos', packId: 'pack-porteno', title: '¿Vamos?', emoji: '✨', badgeText: 'CHE, ¿VAMOS? ✨', category: 'porteno' },
      { id: 'fr-banco', packId: 'pack-porteno', title: 'Banco fuerte', emoji: '💪', badgeText: 'BANCO FUERTE 💪', category: 'porteno' },
      { id: 'fr-vinito', packId: 'pack-porteno', title: 'Un vinito y vemos', emoji: '🍷', badgeText: 'UN VINITO Y VEMOS 🍷', category: 'porteno' },
      { id: 'fr-camino', packId: 'pack-porteno', title: 'En camino', emoji: '🛵', badgeText: '¡EN CAMINO! 🛵', category: 'porteno' },
      { id: 'fr-facha', packId: 'pack-porteno', title: 'Tremenda facha', emoji: '🕶️', badgeText: 'TREMENDA FACHA 🕶️', category: 'porteno' },
    ],
  },
];
const ALL_STICKERS = STICKER_PACKS.flatMap((p) => p.stickers);

const QUICK_GIFS = [
  { id: 'gif-1', title: 'Brindis', url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=300&q=80', tag: '🍷 Salud' },
  { id: 'gif-2', title: 'Café Filtro', url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=300&q=80', tag: '☕ Café' },
  { id: 'gif-3', title: 'Flores', url: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=300&q=80', tag: '🌹 Ramo' },
  { id: 'gif-4', title: 'Vinilo', url: 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=300&q=80', tag: '🎵 Música' },
];

const DEFAULT_FREQUENT_EMOJIS = ['☕', '🍷', '✨', '❤️', '🔥', '😂', '🇦🇷', '🥐', '🎶', '😻', '🚀'];

const EMOJI_CATEGORIES = [
  { name: 'Caritas', icon: '😊', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😎', '🥳', '🤩'] },
  { name: 'Romance', icon: '❤️', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💖', '💗', '💌', '💍', '💐', '🌹', '💋'] },
  { name: 'Café & Vino', icon: '☕', emojis: ['☕', '🍵', '🧋', '🍷', '🍸', '🍹', '🥐', '🥖', '🥞', '🍕', '🍰', '🍓'] },
  { name: 'Lugares', icon: '🇦🇷', emojis: ['🇦🇷', '✈️', '🛵', '🚕', '🏛️', '🎭', '🎨', '🎬', '🌃', '🌅', '📷', '📸'] },
];

const CONVERSATION_SPARKS = [
  '☕ ¿Te pinta un café de especialidad esta semana?',
  '🍷 ¡De una! Conozco un bodegón hermoso en San Telmo.',
  '🎵 ¿Qué vinilos estás escuchando últimamente?',
  '🎨 ¿Conocés la muestra nueva del MALBA?',
];

// Progreso de la conexión — del diseño Premium aprobado (Conversation.dc.html): una
// barra de 6 etapas que le muestra a la pareja en qué punto está la conexión, del
// primer match a la segunda cita. No existía en el chat implementado; se agrega acá
// sin tocar el resto de la lógica.
const CONNECTION_STAGE_ORDER: ConnectionStatus[] = ['MATCH', 'TALKING', 'PROPOSAL', 'DATE_AGREED', 'DATE_VERIFIED', 'SECOND_DATE'];
const CONNECTION_STAGE_NAMES: Record<ConnectionStatus, string> = {
  MATCH: 'Match',
  TALKING: 'Hablando',
  PROPOSAL: 'Propuesta',
  DATE_AGREED: 'Cita acordada',
  DATE_VERIFIED: 'Cita verificada',
  SECOND_DATE: 'Segunda cita',
  INACTIVE: 'Inactiva',
};

const SAFETY_TIPS = [
  { icon: 'groups', text: 'Elegí siempre un lugar público para la primera cita — nunca tu casa ni la de tu match.' },
  { icon: 'share_location', text: 'Contale a un amigo o familiar dónde y con quién vas a estar.' },
  { icon: 'videocam', text: 'Hacé una videollamada antes de encontrarte en persona, para confirmar que es quien dice ser.' },
  { icon: 'qr_code_2', text: 'Usá el check-in con QR de FINDY al llegar: así verificamos que la cita fue real y segura.' },
  { icon: 'payments', text: 'Nunca envíes dinero ni datos bancarios a alguien que conociste en la app.' },
  { icon: 'favorite', text: 'Si algo no te cierra, confiá en tu instinto — podés terminar la charla o la cita cuando quieras.' },
];

const STICKER_MARK = '::sticker::';
const GIF_MARK = '::gif::';

function parseSticker(body: string): WhatsAppSticker | null {
  if (!body.startsWith(STICKER_MARK)) return null;
  return ALL_STICKERS.find((s) => s.id === body.slice(STICKER_MARK.length)) ?? null;
}

function parseGif(body: string): (typeof QUICK_GIFS)[number] | null {
  if (!body.startsWith(GIF_MARK)) return null;
  return QUICK_GIFS.find((g) => g.id === body.slice(GIF_MARK.length)) ?? null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-AR', { hour: 'numeric', minute: '2-digit' });
}

// Un solo sello por nombre: antes se apilaban dos íconos "verified" (citas +
// identidad) al lado de cada nombre y hacían ruido. El color dice cuál es el
// nivel más alto (coral = citas verificadas) y el title conserva el detalle.
const VerifiedMark: React.FC<{ badges: { trusted: boolean; verified: boolean }; size?: number; className?: string }> = ({ badges, size = 15, className = '' }) => {
  if (!badges.trusted && !badges.verified) return null;
  const title = badges.trusted && badges.verified ? 'Identidad y citas verificadas' : badges.trusted ? 'Citas verificadas' : 'Identidad verificada';
  return (
    <span
      className={`material-symbols-outlined shrink-0 ${badges.trusted ? 'text-[#ec4d86]' : 'text-sky-400'} ${className}`}
      style={{ fontSize: size, fontVariationSettings: "'FILL' 1" }}
      title={title}
      aria-label={title}
    >
      verified
    </span>
  );
};

export const MessagesView: React.FC<MessagesViewProps> = ({
  matches,
  isLoadingMatches = false,
  activeConnectionId,
  contextLabel,
  onSelectConnection,
  onOpenProposeModal,
  onOpenIcebreaker,
  onOpenDateQR,
  onExploreMore,
}) => {
  const { isLight } = useTheme();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'inbox' | 'chat'>(activeConnectionId ? 'chat' : 'inbox');
  // El "atrás" del sistema cierra el chat desde afuera (App limpia activeConnectionId).
  useEffect(() => {
    if (!activeConnectionId) setViewMode('inbox');
  }, [activeConnectionId]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');

  const [activeMediaTray, setActiveMediaTray] = useState<'sparks' | 'emojis' | 'stickers' | 'gifs' | null>(null);
  const [selectedStickerPackId, setSelectedStickerPackId] = useState<string>('pack-romance');
  const [favoriteStickerIds, setFavoriteStickerIds] = useState<string[]>(['stk-coffee', 'stk-spark']);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [activeReactionMenuMsgId, setActiveReactionMenuMsgId] = useState<string | null>(null);
  const [activeOptionsMenuMsgId, setActiveOptionsMenuMsgId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [selectedStickerDetail, setSelectedStickerDetail] = useState<WhatsAppSticker | null>(null);

  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearchTerm, setInChatSearchTerm] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'dates'>('all');

  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showContactInfoDrawer, setShowContactInfoDrawer] = useState(false);
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  const [showSafetyTips, setShowSafetyTips] = useState(false);
  const [showReportBlock, setShowReportBlock] = useState(false);

  const [selectedThemeId, setSelectedThemeId] = useState<string>(() => {
    try {
      return localStorage.getItem('mely_chat_theme_id') || 'mely-cherry';
    } catch {
      return 'mely-cherry';
    }
  });
  const [customColor, setCustomColor] = useState<string>(() => {
    try {
      return localStorage.getItem('mely_chat_custom_color') || '';
    } catch {
      return '';
    }
  });
  const [customPattern, setCustomPattern] = useState<'dots' | 'grid' | 'stars' | 'clean' | 'warm'>(() => {
    try {
      return (localStorage.getItem('mely_chat_wallpaper_pattern') as 'dots' | 'grid' | 'stars' | 'clean' | 'warm') || 'dots';
    } catch {
      return 'dots';
    }
  });

  const [localReactions, setLocalReactions] = useState<Record<string, string>>({});
  const [starredMsgIds, setStarredMsgIds] = useState<string[]>([]);
  // Quién no quiere ver la tarjeta de "próxima cita" la puede ocultar; queda oculta
  // (por id de propuesta, no de conexión) hasta que haya una propuesta nueva.
  const [hiddenProposalIds, setHiddenProposalIds] = useState<string[]>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem('mely_hidden_proposals') ?? '[]');
      // Storage corrupto (objeto, número…) rompía el render al hacer spread/filter.
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const dismissProposalCard = (id: string) => {
    sounds.playClick();
    setHiddenProposalIds((prev) => {
      const next = [...new Set([...prev, id])];
      localStorage.setItem('mely_hidden_proposals', JSON.stringify(next));
      return next;
    });
  };
  const restoreProposalCard = (id: string) => {
    sounds.playClick();
    setHiddenProposalIds((prev) => {
      const next = prev.filter((pid) => pid !== id);
      localStorage.setItem('mely_hidden_proposals', JSON.stringify(next));
      return next;
    });
  };
  // Emojis usados de verdad (no una lista fija) — como en el "Frecuentes" real de WhatsApp.
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem('mely_recent_emojis') ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Autoscroll inteligente: si estás leyendo arriba, los mensajes nuevos NO
  // te arrastran al fondo — se avisa con una píldora "nuevos ↓". El ref evita
  // re-renders en cada evento de scroll; el estado solo cambia al llegar
  // mensajes o al tocar la píldora.
  const isNearBottomRef = useRef(true);
  const prevMessagesLength = useRef(0);
  const [newBelowCount, setNewBelowCount] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Mantenía dos botones (reaccionar + opciones) siempre visibles al lado de CADA mensaje
  // — mucho ruido comparado con WhatsApp/Telegram, que no muestran nada hasta que mantenés
  // presionado. Acá se reemplaza por un long-press real que abre las dos cosas juntas.
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const startLongPress = (msgId: string) => {
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      sounds.playClick();
      setActiveReactionMenuMsgId(msgId);
      setActiveOptionsMenuMsgId(msgId);
    }, 420);
  };
  const cancelLongPress = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  const activeMatch: Match | null = matches.find((m) => m.id === activeConnectionId) ?? null;

  const { data: messagesData, isLoading: isLoadingMessages, error: messagesError, refetch: refetchMessages } = useMessages(activeConnectionId);
  const messages = useMemo(() => messagesData?.messages ?? [], [messagesData]);
  const { data: proposals = [], isLoading: isLoadingProposals } = useProposals(activeConnectionId);
  const activeProposal = useMemo(
    () => [...proposals].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).find((p) => p.status !== 'DECLINED' && p.status !== 'EXPIRED'),
    [proposals],
  );

  const sendMessage = useSendMessage(activeConnectionId ?? '');
  const sendPhoto = useSendPhoto(activeConnectionId ?? '');
  const markRead = useMarkRead(activeConnectionId);
  const acceptProposal = useAcceptProposal();
  const counterProposal = useCounterProposal();
  const [counterFormOpen, setCounterFormOpen] = useState(false);
  const [counterAt, setCounterAt] = useState('');
  const isPartnerTyping = useTypingIndicator(activeConnectionId);
  const pingTyping = useTypingPing(activeConnectionId);

  // Facilitador de plan: si la charla ya tiene cuerpo (6+ mensajes) y todavía no
  // hay propuesta a la vista, se sugiere el siguiente paso una sola vez por
  // sesión y conexión — ataca la muerte de conversaciones sin ser insistente.
  const [planNudgeClosed, setPlanNudgeClosed] = useState(false);
  useEffect(() => {
    setPlanNudgeClosed(false);
  }, [activeConnectionId]);
  const planNudgeDismissed = (() => {
    try {
      return sessionStorage.getItem(`mely-plan-nudge:${activeConnectionId}`) === '1';
    } catch {
      return true;
    }
  })();
  const showPlanNudge =
    viewMode === 'chat' &&
    !isLoadingProposals &&
    messages.length >= 6 &&
    !activeProposal &&
    !planNudgeClosed &&
    !planNudgeDismissed;
  const dismissPlanNudge = () => {
    sounds.playClick();
    setPlanNudgeClosed(true);
    try {
      sessionStorage.setItem(`mely-plan-nudge:${activeConnectionId}`, '1');
    } catch {
      /* sin sessionStorage se oculta igual esta vez */
    }
  };
  // El contenedor del chat usa --vvh para seguir al teclado móvil.
  useVisualViewportHeight(viewMode === 'chat');

  const isBlackMember = user?.membership.tier === 'FOUNDING';
  // Un tema exclusivo guardado deja de aplicarse si el plan Black venció.
  const currentTheme =
    CHAT_THEME_PRESETS.find((t) => t.id === selectedThemeId && (!t.blackOnly || isBlackMember)) || CHAT_THEME_PRESETS[0];

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  const handleMessagesScroll = () => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    isNearBottomRef.current = nearBottom;
    // Si bajó por su cuenta hasta el fondo, la píldora ya no tiene sentido.
    if (nearBottom) setNewBelowCount(0);
  };

  const jumpToLatest = () => {
    sounds.playClick();
    setNewBelowCount(0);
    isNearBottomRef.current = true;
    scrollToBottom('smooth');
  };

  useEffect(() => {
    if (viewMode !== 'chat') return;
    // Al abrir (o cambiar de conversación) se arranca abajo, sin animación.
    isNearBottomRef.current = true;
    setNewBelowCount(0);
    prevMessagesLength.current = 0;
    scrollToBottom('auto');
  }, [viewMode, activeConnectionId]);

  useEffect(() => {
    setCounterFormOpen(false);
    setCounterAt('');
  }, [activeConnectionId, activeProposal?.id]);

  // Llegadas nuevas: mis mensajes siempre bajan; los de mi match solo si
  // ya estaba al fondo — si no, suman a la píldora "nuevos ↓".
  useEffect(() => {
    if (viewMode !== 'chat') {
      prevMessagesLength.current = messages.length;
      return;
    }
    if (messages.length > prevMessagesLength.current) {
      const last = messages[messages.length - 1];
      const mine = last?.senderId === user?.id;
      if (mine || isNearBottomRef.current) {
        scrollToBottom('smooth');
        setNewBelowCount(0);
      } else {
        setNewBelowCount((c) => c + (messages.length - prevMessagesLength.current));
      }
    }
    prevMessagesLength.current = messages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, viewMode]);

  // El "escribiendo..." solo re-acomoda si ya estabas al fondo.
  useEffect(() => {
    if (viewMode === 'chat' && isNearBottomRef.current) scrollToBottom('smooth');
  }, [isPartnerTyping, activeMediaTray, viewMode]);

  useEffect(() => {
    if (viewMode === 'chat' && activeConnectionId && messages.some((m) => m.senderId !== user?.id && !m.readAt)) {
      markRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeConnectionId, messages.length]);

  const getWallpaperStyle = (): React.CSSProperties => {
    const accent = customColor || currentTheme.accentColor;
    switch (customPattern) {
      case 'grid':
        return {
          backgroundImage: isLight
            ? `linear-gradient(to right, #efe7d8 1px, transparent 1px), linear-gradient(to bottom, #efe7d8 1px, #fcf9f2 1px)`
            : `linear-gradient(to right, rgba(225,29,72,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(225,29,72,0.12) 1px, #0a1120 1px)`,
          backgroundSize: '24px 24px',
        };
      case 'stars':
        return {
          backgroundImage: isLight
            ? `radial-gradient(${accent} 0.5px, transparent 0.5px), radial-gradient(#d8ecf5 0.5px, #fcf9f2 0.5px)`
            : `radial-gradient(#f1e4f7 0.6px, transparent 0.6px), radial-gradient(#5b3b75 0.6px, #0a1120 0.6px)`,
          backgroundSize: '28px 28px, 14px 14px',
        };
      case 'warm':
        return {
          backgroundImage: isLight
            ? `radial-gradient(${accent} 0.5px, #efe7d8 0.5px)`
            : `radial-gradient(#8a5a28 0.6px, #0a1120 0.6px)`,
          backgroundSize: '22px 22px',
        };
      case 'clean':
        return { backgroundColor: isLight ? '#fcf9f2' : '#0a1120' };
      case 'dots':
      default:
        return {
          backgroundImage: isLight
            ? `radial-gradient(${accent} 0.45px, transparent 0.45px), radial-gradient(#d8ecf5 0.45px, #fcf9f2 0.45px)`
            : `radial-gradient(${accent} 0.5px, transparent 0.5px), radial-gradient(#17233d 0.5px, #0a1120 0.5px)`,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 10px 10px',
        };
    }
  };

  // El redondeo (rounded-[18px]) se aplica una sola vez en el wrapper de la burbuja;
  // la "cola" (esquina de 6px) la decide el agrupado por remitente en el render —
  // solo el último mensaje seguido de la misma persona la lleva, estilo iMessage/Telegram.
  const getUserBubbleClass = () =>
    customColor ? 'text-white shadow-elevation-sm' : isLight ? currentTheme.userBubbleLight : currentTheme.userBubbleDark;
  const getPartnerBubbleClass = () =>
    isLight
      ? 'bg-white text-[#16223b] shadow-elevation-sm'
      : 'bg-[#1f2e4c] text-[#f5f1e8]';

  const handleApplyTheme = (themeId: string) => {
    sounds.playClick();
    setSelectedThemeId(themeId);
    setCustomColor('');
    const matched = CHAT_THEME_PRESETS.find((t) => t.id === themeId);
    try {
      localStorage.setItem('mely_chat_theme_id', themeId);
      localStorage.removeItem('mely_chat_custom_color');
      if (matched) {
        setCustomPattern(matched.wallpaperPattern);
        localStorage.setItem('mely_chat_wallpaper_pattern', matched.wallpaperPattern);
      }
    } catch {
      /* localStorage no disponible */
    }
  };
  const handleApplyCustomColor = (hex: string) => {
    sounds.playClick();
    setCustomColor(hex);
    try {
      localStorage.setItem('mely_chat_custom_color', hex);
    } catch {
      /* localStorage no disponible */
    }
  };
  const handleApplyPattern = (pattern: 'dots' | 'grid' | 'stars' | 'clean' | 'warm') => {
    sounds.playClick();
    setCustomPattern(pattern);
    try {
      localStorage.setItem('mely_chat_wallpaper_pattern', pattern);
    } catch {
      /* localStorage no disponible */
    }
  };

  const handleOpenConversation = (connectionId: string) => {
    sounds.playClick();
    onSelectConnection(connectionId);
    setViewMode('chat');
    setActiveMediaTray(null);
    setShowAttachmentMenu(false);
    setReplyingTo(null);
  };

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || !activeConnectionId || sendMessage.isPending) return;
    sounds.playClick();
    // Limpieza optimista (se siente instantáneo), pero si el envío falla el
    // texto se restaura — antes se perdía para siempre.
    setInputText('');
    setActiveMediaTray(null);
    setShowAttachmentMenu(false);
    const replyId = replyingTo?.id;
    sendMessage.mutate(
      { body: text, replyToId: replyId },
      {
        onError: () => {
          setInputText(text);
          toast.error('No se pudo enviar', { description: 'Revisá tu conexión e intentá de nuevo.' });
        },
      },
    );
    setReplyingTo(null);
    inputRef.current?.focus();
  };

  const handleSendSticker = (sticker: WhatsAppSticker) => {
    if (!activeConnectionId) return;
    sounds.playStamp();
    setActiveMediaTray(null);
    sendMessage.mutate({ body: `${STICKER_MARK}${sticker.id}` });
  };

  const handleSendGif = (gif: (typeof QUICK_GIFS)[number]) => {
    if (!activeConnectionId) return;
    sounds.playStamp();
    setActiveMediaTray(null);
    sendMessage.mutate({ body: `${GIF_MARK}${gif.id}` });
  };

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeConnectionId) return;
    sounds.playStamp();
    setShowAttachmentMenu(false);
    // Sin onError la foto fallida moría en silencio: el usuario tocaba enviar y no pasaba nada.
    sendPhoto.mutate(file, {
      onError: (err) => {
        toast.error('No se pudo enviar la foto', {
          description: err instanceof Error && err.message ? err.message : 'Revisá tu conexión e intentá de nuevo.',
        });
      },
    });
  };

  const handleToggleReaction = (msgId: string, emoji: string) => {
    sounds.playClick();
    setLocalReactions((prev) => ({ ...prev, [msgId]: prev[msgId] === emoji ? '' : emoji }));
    setActiveReactionMenuMsgId(null);
  };
  const handleToggleStar = (msgId: string) => {
    sounds.playClick();
    setStarredMsgIds((prev) => (prev.includes(msgId) ? prev.filter((id) => id !== msgId) : [...prev, msgId]));
    setActiveOptionsMenuMsgId(null);
  };
  const handleToggleFavoriteSticker = (stickerId: string) => {
    sounds.playClick();
    setFavoriteStickerIds((prev) => (prev.includes(stickerId) ? prev.filter((id) => id !== stickerId) : [...prev, stickerId]));
  };
  const handleInsertEmoji = (emoji: string) => {
    sounds.playClick();
    setInputText((prev) => prev + emoji);
    setRecentEmojis((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 24);
      localStorage.setItem('mely_recent_emojis', JSON.stringify(next));
      return next;
    });
    inputRef.current?.focus();
  };
  const handleBackspaceEmoji = () => {
    sounds.playClick();
    // Borra el último "carácter" completo (un emoji puede ocupar más de un code unit).
    setInputText((prev) => (prev ? [...prev].slice(0, -1).join('') : prev));
    inputRef.current?.focus();
  };

  // Memoizados: el componente re-renderiza en cada tecla del input — sin esto
  // se recorrían ambas listas completas por cada carácter escrito.
  const filteredMatches = useMemo(() => matches.filter((m) => {
    const q = searchQuery.toLowerCase();
    if (q && !m.other.displayName.toLowerCase().includes(q)) return false;
    if (inboxFilter === 'unread') return m.unread > 0;
    if (inboxFilter === 'dates') return m.status === 'PROPOSAL' || m.status === 'DATE_AGREED' || m.status === 'DATE_VERIFIED' || m.status === 'SECOND_DATE';
    return true;
  }), [matches, searchQuery, inboxFilter]);

  const filteredMessages = useMemo(() => messages.filter((m) => {
    if (!inChatSearchTerm.trim()) return true;
    const q = inChatSearchTerm.toLowerCase();
    return m.body.toLowerCase().includes(q);
  }), [messages, inChatSearchTerm]);

  const currentPack = STICKER_PACKS.find((p) => p.id === selectedStickerPackId) || STICKER_PACKS[0];
  const favoriteStickers = ALL_STICKERS.filter((s) => favoriteStickerIds.includes(s.id));

  // =========================================================================
  // VIEW: INBOX
  // =========================================================================
  if (viewMode === 'inbox' || !activeMatch) {
    // Altura flexible en vez del número mágico 100dvh-130px: el <main> de App
    // ya descuenta header/nav con padding, así que flex-1 llena exacto en
    // cualquier viewport (320px o tablet) sin adivinar la altura del chrome.
    return (
      <div className="flex flex-col w-full flex-1 min-h-[320px] animate-fadeIn">
        {/* Búsqueda y filtros quedan pegados arriba mientras se scrollea la lista — sin
            repetir el título "FINDY Chat" que ya muestra el TopAppBar de la app. */}
        <div className="shrink-0 px-1 pt-1 pb-2 flex flex-col gap-3">
          <div className="relative flex items-center">
            <span className={`material-symbols-outlined absolute left-4 text-[20px] pointer-events-none ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>search</span>
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar un chat"
              className={`pl-11 pr-4 h-12 text-[14px] rounded-full border shadow-none ${
                isLight ? 'bg-white border-[#ffe0ec] placeholder:text-[#5b6478]/70' : 'bg-[#131f36] border-white/8 text-[#f5f1e8] placeholder:text-[#a9b2c9]/70'
              }`}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            {[
              { id: 'all', label: 'Todos', count: matches.length },
              { id: 'unread', label: 'No leídos', count: matches.filter((m) => m.unread > 0).length },
              { id: 'dates', label: 'Con cita', icon: 'local_cafe', count: matches.filter((m) => m.status === 'PROPOSAL' || m.status === 'DATE_AGREED').length },
            ].map((chip) => {
              const isSelected = inboxFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => {
                    sounds.playClick();
                    setInboxFilter(chip.id as 'all' | 'unread' | 'dates');
                  }}
                  aria-pressed={isSelected}
                  className={`h-9 pl-3.5 pr-3 rounded-full text-[12.5px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all border active:scale-95 ${
                    isSelected
                      ? 'bg-[#ec4d86] text-white border-transparent shadow-elevation-sm'
                      : isLight
                      ? 'bg-white text-[#2e5570] border-[#ffe0ec]'
                      : 'bg-[#131f36] text-[#f5f1e8]/85 border-white/8'
                  }`}
                >
                  {chip.icon && <span className="material-symbols-outlined text-[15px] -ml-0.5">{chip.icon}</span>}
                  <span>{chip.label}</span>
                  {chip.count > 0 && (
                    <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10.5px] font-bold flex items-center justify-center ${isSelected ? 'bg-white/25 text-white' : isLight ? 'bg-[#efe7d8] text-[#16223b]' : 'bg-white/10 text-[#f5f1e8]'}`}>{chip.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="pb-2">
            {isLoadingMatches && matches.length === 0 ? (
              <div className="space-y-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-full px-2 py-3 flex items-center gap-3.5">
                    <Skeleton className="w-14 h-14 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredMatches.length === 0 ? (
              matches.length === 0 ? (
                <EmptyState
                  compact
                  icon="forum"
                  title="Sin conversaciones todavía"
                  body="Cuando hagas match con alguien, tu chat aparece acá."
                  actions={
                    onExploreMore
                      ? [{ label: 'Ir a Descubrir', onClick: onExploreMore, icon: 'explore' }]
                      : []
                  }
                />
              ) : (
                <EmptyState
                  compact
                  icon="search_off"
                  title="Sin resultados"
                  body="Ninguna conversación coincide con esa búsqueda o filtro."
                  actions={[
                    { label: 'Limpiar filtros', onClick: () => { setSearchQuery(''); setInboxFilter('all'); }, icon: 'close', variant: 'secondary' },
                  ]}
                />
              )
            ) : (
              filteredMatches.map((match, idx) => {
                const hasUnread = match.unread > 0;
                const isLast = idx === filteredMatches.length - 1;
                return (
                <button
                  key={match.id}
                  onClick={() => handleOpenConversation(match.id)}
                  className={`relative w-full px-2 py-3 rounded-2xl flex items-center gap-3.5 transition-colors text-left group active:scale-[0.99] ${
                    isLight ? 'hover:bg-[#fcf9f2] active:bg-[#efe7d8]' : 'hover:bg-[#0f1a2e] active:bg-white/5'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className={`w-14 h-14 rounded-full overflow-hidden ${hasUnread ? 'ring-2 ring-[#ec4d86] ring-offset-2' : ''} ${isLight ? 'ring-offset-[#fcf9f2]' : 'ring-offset-[#0a1120]'}`}>
                      <ProfilePhoto url={match.other.photos[0]?.url} name={match.other.displayName} className="w-full h-full" />
                    </div>
                    {match.other.lastActive === 'En línea' && (
                      <span className={`absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ${isLight ? 'ring-[#fcf9f2]' : 'ring-[#0a1120]'}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-1 min-w-0">
                        <h3 className={`text-[15px] leading-tight truncate ${hasUnread ? 'font-bold' : 'font-semibold'} ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>{match.other.displayName}</h3>
                        <VerifiedMark badges={match.other.badges} size={15} />
                      </div>
                      {match.lastMessageAt && (
                        <span className={`text-[11px] shrink-0 tabular-nums ${hasUnread ? 'font-semibold text-[#ec4d86]' : isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                          {formatTime(match.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className={`text-[13px] leading-snug truncate ${hasUnread ? (isLight ? 'font-medium text-[#16223b]' : 'font-medium text-[#f5f1e8]/90') : isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                        {match.status === 'MATCH' ? '¡Comenzá la conversación!' : match.label}
                      </p>
                      {hasUnread && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#ec4d86] text-white text-[11px] font-bold flex items-center justify-center shrink-0 tabular-nums">
                          {match.unread}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Hairline entre filas, alineado con el texto (no con el avatar). */}
                  {!isLast && <span className={`absolute bottom-0 left-[74px] right-2 h-px ${isLight ? 'bg-[#16223b]/8' : 'bg-white/8'}`} aria-hidden="true" />}
                </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: ACTIVE CHAT
  // =========================================================================
  const partner = activeMatch.other;
  const connectionStageIndex = Math.max(0, CONNECTION_STAGE_ORDER.indexOf(activeMatch.status));
  const conversationSparkChips = CONVERSATION_SPARKS.slice(0, 2);

  return (
    // Sin rounded/border/shadow acá: en isChatDetail (App.tsx) se saca la topbar/navbar y el
    // padding del <main> para que el chat sea de borde a borde, como cualquier chat nativo
    // (WhatsApp/Telegram/iMessage) — quedaba flotando como una tarjeta si se lo bordeaba.
    <div
      // --vvh sigue al teclado (ver useVisualViewportHeight): con el teclado
      // abierto el contenedor se achica y el composer queda visible en vez de
      // tapado. Fallback a 100dvh donde no hay visualViewport.
      className={`flex flex-col h-[calc(var(--vvh,100dvh)-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full overflow-hidden relative animate-fadeIn ${
        isLight ? 'bg-[#efe7d8]' : 'bg-[#0a1120]'
      }`}
    >
      <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoSelected} />

      {/* Header */}
      <div className={`pl-1 pr-2 border-b flex items-center justify-between gap-1 shrink-0 relative z-30 liquid-glass min-h-[60px] ${isLight ? 'bg-white/75 border-[#16223b]/8' : 'bg-[#0f1a2e]/75 border-white/8'}`}>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Button variant="tertiary" size="icon" onClick={() => { sounds.playClick(); setViewMode('inbox'); setActiveMediaTray(null); onSelectConnection(null); }} className={`tap-target h-11 w-11 rounded-full shrink-0 ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`} title="Volver" aria-label="Volver a la lista de chats">
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </Button>

          <button type="button" onClick={() => setShowContactInfoDrawer(true)} aria-label={`Ver info de ${partner.displayName}`} className="relative group shrink-0 rounded-full">
            <Avatar className="w-10 h-10 group-hover:scale-105 transition-transform">
              <AvatarImage src={partner.photos[0]?.url} alt={partner.displayName} />
              <AvatarFallback>{partner.displayName.slice(0, 2)}</AvatarFallback>
            </Avatar>
            {partner.lastActive === 'En línea' && <span className={`absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ${isLight ? 'ring-white' : 'ring-[#0f1a2e]'}`} aria-hidden="true" />}
          </button>

          <button type="button" onClick={() => setShowContactInfoDrawer(true)} aria-label={`Ver info de ${partner.displayName}`} className="flex flex-col min-w-0 flex-1 text-left py-1">
            <div className="flex items-center gap-1 min-w-0">
              <span className={`text-[15px] font-bold leading-tight truncate ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>{partner.displayName}</span>
              <VerifiedMark badges={partner.badges} size={15} />
            </div>
            <div className="text-[11.5px] leading-tight truncate mt-0.5">
              {isPartnerTyping ? (
                <span className="text-[#ec4d86] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#ec4d86] rounded-full animate-bounce" />escribiendo…
                </span>
              ) : (
                <span className={`truncate ${partner.lastActive === 'En línea' ? 'text-emerald-500 font-medium' : isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>{partner.lastActive === 'En línea' ? 'En línea' : partner.lastActive}</span>
              )}
            </div>
          </button>
        </div>

        {/* Solo las 2 acciones más contextuales quedan siempre visibles (proponer cita y
            estado de verificación) — Ruleta y Personalizar tema se mudan al menú "⋮" de
            abajo. Antes, con las 4 juntas + badge + menú, el nombre/estado de la izquierda
            se comprimía a 0px de ancho en pantallas angostas y quedaba pegado al avatar. */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Consejos de seguridad — del diseño Premium aprobado: un botón siempre visible
              en el header del chat (antes esta info de confianza no existía en ningún lado
              de la conversación). */}
          <Button
            variant="tertiary"
            size="icon"
            onClick={() => { sounds.playClick(); setShowSafetyTips(true); }}
            className={`h-11 w-11 rounded-full ${isLight ? 'text-[#2e5570]' : 'text-[#f5f1e8]/80'}`}
            title="Consejos de seguridad"
            aria-label="Consejos de seguridad"
          >
            <span className="material-symbols-outlined text-[22px]">shield</span>
          </Button>
          {onOpenProposeModal && (
            <Button size="sm" onClick={() => { sounds.playStamp(); onOpenProposeModal(activeMatch.id); }} className="h-9 pl-3 pr-3.5 rounded-full text-[12.5px] font-bold flex items-center gap-1 shrink-0">
              <span className="material-symbols-outlined text-[16px]">local_cafe</span>
              <span>Cita</span>
            </Button>
          )}
          {onOpenDateQR && (activeMatch.status === 'DATE_AGREED' || activeMatch.status === 'DATE_VERIFIED' || activeMatch.status === 'SECOND_DATE') && (
            <button
              onClick={() => { sounds.playScanBeep(); onOpenDateQR(activeMatch.id, partner.displayName, partner.photos[0]?.url ?? ''); }}
              className={`h-9 px-2.5 rounded-full text-[11.5px] font-bold flex items-center gap-1 border transition-all shrink-0 ${
                activeMatch.status === 'DATE_VERIFIED' || activeMatch.status === 'SECOND_DATE' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'bg-[#ec4d86]/10 text-[#ec4d86] border-[#ec4d86]/30 animate-pulse'
              }`}
              title="Ver Pase QR"
            >
              <span className="material-symbols-outlined text-[15px]">{activeMatch.status === 'DATE_VERIFIED' || activeMatch.status === 'SECOND_DATE' ? 'verified' : 'qr_code_2'}</span>
              <span>{activeMatch.status === 'DATE_VERIFIED' || activeMatch.status === 'SECOND_DATE' ? 'Verificada' : 'Pase QR'}</span>
            </button>
          )}
          <div className="relative shrink-0">
            <Button variant="tertiary" size="icon" onClick={() => setShowHeaderMenu(!showHeaderMenu)} className={`h-11 w-11 rounded-full ${isLight ? 'text-[#2e5570]' : 'text-[#f5f1e8]/80'}`} title="Más opciones" aria-label="Más opciones">
              <span className="material-symbols-outlined text-[22px]">more_vert</span>
            </Button>
            {showHeaderMenu && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowHeaderMenu(false)} />
                <div className={`absolute right-0 top-12 w-64 rounded-2xl shadow-2xl border p-1.5 z-50 animate-scaleUp ${isLight ? 'bg-white border-[#16223b]/8 text-[#16223b]' : 'bg-[#131f36] border-white/10 text-[#f5f1e8]'}`}>
                  {[
                    { icon: 'account_circle', label: `Ver perfil de ${partner.displayName}`, onClick: () => setShowContactInfoDrawer(true) },
                    { icon: 'search', label: 'Buscar en este chat', onClick: () => setInChatSearchOpen(!inChatSearchOpen) },
                    { icon: 'auto_awesome', label: 'Panel de stickers', onClick: () => setActiveMediaTray('stickers') },
                    ...(onOpenIcebreaker ? [{ icon: 'casino', label: 'Ruleta de preguntas', onClick: () => onOpenIcebreaker(partner.displayName) }] : []),
                    { icon: 'palette', label: 'Personalizar tema', onClick: () => setShowThemeCustomizer(true) },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => { setShowHeaderMenu(false); item.onClick(); }}
                      className={`w-full text-left px-3 h-11 text-[13.5px] font-medium rounded-xl flex items-center gap-3 ${isLight ? 'hover:bg-[#fcf9f2]' : 'hover:bg-white/8'}`}
                    >
                      <span className="material-symbols-outlined text-[20px] text-[#ec4d86]">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                  <div className={`my-1 h-px ${isLight ? 'bg-[#16223b]/8' : 'bg-white/10'}`} />
                  <button onClick={() => { setShowHeaderMenu(false); setShowReportBlock(true); }} className={`w-full text-left px-3 h-11 text-[13.5px] font-medium rounded-xl flex items-center gap-3 text-red-500 ${isLight ? 'hover:bg-red-50' : 'hover:bg-red-500/10'}`}>
                    <span className="material-symbols-outlined text-[20px]">flag</span>
                    <span>Reportar o bloquear</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progreso de la conexión — barra de 6 etapas del diseño Premium aprobado. */}
      <div className={`px-4 pt-2.5 pb-2 shrink-0 flex items-center gap-3 relative z-20 ${isLight ? 'bg-[#efe7d8]' : 'bg-[#0a1120]'}`}>
        <div className="flex gap-1 flex-1" role="img" aria-label={`Etapa ${connectionStageIndex + 1} de ${CONNECTION_STAGE_ORDER.length}: ${CONNECTION_STAGE_NAMES[activeMatch.status]}`}>
          {CONNECTION_STAGE_ORDER.map((stage, i) => (
            <span
              key={stage}
              className="flex-1 h-1.5 rounded-full transition-colors"
              style={{ background: i <= connectionStageIndex ? '#ec4d86' : isLight ? 'rgba(22,34,59,0.12)' : 'rgba(255,255,255,0.1)' }}
            />
          ))}
        </div>
        <span className={`text-[11px] font-semibold shrink-0 tabular-nums ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
          {CONNECTION_STAGE_NAMES[activeMatch.status]} · {connectionStageIndex + 1}/{CONNECTION_STAGE_ORDER.length}
        </span>
      </div>

      {inChatSearchOpen && (
        <div className={`px-3 py-2 border-b flex items-center gap-2 animate-fadeIn z-20 ${isLight ? 'bg-[#fcf9f2] border-[#16223b]/8' : 'bg-[#0f1a2e] border-white/8'}`}>
          <span className="material-symbols-outlined text-[20px] text-[#ec4d86]">search</span>
          <input
            type="text"
            value={inChatSearchTerm}
            onChange={(e) => setInChatSearchTerm(e.target.value)}
            placeholder="Buscar en este chat"
            className={`flex-1 h-10 text-[14px] bg-transparent border-0 focus:outline-none ${isLight ? 'text-[#16223b] placeholder:text-[#5b6478]/70' : 'text-white placeholder:text-[#a9b2c9]/70'}`}
            autoFocus
          />
          <Button variant="tertiary" size="sm" onClick={() => setInChatSearchOpen(false)} className="h-9 px-3 text-[13px] font-bold text-[#ec4d86]">Listo</Button>
        </div>
      )}

      {/* Facilitador de plan: la charla tiene cuerpo pero nadie propuso nada todavía. */}
      {showPlanNudge && (
        <div className={`px-3 pt-1 pb-1 shrink-0 ${isLight ? 'bg-[#efe7d8]' : 'bg-[#0a1120]'}`}>
          <div
            className={`p-3 rounded-2xl border flex items-center gap-3 animate-fadeIn ${
              isLight ? 'bg-white border-[#16223b]/8 shadow-elevation-sm' : 'bg-[#131f36] border-white/8'
            }`}
          >
            <span className="w-10 h-10 rounded-xl bg-[#ec4d86]/12 text-[#ec4d86] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">local_cafe</span>
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-[13.5px] font-bold leading-tight ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
                La charla viene bien…
              </p>
              <p className={`text-[12px] mt-0.5 truncate ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                ¿La bajamos a un plan real con {partner.displayName.split(' ')[0]}?
              </p>
            </div>
            {onOpenProposeModal && (
              <button
                type="button"
                onClick={() => {
                  sounds.playStamp();
                  onOpenProposeModal(activeMatch.id);
                }}
                className="h-9 px-3.5 rounded-full bg-[#ec4d86] text-white text-[12.5px] font-bold shrink-0 active:scale-95 transition-transform"
              >
                Proponer
              </button>
            )}
            <button
              type="button"
              onClick={dismissPlanNudge}
              aria-label="Descartar sugerencia"
              title="Descartar"
              className={`w-9 h-9 -mr-1 rounded-full flex items-center justify-center shrink-0 ${isLight ? 'text-[#5b6478] hover:bg-black/5' : 'text-[#a9b2c9] hover:bg-white/10'}`}
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Active proposal sticky card */}
      {activeProposal && hiddenProposalIds.includes(activeProposal.id) && (
        <div className={`px-3 pt-1 pb-1 shrink-0 ${isLight ? 'bg-[#efe7d8]' : 'bg-[#0a1120]'}`}>
          <button
            type="button"
            onClick={() => restoreProposalCard(activeProposal.id)}
            className={`w-full flex items-center gap-2 h-10 px-4 rounded-full border text-[12.5px] font-bold transition-colors ${
              isLight ? 'bg-white border-[#16223b]/8 text-[#ec4d86]' : 'bg-[#131f36] border-white/8 text-[#ffa3c4]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">event</span>
            Próxima cita
            <span className="material-symbols-outlined text-[18px] ml-auto">expand_more</span>
          </button>
        </div>
      )}
      {activeProposal && !hiddenProposalIds.includes(activeProposal.id) && (
        <div className={`px-3 pt-1 pb-1 shrink-0 ${isLight ? 'bg-[#efe7d8]' : 'bg-[#0a1120]'}`}>
          <div className={`p-3.5 rounded-2xl border flex flex-col gap-3 ${isLight ? 'bg-white border-[#ec4d86]/25 shadow-elevation-sm' : 'bg-[#131f36] border-[#ec4d86]/30'}`}>
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#ec4d86]/12 text-[#ec4d86] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">event</span>
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-[10.5px] uppercase tracking-[0.12em] block font-bold text-[#ec4d86] leading-none mb-1">Próxima cita</span>
                <p className={`text-[14px] font-semibold leading-snug ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
                  {activeProposal.scheduledAt
                    ? new Date(activeProposal.scheduledAt).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
                    : 'A coordinar por chat'}
                </p>
                <p className={`text-[12px] truncate ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>{activeProposal.zone}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0 -mr-1.5 -mt-1">
                {!(activeProposal.status === 'PENDING' && activeProposal.proposerId !== user?.id) && (
                  <Badge className="shrink-0 h-6 px-2 text-[10.5px] font-bold bg-[#ec4d86]/12 text-[#ec4d86] border-0">
                    {activeProposal.status === 'PENDING' ? 'Esperando' : activeProposal.status === 'ACCEPTED' ? 'Aceptada' : 'Contrapropuesta'}
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={() => dismissProposalCard(activeProposal.id)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isLight ? 'text-[#5b6478] hover:text-[#ec4d86] hover:bg-black/5' : 'text-[#a9b2c9] hover:text-[#ffa3c4] hover:bg-white/10'
                  }`}
                  aria-label="Ocultar tarjeta de próxima cita"
                  title="Ocultar"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {activeProposal.status === 'PENDING' && activeProposal.proposerId !== user?.id && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCounterFormOpen((prev) => !prev)}
                  className="flex-1 h-10 text-[13px] font-bold rounded-xl"
                >
                  {activeProposal.scheduledAt ? 'Cambiar hora' : 'Proponer hora'}
                </Button>
                <Button size="sm" onClick={() => acceptProposal.mutate(activeProposal.id)} className="flex-1 h-10 text-[13px] font-bold rounded-xl">
                  Aceptar
                </Button>
              </div>
            )}

            {/* Acción de check-in — del diseño Premium aprobado: una vez que la cita está
                acordada, el atajo para verificar con QR aparece directo en la tarjeta,
                además del badge "Pase QR" que ya vive en el header. */}
            {activeProposal.status === 'ACCEPTED' && onOpenDateQR && (
              <button
                type="button"
                onClick={() => { sounds.playScanBeep(); onOpenDateQR(activeMatch.id, partner.displayName, partner.photos[0]?.url ?? ''); }}
                className={`flex items-center justify-center gap-2 h-10 rounded-xl border text-[13px] font-bold transition-colors ${
                  isLight ? 'border-[#ec4d86]/30 text-[#ec4d86] hover:bg-[#ec4d86]/5' : 'border-[#ec4d86]/30 text-[#ffa3c4] hover:bg-white/5'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                Ya estamos ahí · Verificar con QR
              </button>
            )}

            {counterFormOpen && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!counterAt) return;
                  counterProposal.mutate(
                    { proposalId: activeProposal.id, input: { scheduledAt: new Date(counterAt).toISOString() } },
                    { onSuccess: () => setCounterFormOpen(false) },
                  );
                }}
                className={`flex items-center gap-2 pt-3 border-t ${isLight ? 'border-[#16223b]/8' : 'border-white/8'}`}
              >
                <input
                  type="datetime-local"
                  value={counterAt}
                  onChange={(e) => setCounterAt(e.target.value)}
                  required
                  className={`flex-1 min-w-0 h-10 border rounded-xl px-3 text-[13px] focus:outline-none focus:border-[#ec4d86] ${
                    isLight ? 'bg-white border-[#16223b]/12 text-[#16223b]' : 'bg-[#0a1120] border-white/10 text-[#f5f1e8]'
                  }`}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={counterProposal.isPending}
                  className="h-10 px-4 text-[13px] font-bold rounded-xl shrink-0"
                >
                  Enviar
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      {/* mt-auto en el primer hijo (no justify-end en el contenedor) para pegar los
          mensajes abajo cuando hay pocos: justify-end en un flex column con
          overflow-y-auto tiene un bug conocido de Chromium donde scrollHeight queda
          igual a clientHeight apenas el contenido desborda — se veía "scrolleable"
          pero nunca se movía ni un píxel. */}
      <div
        ref={messagesScrollRef}
        onScroll={handleMessagesScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 pt-3 pb-2 flex flex-col relative z-10 no-scrollbar select-text transition-all duration-300"
        style={getWallpaperStyle()}
      >
        {/* Cargando: esqueleto de burbujas con la geometría real del chat, no
            un spinner genérico ni una página en blanco. */}
        {isLoadingMessages && messages.length === 0 && (
          <div className="flex flex-col gap-3 animate-fadeIn" aria-label="Cargando mensajes">
            <div className="self-start max-w-[75%] flex flex-col gap-1">
              <Skeleton className="h-10 w-44 rounded-[18px] rounded-bl-md" />
              <Skeleton className="h-10 w-32 rounded-[18px] rounded-bl-md" />
            </div>
            <div className="self-end max-w-[75%] flex flex-col items-end gap-1">
              <Skeleton className="h-10 w-40 rounded-[18px] rounded-br-md" />
            </div>
            <div className="self-start max-w-[75%]">
              <Skeleton className="h-10 w-52 rounded-[18px] rounded-bl-md" />
            </div>
          </div>
        )}

        {/* Error de carga: antes se mostraba el empty-state ("rompé el hielo")
            como si no hubiera mensajes — ahora se dice la verdad con retry. */}
        {!isLoadingMessages && messagesError && messages.length === 0 && (
          <ErrorState
            compact
            title="No pudimos cargar los mensajes"
            body="Revisá tu conexión e intentá de nuevo."
            onRetry={() => refetchMessages()}
          />
        )}

        <div className="flex justify-center mb-3 mt-auto">
          <div className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold backdrop-blur-md ${isLight ? 'bg-white/80 text-[#5b6478]' : 'bg-[#131f36]/80 text-[#a9b2c9]'}`}>
            <span className="material-symbols-outlined text-[13px] text-[#ec4d86]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
            Conexión privada Findy
          </div>
        </div>

        {/* Punto de partida: el chat vacío ya no es una página en blanco. Si el
            match nació de un fragmento concreto, se muestra como primer tema; si
            no, quedan los tres caminos (pregunta, plan, chispa). */}
        {!isLoadingMessages && !messagesError && filteredMessages.length === 0 && !inChatSearchTerm.trim() && (
          <div className="flex flex-col items-center text-center gap-4 py-8 px-4 animate-fadeIn">
            <div className="w-20 h-20 rounded-full p-[3px] bg-gradient-to-tr from-[#ec4d86] to-[#ff6b9e] shadow-elevation-md">
              <div className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center ${isLight ? 'bg-white' : 'bg-[#0a1120]'}`}>
                {partner.photos[0]?.url ? (
                  <img
                    src={partner.photos[0]?.url}
                    alt={partner.displayName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className={`text-[22px] font-bold ${isLight ? 'text-[#16223b]/60' : 'text-white/60'}`} aria-hidden="true">
                    {partner.displayName.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="max-w-[280px]">
              <p className={`text-[17px] font-bold leading-tight ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
                {contextLabel ? `Conectaron por: ${contextLabel}` : `Conectaste con ${partner.displayName}`}
              </p>
              <p className={`text-[13.5px] leading-relaxed mt-1.5 ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                {contextLabel
                  ? 'Ya tenés de qué hablar — empezá por ahí.'
                  : 'Rompé el hielo con una pregunta o proponé un plan.'}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {onOpenIcebreaker && (
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => { sounds.playClick(); onOpenIcebreaker(partner.displayName); }}
                  className="h-11 px-5 rounded-full text-[13.5px] font-bold gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">casino</span>
                  Pregunta inicial
                </Button>
              )}
              {onOpenProposeModal && (
                <button
                  type="button"
                  onClick={() => { sounds.playStamp(); onOpenProposeModal(activeMatch.id); }}
                  className={`inline-flex items-center gap-2 h-11 px-5 rounded-full border-[1.5px] text-[13.5px] font-bold transition-colors ${
                    isLight ? 'border-[#ec4d86] text-[#ec4d86] hover:bg-[#ec4d86]/5' : 'border-[#ec4d86]/70 text-[#ffa3c4] hover:bg-white/5'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">local_cafe</span>
                  Proponer plan
                </button>
              )}
            </div>
          </div>
        )}

        {filteredMessages.map((msg: Message, idx) => {
          const isUser = msg.senderId === user?.id;
          const sticker = msg.type === 'TEXT' ? parseSticker(msg.body) : null;
          const gif = msg.type === 'TEXT' ? parseGif(msg.body) : null;
          const isImage = msg.type === 'IMAGE' && !!msg.imageUrl;
          const msgReaction = localReactions[msg.id];
          const isStarred = starredMsgIds.includes(msg.id);
          // Agrupado por remitente (como iMessage/Telegram): los mensajes seguidos
          // de la misma persona van pegados y solo el último lleva la "cola".
          const sameAsPrev = idx > 0 && filteredMessages[idx - 1].senderId === msg.senderId;
          const sameAsNext = idx < filteredMessages.length - 1 && filteredMessages[idx + 1].senderId === msg.senderId;
          const tailClass = sameAsNext ? '' : isUser ? 'rounded-br-[6px]' : 'rounded-bl-[6px]';

          return (
            <div key={msg.id} className={`flex flex-col group relative ${sameAsPrev ? 'mt-1' : 'mt-3'} ${msgReaction ? 'mb-2.5' : ''} ${isUser ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[82%] relative flex items-end gap-1.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                {sticker ? (
                  <div
                    onClick={() => {
                      if (longPressFiredRef.current) return;
                      sounds.playClick();
                      setSelectedStickerDetail(sticker);
                    }}
                    onTouchStart={() => startLongPress(msg.id)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onMouseDown={() => startLongPress(msg.id)}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    className="relative cursor-pointer transition-transform hover:scale-105 active:scale-95 py-1"
                  >
                    <div className={`w-32 h-32 rounded-3xl shadow-elevation-md flex flex-col items-center justify-center p-3 text-center relative overflow-hidden ${isLight ? 'bg-white' : 'bg-[#1f2e4c]'}`}>
                      <span className="text-5xl select-none">{sticker.emoji}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#ec4d86] mt-2 line-clamp-2 px-1">{sticker.badgeText || sticker.title}</span>
                      <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 bg-black/45 text-white px-1.5 py-0.5 rounded-full text-[9px] font-medium">
                        <span>{formatTime(msg.createdAt)}</span>
                        {isUser && msg.readAt && <span className="material-symbols-outlined text-[11px] text-[#6fa8c9]">done_all</span>}
                      </div>
                    </div>
                    {isStarred && <span className="absolute -top-1 -right-1 material-symbols-outlined text-amber-400 text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>}
                  </div>
                ) : (
                  <div
                    style={isUser && customColor ? { backgroundColor: customColor } : undefined}
                    onTouchStart={() => startLongPress(msg.id)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onMouseDown={() => startLongPress(msg.id)}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    className={`px-3.5 pt-2 pb-1.5 relative transition-all rounded-[18px] select-none ${tailClass} ${isUser ? getUserBubbleClass() : getPartnerBubbleClass()}`}
                  >
                    {msg.replyTo && (
                      <div className={`mb-1.5 -mx-1 pl-2.5 pr-2 py-1.5 rounded-lg border-l-[3px] max-w-[240px] ${
                        isUser ? 'border-l-white/60 bg-black/12' : isLight ? 'border-l-[#ec4d86] bg-[#16223b]/5' : 'border-l-[#ec4d86] bg-white/6'
                      }`}>
                        <span className={`block text-[11px] font-bold ${isUser ? 'text-white/85' : 'text-[#ec4d86]'}`}>
                          {msg.replyTo.senderId === msg.senderId ? 'Se respondió a sí mismo' : msg.replyTo.senderId === user?.id ? 'Vos' : partner.displayName}
                        </span>
                        <span className={`block text-[12.5px] truncate ${isUser ? 'text-white/75' : isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                          {msg.replyTo.type === 'IMAGE' ? '📷 Foto' : msg.replyTo.body}
                        </span>
                      </div>
                    )}
                    {gif && (
                      <div className="mb-1.5 -mx-1.5 mt-0.5 rounded-xl overflow-hidden max-w-[240px]">
                        <img src={gif.url} alt={gif.title} loading="lazy" decoding="async" className="w-full h-auto object-cover max-h-52 rounded-xl" referrerPolicy="no-referrer" />
                        <span className="block text-[11.5px] font-semibold px-1.5 pt-1.5">{gif.tag}</span>
                      </div>
                    )}
                    {isImage && (
                      <div className="mb-1.5 -mx-1.5 mt-0.5 rounded-xl overflow-hidden max-w-[260px]">
                        <img src={msg.imageUrl ?? undefined} alt="Foto enviada" loading="lazy" decoding="async" className="w-full h-auto object-cover max-h-60 rounded-xl cursor-pointer" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    {!gif && !isImage && (
                      <p className="text-[14.5px] leading-[1.45] break-words">{msg.body}</p>
                    )}
                    <div className={`flex items-center justify-end gap-1 mt-0.5 -mb-0.5 select-none text-[10px] font-medium tabular-nums ${isUser ? 'text-white/70' : isLight ? 'text-[#5b6478]/80' : 'text-[#a9b2c9]/80'}`}>
                      {isStarred && <span className="material-symbols-outlined text-[12px] text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>}
                      <span>{formatTime(msg.createdAt)}</span>
                      {/* Estado de envío: un tilde al enviar, doble celeste al
                          leer. Antes solo existía el "leído" y nada confirmaba
                          que el mensaje había salido. */}
                      {isUser && (msg.readAt ? (
                        <span className="material-symbols-outlined text-[14px] text-[#6fa8c9]" title="Leído">done_all</span>
                      ) : (
                        <span className="material-symbols-outlined text-[14px] opacity-80" title="Enviado">done</span>
                      ))}
                    </div>
                    {msgReaction && (
                      <button onClick={() => handleToggleReaction(msg.id, msgReaction)} className={`absolute -bottom-3 ${isUser ? 'left-2' : 'right-2'} h-6 px-2 rounded-full text-[13px] shadow-elevation-md flex items-center ${isLight ? 'bg-white border border-[#16223b]/8' : 'bg-[#131f36] border border-white/10'}`}>
                        <span>{msgReaction}</span>
                      </button>
                    )}
                  </div>
                )}

              </div>

              {activeReactionMenuMsgId === msg.id && (
                <div className={`mt-2 z-30 p-1 rounded-full shadow-2xl flex items-center gap-0.5 animate-fadeIn border ${isLight ? 'bg-white border-[#16223b]/8' : 'bg-[#131f36] border-white/10'} ${isUser ? 'self-end mr-1' : 'self-start ml-1'}`}>
                  {['👍', '❤️', '😂', '😮', '😢', '🙏', '☕', '🔥'].map((emoji) => (
                    <button key={emoji} onClick={() => handleToggleReaction(msg.id, emoji)} className={`w-9 h-9 flex items-center justify-center text-[19px] hover:scale-125 transition-transform rounded-full ${isLight ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}>
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {activeOptionsMenuMsgId === msg.id && (
                <div className={`mt-1.5 z-30 p-1.5 min-w-[180px] rounded-2xl shadow-2xl flex flex-col animate-fadeIn border text-[13.5px] font-medium ${isLight ? 'bg-white border-[#16223b]/8 text-[#16223b]' : 'bg-[#131f36] border-white/10 text-[#f5f1e8]'} ${isUser ? 'self-end mr-1' : 'self-start ml-1'}`}>
                  <button
                    onClick={() => { setReplyingTo(msg); setActiveOptionsMenuMsgId(null); sounds.playClick(); inputRef.current?.focus(); }}
                    className={`h-10 px-3 text-left rounded-xl flex items-center gap-3 ${isLight ? 'hover:bg-[#fcf9f2]' : 'hover:bg-white/8'}`}
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#ec4d86]">reply</span>
                    <span>Responder</span>
                  </button>
                  <button onClick={() => handleToggleStar(msg.id)} className={`h-10 px-3 text-left rounded-xl flex items-center gap-3 ${isLight ? 'hover:bg-[#fcf9f2]' : 'hover:bg-white/8'}`}>
                    <span className="material-symbols-outlined text-[18px] text-[#ec4d86]">{isStarred ? 'star_half' : 'star'}</span>
                    <span>{isStarred ? 'Quitar estrella' : 'Destacar'}</span>
                  </button>
                  {!sticker && !gif && !isImage && (
                    <button onClick={() => { navigator.clipboard.writeText(msg.body); setActiveOptionsMenuMsgId(null); sounds.playClick(); }} className={`h-10 px-3 text-left rounded-xl flex items-center gap-3 ${isLight ? 'hover:bg-[#fcf9f2]' : 'hover:bg-white/8'}`}>
                      <span className="material-symbols-outlined text-[18px] text-[#ec4d86]">content_copy</span>
                      <span>Copiar texto</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {(activeReactionMenuMsgId || activeOptionsMenuMsgId) && (
          <div
            className="fixed inset-0 z-20"
            onClick={() => {
              setActiveReactionMenuMsgId(null);
              setActiveOptionsMenuMsgId(null);
            }}
          />
        )}

        {isPartnerTyping && (
          <div className="flex items-end gap-1.5 self-start mt-3 animate-fadeIn">
            <Avatar className="w-7 h-7">
              <AvatarImage src={partner.photos[0]?.url} alt={partner.displayName} />
              <AvatarFallback>{partner.displayName.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className={`h-10 px-4 rounded-[18px] rounded-bl-[6px] flex items-center gap-1 ${getPartnerBubbleClass()}`}>
              <span className="w-2 h-2 bg-[#ec4d86] rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-[#ff6b9e] rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-[#ec4d86] rounded-full animate-bounce" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Píldora "nuevos mensajes": aparece cuando llegan mensajes mientras
          leés arriba, en vez de arrastrarte al fondo a la fuerza. */}
      {newBelowCount > 0 && (
        <div className="relative h-0 shrink-0 z-20">
          <div className="absolute inset-x-0 -top-11 flex justify-center px-3 pointer-events-none animate-fadeIn">
            <button
              type="button"
              onClick={jumpToLatest}
              className="pointer-events-auto flex items-center gap-1.5 h-9 pl-3.5 pr-4 rounded-full bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white text-[12px] font-bold shadow-elevation-md active:scale-95 transition-transform"
              aria-label={`Bajar a los ${newBelowCount} mensajes nuevos`}
            >
              <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
              {newBelowCount} {newBelowCount === 1 ? 'nuevo' : 'nuevos'}
            </button>
          </div>
        </div>
      )}

      {/* Attachment menu */}
      {showAttachmentMenu && (
        <div className={`border-t px-4 py-4 grid grid-cols-4 gap-2 animate-fadeIn relative z-20 shrink-0 ${isLight ? 'bg-white border-[#16223b]/8' : 'bg-[#0f1a2e] border-white/8'}`}>
          {[
            { icon: 'image', label: 'Foto', onClick: () => photoInputRef.current?.click() },
            { icon: 'local_cafe', label: 'Cita', onClick: () => { setShowAttachmentMenu(false); onOpenProposeModal?.(activeMatch.id); } },
            ...(onOpenIcebreaker ? [{ icon: 'casino', label: 'Ruleta', onClick: () => { setShowAttachmentMenu(false); onOpenIcebreaker(partner.displayName); } }] : []),
            { icon: 'auto_awesome', label: 'Stickers', onClick: () => { setShowAttachmentMenu(false); setActiveMediaTray('stickers'); } },
          ].map((item) => (
            <button key={item.label} onClick={item.onClick} className="flex flex-col items-center gap-1.5 text-center group py-1">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-active:scale-95 ${isLight ? 'bg-[#ec4d86]/10 text-[#ec4d86]' : 'bg-[#ec4d86]/15 text-[#ffa3c4]'}`}>
                <span className="material-symbols-outlined text-[26px]">{item.icon}</span>
              </div>
              <span className={`text-[12px] font-semibold ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Media tray */}
      {activeMediaTray && (
        <div className={`border-t flex flex-col h-72 max-h-[45dvh] animate-fadeIn relative z-20 shrink-0 ${isLight ? 'bg-[#fcf9f2] border-[#16223b]/8' : 'bg-[#0f1a2e] border-white/8'}`}>
          <div className={`pl-3 pr-1.5 py-2 border-b flex items-center justify-between shrink-0 ${isLight ? 'bg-[#fcf9f2] border-[#16223b]/6' : 'bg-[#0f1a2e] border-white/6'}`}>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(['sparks', 'emojis', 'stickers', 'gifs'] as const).map((tab) => (
                <Button
                  key={tab}
                  variant="tertiary"
                  size="sm"
                  onClick={() => setActiveMediaTray(tab)}
                  className={`h-9 px-3.5 rounded-full text-[12.5px] font-semibold flex items-center gap-1.5 shrink-0 ${activeMediaTray === tab ? 'bg-[#ec4d86] text-white shadow-elevation-sm' : isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}
                >
                  <span className="material-symbols-outlined text-[17px]">{tab === 'sparks' ? 'lightbulb' : tab === 'emojis' ? 'mood' : tab === 'stickers' ? 'auto_awesome' : 'gif_box'}</span>
                  <span>{tab === 'sparks' ? 'Ideas' : tab === 'emojis' ? 'Emojis' : tab === 'stickers' ? 'Stickers' : 'GIFs'}</span>
                </Button>
              ))}
            </div>
            <div className="flex items-center shrink-0">
              {activeMediaTray === 'emojis' && (
                <Button variant="tertiary" size="icon" onClick={handleBackspaceEmoji} className={`h-10 w-10 rounded-full ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`} aria-label="Borrar último carácter">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">backspace</span>
                </Button>
              )}
              <Button variant="tertiary" size="icon" onClick={() => setActiveMediaTray(null)} className={`h-10 w-10 rounded-full ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`} aria-label="Cerrar">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
              </Button>
            </div>
          </div>

          {activeMediaTray === 'sparks' && (
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 no-scrollbar">
              {CONVERSATION_SPARKS.map((spark, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => { sounds.playClick(); sendMessage.mutate({ body: spark }); setActiveMediaTray(null); }}
                  className={`min-h-[44px] px-4 py-2.5 border rounded-2xl text-[13.5px] text-left transition-colors ${
                    isLight ? 'bg-white border-[#16223b]/8 text-[#16223b] hover:border-[#ec4d86]' : 'bg-[#131f36] border-white/8 text-[#f5f1e8] hover:border-[#ec4d86]/60'
                  }`}
                >
                  {spark}
                </button>
              ))}
            </div>
          )}

          {activeMediaTray === 'stickers' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className={`flex items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar border-b shrink-0 ${isLight ? 'border-[#16223b]/6' : 'border-white/6'}`}>
                <button
                  onClick={() => setSelectedStickerPackId('favorites')}
                  className={`h-8 px-3 rounded-full text-[11.5px] font-semibold shrink-0 transition-all ${selectedStickerPackId === 'favorites' ? 'bg-[#ec4d86] text-white' : isLight ? 'bg-white text-[#5b6478]' : 'bg-[#131f36] text-[#a9b2c9]'}`}
                >
                  ⭐ Favoritos ({favoriteStickers.length})
                </button>
                {STICKER_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => setSelectedStickerPackId(pack.id)}
                    className={`h-8 px-3 rounded-full text-[11.5px] font-semibold shrink-0 transition-all ${selectedStickerPackId === pack.id ? 'bg-[#ec4d86] text-white' : isLight ? 'bg-white text-[#5b6478]' : 'bg-[#131f36] text-[#a9b2c9]'}`}
                  >
                    {pack.icon} {pack.name}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {(selectedStickerPackId === 'favorites' ? favoriteStickers : currentPack.stickers).map((sticker) => (
                    <button
                      key={sticker.id}
                      onClick={() => handleSendSticker(sticker)}
                      className={`flex flex-col items-center p-2 rounded-2xl transition-all hover:scale-105 active:scale-95 group relative ${isLight ? 'bg-white shadow-elevation-sm' : 'bg-[#131f36]'}`}
                      title={`Enviar ${sticker.title}`}
                    >
                      <span className="text-[34px] leading-none py-1 select-none group-hover:scale-110 transition-transform">{sticker.emoji}</span>
                      <span className="text-[9.5px] font-bold text-[#ec4d86] uppercase tracking-wider mt-1 truncate max-w-full">{sticker.badgeText || sticker.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeMediaTray === 'emojis' && (
            <div className="flex-1 overflow-y-auto p-3 no-scrollbar space-y-3">
              <div>
                <span className={`text-[10.5px] font-bold uppercase tracking-[0.12em] block mb-1.5 ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>Recientes</span>
                <div className="flex flex-wrap gap-1">
                  {(recentEmojis.length > 0 ? recentEmojis : DEFAULT_FREQUENT_EMOJIS).map((emoji, i) => (
                    <button
                      key={`recent-${i}`}
                      onClick={() => handleInsertEmoji(emoji)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-[22px] hover:scale-125 transition-transform ${isLight ? 'hover:bg-white' : 'hover:bg-white/8'}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              {EMOJI_CATEGORIES.map((cat) => (
                <div key={cat.name}>
                  <span className={`text-[10.5px] font-bold uppercase tracking-[0.12em] block mb-1.5 ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>{cat.name}</span>
                  <div className="flex flex-wrap gap-1">
                    {cat.emojis.map((emoji, i) => (
                      <button
                        key={`${cat.name}-${i}`}
                        onClick={() => handleInsertEmoji(emoji)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-[22px] hover:scale-125 transition-transform ${isLight ? 'hover:bg-white' : 'hover:bg-white/8'}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeMediaTray === 'gifs' && (
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 no-scrollbar">
              {QUICK_GIFS.map((gif) => (
                <div key={gif.id} onClick={() => handleSendGif(gif)} className="rounded-2xl overflow-hidden cursor-pointer group relative shadow-elevation-sm">
                  <img src={gif.url} alt={gif.title} loading="lazy" decoding="async" className="w-full h-28 object-cover group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                  <div className="absolute bottom-0 inset-x-0 px-2 pt-5 pb-1.5 bg-gradient-to-t from-black/80 to-transparent text-white text-[11.5px] font-bold truncate">{gif.tag}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Proponer cita + icebreakers — del diseño Premium aprobado: en vez de esconder
          "proponer cita" solo en el header/menú de adjuntos, y las ideas de conversación
          solo en la bandeja "Ideas", se muestra un atajo persistente arriba del input
          (igual que Conversation.dc.html), sin sacar los accesos que ya existían.
          Va todo en una sola fila de chips: el atajo de cita primero (relleno) y
          las ideas después (contorno) — antes el botón de cita ocupaba una fila
          entera y sumaba ~50px de altura al composer. */}
      {!activeMediaTray && !showAttachmentMenu && !inChatSearchOpen && (
        <div className="shrink-0 relative z-10">
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 pt-2 pb-1">
            {/* Jerarquía única: con el chat vacío, la tarjeta de punto de partida
                ya ofrece plan + pregunta; este atajo solo aparece cuando hay
                conversación (donde la tarjeta ya no está). */}
            {onOpenProposeModal && filteredMessages.length > 0 && (
              <button
                type="button"
                onClick={() => { sounds.playStamp(); onOpenProposeModal(activeMatch.id); }}
                className="shrink-0 inline-flex items-center gap-1.5 h-9 pl-3 pr-3.5 rounded-full bg-[#ec4d86] text-white text-[12.5px] font-bold whitespace-nowrap shadow-elevation-sm active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[17px]">local_cafe</span>
                Proponer cita
              </button>
            )}
            {conversationSparkChips.map((spark, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => { sounds.playClick(); setInputText(spark); inputRef.current?.focus(); }}
                className={`shrink-0 h-9 px-3.5 rounded-full border text-[12.5px] font-medium whitespace-nowrap transition-colors active:scale-95 ${
                  isLight ? 'bg-white border-[#16223b]/10 text-[#16223b]' : 'bg-[#131f36] border-white/10 text-[#f5f1e8]'
                }`}
              >
                {spark}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar — el padding inferior respeta el home indicator; sin esto el
          composer quedaba pegado al borde en iPhones con Face ID. */}
      <div
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
        className={`px-3 pt-2 relative z-30 shrink-0 ${isLight ? 'bg-[#efe7d8]' : 'bg-[#0a1120]'}`}
      >
        {replyingTo && (
          <div className={`flex items-center gap-2 mb-2 pl-3 pr-1.5 py-2 rounded-2xl border-l-[3px] animate-fadeIn ${
            isLight ? 'bg-white border-l-[#ec4d86] shadow-elevation-sm' : 'bg-[#131f36] border-l-[#ec4d86]'
          }`}>
            <div className="flex-1 min-w-0">
              <span className="block text-[11.5px] font-bold text-[#ec4d86]">
                Respondiendo a {replyingTo.senderId === user?.id ? 'vos' : partner.displayName}
              </span>
              <span className={`block text-[13px] truncate ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                {replyingTo.type === 'IMAGE' ? '📷 Foto' : replyingTo.body}
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setReplyingTo(null); sounds.playClick(); }}
              className={`h-9 w-9 shrink-0 flex items-center justify-center rounded-full ${isLight ? 'text-[#5b6478] hover:text-[#ec4d86] hover:bg-[#fcf9f2]' : 'text-[#a9b2c9] hover:text-[#ffa3c4] hover:bg-white/5'}`}
              aria-label="Cancelar respuesta"
              title="Cancelar respuesta"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}
        <form onSubmit={handleSendText} className="flex items-center gap-2" autoComplete="off">
          <div className={`flex-1 flex items-center gap-0.5 pl-1 pr-1 h-12 rounded-full border transition-colors ${isLight ? 'bg-white border-[#16223b]/10 focus-within:border-[#ec4d86] shadow-elevation-sm' : 'bg-[#131f36] border-white/10 focus-within:border-[#ec4d86]/70'}`}>
            <button
              type="button"
              onClick={() => { sounds.playClick(); setActiveMediaTray(activeMediaTray ? null : 'stickers'); setShowAttachmentMenu(false); }}
              className={`tap-target w-10 h-10 flex items-center justify-center rounded-full transition-colors ${activeMediaTray ? 'text-[#ec4d86]' : isLight ? 'text-[#5b6478] hover:text-[#ec4d86]' : 'text-[#a9b2c9] hover:text-[#ffa3c4]'}`}
              title="Stickers y Emojis"
              aria-label={activeMediaTray ? 'Cerrar stickers' : 'Abrir stickers y emojis'}
            >
              <span className="material-symbols-outlined text-[24px] block">{activeMediaTray ? 'keyboard' : 'sentiment_satisfied'}</span>
            </button>
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => { setInputText(e.target.value); pingTyping(); }}
              onFocus={() => { if (activeMediaTray) setActiveMediaTray(null); }}
              placeholder="Escribí un mensaje"
              // Teclado móvil: la tecla Enter dice "enviar" y lo envía.
              enterKeyHint="send"
              aria-label={`Mensaje para ${partner.displayName}`}
              autoComplete="off"
              autoCorrect="on"
              className={`flex-1 min-w-0 h-full bg-transparent text-[15px] px-1 focus:outline-none ${isLight ? 'text-[#16223b] placeholder:text-[#5b6478]/70' : 'text-[#f5f1e8] placeholder:text-[#a9b2c9]/70'}`}
            />
            <button
              type="button"
              onClick={() => { sounds.playClick(); setShowAttachmentMenu(!showAttachmentMenu); setActiveMediaTray(null); }}
              className={`tap-target w-10 h-10 flex items-center justify-center rounded-full transition-colors ${showAttachmentMenu ? 'text-[#ec4d86]' : isLight ? 'text-[#5b6478] hover:text-[#ec4d86]' : 'text-[#a9b2c9] hover:text-[#ffa3c4]'}`}
              title="Adjuntar"
              aria-label={showAttachmentMenu ? 'Cerrar adjuntos' : 'Adjuntar foto o plan'}
            >
              <span className="material-symbols-outlined text-[22px] block">add_circle</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || sendMessage.isPending}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#ec4d86] to-[#ff6b9e] text-white flex items-center justify-center tactile-btn shadow-elevation-md hover:brightness-105 transition-all active:scale-95 shrink-0 disabled:opacity-40 disabled:shadow-none"
            title="Enviar mensaje"
            aria-label={sendMessage.isPending ? 'Enviando mensaje' : 'Enviar mensaje'}
          >
            {sendMessage.isPending ? (
              <span className="material-symbols-outlined text-[22px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[22px] translate-x-px" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
            )}
          </button>
        </form>
      </div>

      {/* Sticker detail modal */}
      {selectedStickerDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className={`w-full max-w-xs rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center animate-scaleUp ${isLight ? 'bg-white text-[#16223b]' : 'bg-[#131f36] text-[#f5f1e8]'}`}>
            <div className={`w-32 h-32 rounded-3xl flex items-center justify-center text-[64px] mb-4 ${isLight ? 'bg-[#fcf9f2]' : 'bg-[#1f2e4c]'}`}>
              {selectedStickerDetail.emoji}
            </div>
            <h3 className="text-[18px] font-bold mb-4">{selectedStickerDetail.title}</h3>
            <div className="flex flex-col gap-2 w-full">
              <Button onClick={() => { handleSendSticker(selectedStickerDetail); setSelectedStickerDetail(null); }} className="w-full bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white font-bold h-11 rounded-2xl text-[14px] shadow-elevation-md">
                Enviar al chat
              </Button>
              <Button variant="secondary" onClick={() => handleToggleFavoriteSticker(selectedStickerDetail.id)} className="w-full h-11 rounded-2xl flex items-center justify-center gap-2 text-[13.5px]">
                <span className="material-symbols-outlined text-[18px] text-amber-500" style={{ fontVariationSettings: favoriteStickerIds.includes(selectedStickerDetail.id) ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                <span>{favoriteStickerIds.includes(selectedStickerDetail.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'}</span>
              </Button>
              <Button variant="tertiary" onClick={() => setSelectedStickerDetail(null)} className="w-full h-10 text-[13.5px] opacity-70">Cerrar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Contact info drawer */}
      {showContactInfoDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className={`w-full max-w-sm h-full overflow-y-auto p-5 flex flex-col justify-between animate-slideLeft ${isLight ? 'bg-white text-[#16223b]' : 'bg-[#0f1a2e] text-[#f5f1e8]'}`} style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))', paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
            <div>
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-[18px] font-bold">Info del contacto</h3>
                <Button variant="tertiary" size="icon" onClick={() => setShowContactInfoDrawer(false)} className="h-11 w-11 -mr-2 rounded-full" aria-label="Cerrar">
                  <span className="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
                </Button>
              </div>
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-28 h-28 rounded-full p-[3px] bg-gradient-to-tr from-[#ec4d86] to-[#ff6b9e] shadow-elevation-md mb-3">
                  <Avatar className="w-full h-full">
                    <AvatarImage src={partner.photos[0]?.url} alt={partner.displayName} />
                    <AvatarFallback>{partner.displayName.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-[22px] font-bold leading-tight">{partner.displayName}, {partner.age}</h2>
                  <VerifiedMark badges={partner.badges} size={20} />
                </div>
                <p className={`text-[13px] mt-0.5 ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>{partner.city}</p>
              </div>
              <div className={`p-4 rounded-2xl mb-3 ${isLight ? 'bg-[#fcf9f2]' : 'bg-[#131f36]'}`}>
                <span className="text-[10.5px] text-[#ec4d86] font-bold uppercase tracking-[0.12em] block mb-1.5">Estado en Findy</span>
                <p className="text-[14px] leading-relaxed">"{partner.bio || 'Sin bio todavía.'}"</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className={`p-4 rounded-2xl text-center ${isLight ? 'bg-[#fcf9f2]' : 'bg-[#131f36]'}`}>
                  <span className="text-[20px] font-bold text-[#ec4d86] block leading-tight">{partner.membership.tierLabel}</span>
                  <span className={`text-[10.5px] uppercase tracking-[0.1em] font-bold ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>Membresía</span>
                </div>
                <div className={`p-4 rounded-2xl text-center ${isLight ? 'bg-[#fcf9f2]' : 'bg-[#131f36]'}`}>
                  <span className="text-[20px] font-bold text-emerald-500 block leading-tight">{activeMatch.verifiedDateCount}</span>
                  <span className={`text-[10.5px] uppercase tracking-[0.1em] font-bold ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>Citas verificadas</span>
                </div>
              </div>
            </div>
            <Button onClick={() => { setShowContactInfoDrawer(false); onOpenProposeModal?.(activeMatch.id); }} className="w-full bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white font-bold h-12 rounded-2xl text-[14px] shadow-elevation-md gap-2">
              <span className="material-symbols-outlined text-[18px]">local_cafe</span>
              Proponer cita a {partner.displayName}
            </Button>
          </div>
        </div>
      )}

      {/* Theme customizer */}
      {showThemeCustomizer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className={`w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col justify-between animate-scaleUp no-scrollbar ${isLight ? 'bg-white text-[#16223b]' : 'bg-[#0f1a2e] text-[#f5f1e8]'}`}>
            <div>
              <div className={`flex items-center justify-between pb-3 border-b mb-4 ${isLight ? 'border-[#16223b]/8' : 'border-white/10'}`}>
                <h3 className="text-[18px] font-bold">Personalizar chat</h3>
                <Button variant="tertiary" size="icon" onClick={() => setShowThemeCustomizer(false)} className="rounded-full h-11 w-11 -mr-2" aria-label="Cerrar">
                  <span className="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
                </Button>
              </div>

              <div className="mb-5">
                <span className="text-[10.5px] uppercase font-bold tracking-[0.12em] text-[#ec4d86] block mb-2">Vista previa</span>
                <div className={`p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col gap-2 ${isLight ? 'border-[#16223b]/8' : 'border-white/8'}`} style={getWallpaperStyle()}>
                  <div className="flex justify-start">
                    <div className={`px-3.5 py-2 max-w-[80%] rounded-[18px] rounded-bl-[6px] ${getPartnerBubbleClass()}`}>
                      <p className="text-[13.5px] leading-snug">¿Qué te parece este color para el chat? ☕</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div style={customColor ? { backgroundColor: customColor } : undefined} className={`px-3.5 py-2 max-w-[80%] rounded-[18px] rounded-br-[6px] ${getUserBubbleClass()}`}>
                      <p className="text-[13.5px] leading-snug">¡Me encanta! Queda súper estético ✨</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <span className="text-[10.5px] uppercase font-bold tracking-[0.12em] text-[#ec4d86] block mb-2">Paletas y temas Findy</span>
                <div className="grid grid-cols-2 gap-2">
                  {CHAT_THEME_PRESETS.map((preset) => {
                    const isSelected = currentTheme.id === preset.id && !customColor;
                    const isLocked = Boolean(preset.blackOnly && !isBlackMember);
                    return (
                      <button
                        key={preset.id}
                        onClick={() => {
                          if (isLocked) {
                            sounds.playClick();
                            toast('Tema exclusivo de Findy Black', { description: 'Activá Black desde la Tienda para usarlo.' });
                            return;
                          }
                          handleApplyTheme(preset.id);
                        }}
                        className={`p-3 min-h-[60px] rounded-2xl border text-left transition-all relative flex flex-col justify-between gap-1 ${
                          isSelected ? 'border-[#ec4d86] bg-[#ec4d86]/8' : isLight ? 'border-[#16223b]/8 bg-[#fcf9f2]' : 'border-white/8 bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className={`text-[12.5px] font-bold truncate ${isLocked ? 'opacity-60' : ''}`}>{preset.previewBadge}</span>
                          {isLocked ? (
                            <span className="material-symbols-outlined text-[16px] shrink-0 text-[#d9b45c]" aria-label="Exclusivo Black">lock</span>
                          ) : (
                            <span className={`w-4 h-4 rounded-full shrink-0 ${isSelected ? 'ring-2 ring-[#ec4d86] ring-offset-2' : ''} ${isLight ? 'ring-offset-white' : 'ring-offset-[#0f1a2e]'}`} style={{ backgroundColor: preset.accentColor }} />
                          )}
                        </div>
                        <p className={`text-[11px] line-clamp-1 ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>{preset.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-5">
                <span className="text-[10.5px] uppercase font-bold tracking-[0.12em] text-[#ec4d86] block mb-2">Patrón de fondo</span>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { id: 'dots', label: 'Puntos', icon: 'blur_on' },
                    { id: 'grid', label: 'Cuadrícula', icon: 'grid_view' },
                    { id: 'stars', label: 'Estrellas', icon: 'auto_awesome' },
                    { id: 'warm', label: 'Cálido', icon: 'local_cafe' },
                    { id: 'clean', label: 'Liso', icon: 'crop_square' },
                  ].map((pat) => (
                    <button
                      key={pat.id}
                      onClick={() => handleApplyPattern(pat.id as 'dots' | 'grid' | 'stars' | 'clean' | 'warm')}
                      className={`min-h-[60px] p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all text-center ${
                        customPattern === pat.id ? 'border-[#ec4d86] bg-[#ec4d86]/8 text-[#ec4d86] font-bold' : isLight ? 'border-[#16223b]/8 text-[#5b6478]' : 'border-white/8 text-[#a9b2c9]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{pat.icon}</span>
                      <span className="text-[10px] truncate max-w-full">{pat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <span className="text-[10.5px] uppercase font-bold tracking-[0.12em] text-[#ec4d86] block mb-2">Color de tus burbujas</span>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {['#ec4d86', '#c9366d', '#b98fd1', '#b98fd1', '#3f7a5c', '#2e5570', '#2e5570', '#e3b873', '#e3b873', '#ff6b9e', '#2e5570'].map((hex) => (
                    <button
                      key={hex}
                      onClick={() => handleApplyCustomColor(hex)}
                      className={`w-9 h-9 rounded-full transition-transform flex items-center justify-center ${customColor.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-[#ec4d86] ring-offset-2 scale-110' : ''} ${isLight ? 'ring-offset-white' : 'ring-offset-[#0f1a2e]'}`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                      aria-label={`Color ${hex}`}
                    />
                  ))}
                  <label className={`relative w-9 h-9 rounded-full border-2 border-dashed hover:border-[#ec4d86] flex items-center justify-center cursor-pointer ${isLight ? 'border-[#16223b]/25' : 'border-white/30'}`} title="Elegir color exacto">
                    <span className="material-symbols-outlined text-[16px] opacity-70">colorize</span>
                    <input type="color" value={customColor || currentTheme.accentColor} onChange={(e) => handleApplyCustomColor(e.target.value)} className="sr-only" />
                  </label>
                </div>
              </div>
            </div>

            <div className={`flex gap-2 pt-4 border-t mt-2 ${isLight ? 'border-[#16223b]/8' : 'border-white/10'}`}>
              <Button variant="secondary" onClick={() => { sounds.playClick(); handleApplyTheme('mely-cherry'); }} className="flex-1 h-11 rounded-2xl text-[13.5px] font-bold">Por defecto</Button>
              <Button onClick={() => { sounds.playStamp(); setShowThemeCustomizer(false); }} className="flex-1 bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white font-bold h-11 rounded-2xl shadow-elevation-md text-[13.5px]">Aplicar y guardar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Consejos de seguridad — del diseño Premium aprobado. */}
      {showSafetyTips && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className={`w-full max-w-sm max-h-[85dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl animate-scaleUp no-scrollbar ${isLight ? 'bg-white text-[#16223b]' : 'bg-[#0f1a2e] text-[#f5f1e8]'}`} style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-[#ec4d86]/12 text-[#ec4d86] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">shield</span>
                </span>
                <h3 className="text-[18px] font-bold">Consejos de seguridad</h3>
              </div>
              <Button variant="tertiary" size="icon" onClick={() => setShowSafetyTips(false)} className="rounded-full h-11 w-11 -mr-2" aria-label="Cerrar">
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
              </Button>
            </div>
            <p className={`text-[13.5px] leading-relaxed mt-2 mb-4 ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
              Antes de encontrarte con {partner.displayName}, tené en cuenta estas recomendaciones de Findy.
            </p>
            <div className="flex flex-col gap-3.5 mb-3">
              {SAFETY_TIPS.map((tip, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isLight ? 'bg-[#fcf9f2]' : 'bg-[#131f36]'}`}>
                    <span className="material-symbols-outlined text-[18px] text-[#ec4d86]">{tip.icon}</span>
                  </span>
                  <p className="text-[13.5px] leading-relaxed pt-1.5">{tip.text}</p>
                </div>
              ))}
            </div>
            <Button onClick={() => setShowSafetyTips(false)} className="w-full mt-2 bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white font-bold h-12 rounded-2xl text-[14px] shadow-elevation-md">
              Entendido
            </Button>
          </div>
        </div>
      )}

      <ReportBlockSheet
        open={showReportBlock}
        onOpenChange={setShowReportBlock}
        partnerId={partner.id}
        partnerName={partner.displayName}
        onActionComplete={(action) => {
          if (action === 'blocked') {
            setViewMode('inbox');
            onSelectConnection(null);
          }
        }}
      />
    </div>
  );
};
