import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Match } from '../types';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { ReportBlockSheet } from './ReportBlockSheet';
import { ProfilePhoto } from './ProfilePhoto';
import { InactiveMatchesSection } from './InactiveMatchesSection';
import { EmptyState, ErrorState } from './StateViews';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';

interface MatchesViewProps {
  matches: Match[];
  isLoading?: boolean;
  error?: unknown;
  onOpenChat: (connectionId: string) => void;
  onProposeDate: (match: Match) => void;
  onRetry?: () => void;
  onExploreMore?: () => void;
}

type FilterType = 'all' | 'online' | 'verified' | 'vip';
type ViewLayout = 'grid' | 'list';

/**
 * markInactiveMatches() en el backend "enfría" un match sin mensajes después de
 * matchInactiveHours — antes esa cuenta regresiva era invisible para el usuario. Este
 * hook fuerza un re-render cada minuto para que las etiquetas de tiempo restante
 * (calculadas en el render a partir de match.expiresAt) se mantengan al día.
 */
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
}

// Un solo sello por nombre (antes había dos íconos "verified" seguidos); el color
// indica el nivel más alto y el title conserva el detalle.
const VerifiedMark: React.FC<{ badges: { trusted: boolean; verified: boolean }; size?: number }> = ({ badges, size = 15 }) => {
  if (!badges.trusted && !badges.verified) return null;
  const title = badges.trusted && badges.verified ? 'Identidad y citas verificadas' : badges.trusted ? 'Citas verificadas' : 'Identidad verificada';
  return (
    <span
      className={`material-symbols-outlined shrink-0 ${badges.trusted ? 'text-[#ec4d86]' : 'text-sky-400'}`}
      style={{ fontSize: size, fontVariationSettings: "'FILL' 1" }}
      title={title}
      aria-label={title}
    >
      verified
    </span>
  );
};

function matchCountdown(expiresAt: string | null): { label: string; urgent: boolean } | null {
  if (!expiresAt) return null;
  const endsAt = new Date(expiresAt).getTime();
  // Fecha malformada del server: antes renderizaba "Quedan NaNm".
  if (!Number.isFinite(endsAt)) return null;
  const diffMs = endsAt - Date.now();
  if (diffMs <= 0) return null;
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  const label = hours > 0 ? `${hours}h` : `${Math.max(1, minutes)}m`;
  return { label, urgent: diffMs < 6 * 60 * 60 * 1000 };
}

export const MatchesView: React.FC<MatchesViewProps> = ({
  matches,
  isLoading = false,
  error,
  onOpenChat,
  onProposeDate,
  onRetry,
  onExploreMore,
}) => {
  const { isLight } = useTheme();
  useMinuteTick();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [layoutMode, setLayoutMode] = useState<ViewLayout>('grid');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedGalleryIdx, setSelectedGalleryIdx] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showReportBlock, setShowReportBlock] = useState(false);

  useEffect(() => {
    if (selectedMatch && !matches.some((match) => match.id === selectedMatch.id)) {
      setSelectedMatch(null);
    }
  }, [matches, selectedMatch]);

  // Filter matches based on search & category
  const filteredMatches = matches.filter((match) => {
    const other = match.other;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      other.displayName.toLowerCase().includes(q) ||
      (other.city ?? '').toLowerCase().includes(q) ||
      other.interests.some((i) => i.name.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (activeFilter === 'online') return other.lastActive === 'En línea';
    if (activeFilter === 'verified') return other.badges.trusted;
    if (activeFilter === 'vip') return other.membership.tier === 'VIP' || other.membership.tier === 'FOUNDING';

    return true;
  });

  return (
    <div className="flex flex-col gap-5 pb-20 select-none">
      {error && matches.length > 0 && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-[12.5px] ${
            isLight ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          }`}
        >
          <span>No se pudo actualizar la lista. Estás viendo datos anteriores.</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="shrink-0 font-bold underline underline-offset-2 min-h-[44px]">
              Reintentar
            </button>
          )}
        </div>
      )}
      {/* Minimal header — TopAppBar already shows the page title, this is just the icon controls */}
      <div className="flex flex-col gap-4 px-0.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${isLight ? 'text-[#ec4d86]' : 'text-[#ffa3c4]'}`}>
              Tus conexiones
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <h2 className={`text-[24px] font-bold tracking-tight leading-tight ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
                {matches.length} {matches.length === 1 ? 'match' : 'matches'}
              </h2>
              {activeFilter !== 'all' || searchQuery ? (
                <span className={`text-[12px] ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                  {filteredMatches.length} visibles
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sounds.playClick();
                setSearchOpen((v) => !v);
              }}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                searchOpen ? 'bg-[#ec4d86] text-white' : isLight ? 'bg-white text-[#16223b] shadow-elevation-sm' : 'bg-[#131f36] text-[#f5f1e8] hover:bg-[#1f2e4c]'
              }`}
              aria-label="Buscar y filtrar"
              title="Buscar y filtrar"
            >
              <span className="material-symbols-outlined text-[22px]">search</span>
            </button>
            <button
              onClick={() => {
                sounds.playClick();
                setLayoutMode(layoutMode === 'grid' ? 'list' : 'grid');
              }}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                isLight ? 'bg-white text-[#16223b] shadow-elevation-sm' : 'bg-[#131f36] text-[#f5f1e8] hover:bg-[#1f2e4c]'
              }`}
              aria-label={layoutMode === 'grid' ? 'Ver como lista' : 'Ver como cuadrícula'}
              title={layoutMode === 'grid' ? 'Ver como lista' : 'Ver como cuadrícula'}
            >
              <span className="material-symbols-outlined text-[22px]">{layoutMode === 'grid' ? 'view_list' : 'grid_view'}</span>
            </button>
          </div>
        </div>

        {/* Story-row of matches, Instagram-style gradient ring around each avatar */}
        {matches.length > 0 && (
          <div className="flex items-start gap-4 overflow-x-auto no-scrollbar -mx-0.5 px-0.5 py-0.5">
            {matches.map((m) => (
              <motion.button
                key={`ribbon-${m.id}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  sounds.playClick();
                  setSelectedMatch(m);
                  setSelectedGalleryIdx(0);
                }}
                className="flex flex-col items-center gap-1.5 shrink-0 w-[64px] group focus:outline-none"
                title={`Ver perfil de ${m.other.displayName}`}
              >
                <div className="relative">
                  <div className={`w-[60px] h-[60px] rounded-full p-[2.5px] ${m.unread > 0 ? 'bg-gradient-to-tr from-[#ec4d86] via-[#ffa3c4] to-[#ff6b9e]' : isLight ? 'bg-[#16223b]/10' : 'bg-white/12'}`}>
                    <ProfilePhoto
                      url={m.other.photos[0]?.url}
                      name={m.other.displayName}
                      className={`w-full h-full rounded-full border-2 ${isLight ? 'border-[#fcf9f2]' : 'border-[#0a1120]'}`}
                    />
                  </div>
                  {m.other.lastActive === 'En línea' && (
                    <span className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-2 ${isLight ? 'ring-[#fcf9f2]' : 'ring-[#0a1120]'}`} />
                  )}
                  {m.unread > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1.5 rounded-full bg-[#ec4d86] text-white text-[10.5px] font-bold flex items-center justify-center ring-2 ${isLight ? 'ring-[#fcf9f2]' : 'ring-[#0a1120]'}`}>
                      {m.unread}
                    </span>
                  )}
                </div>
                <span className={`text-[11.5px] font-medium truncate max-w-full ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
                  {m.other.displayName.split(' ')[0]}
                </span>
              </motion.button>
            ))}
          </div>
        )}

        {/* Search & Filter Bar — collapsed by default, one tap away behind the search icon */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-3 pt-0.5 pb-1">
                <div className="relative flex items-center">
                  <span className={`material-symbols-outlined absolute left-4 text-[20px] pointer-events-none ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                    search
                  </span>
                  <Input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre, zona o interés"
                    className={`pl-11 pr-11 h-12 text-[14px] rounded-full border shadow-none ${
                      isLight ? 'bg-white border-[#ffe0ec]' : 'bg-[#131f36] border-white/8 text-[#f5f1e8]'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className={`absolute right-1 w-10 h-10 rounded-full flex items-center justify-center hover:text-[#ec4d86] ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}
                      aria-label="Limpiar búsqueda"
                      title="Limpiar búsqueda"
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-0.5 px-0.5 py-0.5">
                  {[
                    { id: 'all', label: 'Todos', icon: 'grid_view' },
                    { id: 'online', label: 'En línea', icon: 'bolt' },
                    { id: 'verified', label: 'Verificados', icon: 'verified' },
                    { id: 'vip', label: 'VIP', icon: 'workspace_premium' },
                  ].map((f) => {
                    const isSelected = activeFilter === f.id;
                    return (
                      <motion.button
                        key={f.id}
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        aria-pressed={isSelected}
                        onClick={() => {
                          sounds.playClick();
                          setActiveFilter(f.id as FilterType);
                        }}
                        className={`h-9 pl-3 pr-3.5 rounded-full text-[12.5px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all shrink-0 border ${
                          isSelected
                            ? 'bg-[#ec4d86] text-white border-transparent shadow-elevation-sm'
                            : isLight
                            ? 'bg-white text-[#2e5570] border-[#ffe0ec]'
                            : 'bg-[#131f36] text-[#f5f1e8]/85 border-white/8'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: isSelected ? "'FILL' 1" : "'FILL' 0" }}>
                          {f.icon}
                        </span>
                        <span>{f.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MATCHES LIST / GRID LAYOUT                                   */}
      {/* ------------------------------------------------------------- */}
      {error && matches.length === 0 ? (
        <ErrorState
          icon="cloud_off"
          title="No se pudieron cargar tus matches"
          body="Revisá tu conexión e intentá de nuevo."
          onRetry={onRetry}
        />
      ) : isLoading && matches.length === 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full rounded-[20px]" />
          ))}
        </div>
      ) : filteredMatches.length > 0 ? (
        <AnimatePresence mode="wait">
          {layoutMode === 'list' ? (
            /* COMPACT LIST VIEW */
            <motion.div
              key="list-layout"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-2"
            >
              {filteredMatches.map((match, idx) => {
                const countdown = matchCountdown(match.expiresAt);
                return (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
                  className={`p-3 rounded-2xl flex items-center justify-between gap-3 transition-colors ${
                    isLight
                      ? 'bg-white shadow-elevation-sm'
                      : 'bg-[#131f36]'
                  }`}
                >
                  {/* Left: Avatar + Info */}
                  <div
                    className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      sounds.playClick();
                      setSelectedMatch(match);
                      setSelectedGalleryIdx(0);
                    }}
                    onClick={() => {
                      sounds.playClick();
                      setSelectedMatch(match);
                      setSelectedGalleryIdx(0);
                    }}
                  >
                    <div className="relative shrink-0">
                      <ProfilePhoto
                        url={match.other.photos[0]?.url}
                        name={match.other.displayName}
                        className="w-14 h-14 rounded-2xl"
                      />
                      {match.other.lastActive === 'En línea' && (
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-2 ${isLight ? 'ring-white' : 'ring-[#131f36]'}`} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <h4 className={`text-[15px] font-bold leading-tight truncate ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
                          {match.other.displayName}, {match.other.age}
                        </h4>
                        <VerifiedMark badges={match.other.badges} size={15} />
                      </div>
                      <p className={`text-[12px] truncate ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                        {match.other.city || 'Buenos Aires'}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className={`text-[11.5px] font-semibold truncate ${match.unread > 0 ? 'text-[#ec4d86]' : isLight ? 'text-[#2e5570]' : 'text-[#ffa3c4]'}`}>
                          {match.unread > 0 ? `${match.unread} sin leer` : match.label}
                        </span>
                        {countdown && (
                          <span
                            className={`inline-flex items-center gap-0.5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                              countdown.urgent ? 'bg-amber-500/15 text-amber-500' : isLight ? 'bg-[#efe7d8] text-[#5b6478]' : 'bg-white/8 text-[#a9b2c9]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                            {countdown.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Sleek Compact Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Chat Icon Button */}
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        sounds.playClick();
                        onOpenChat(match.id);
                      }}
                      className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
                        isLight
                          ? 'bg-[#fcf9f2] text-[#ec4d86] hover:bg-[#efe7d8]'
                          : 'bg-white/8 text-[#ffa3c4] hover:bg-[#ec4d86]/20'
                      }`}
                      title="Abrir chat"
                      aria-label="Abrir chat"
                    >
                      <span className="material-symbols-outlined text-[20px]">chat</span>
                    </motion.button>

                    {/* Date Pill Button */}
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        sounds.playStamp();
                        onProposeDate(match);
                      }}
                      className="h-11 w-11 rounded-full bg-gradient-to-tr from-[#ec4d86] to-[#ff6b9e] text-white flex items-center justify-center shadow-elevation-sm hover:brightness-105 transition-all"
                      title="Proponer cita"
                      aria-label="Proponer cita"
                    >
                      <span className="material-symbols-outlined text-[20px]">local_cafe</span>
                    </motion.button>
                  </div>
                </motion.div>
                );
              })}

              {onExploreMore && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: filteredMatches.length * 0.04, duration: 0.25 }}
                  onClick={() => {
                    sounds.playClick();
                    onExploreMore();
                  }}
                  className={`h-14 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 transition-colors ${
                    isLight
                      ? 'border-[#16223b]/12 hover:border-[#ec4d86] text-[#ec4d86] hover:bg-[#fcf9f2]'
                      : 'border-white/12 hover:border-[#ec4d86]/60 text-[#ffa3c4] hover:bg-white/5'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">explore</span>
                  <span className="text-[13.5px] font-bold">Seguir descubriendo</span>
                </motion.button>
              )}
            </motion.div>
          ) : (
            /* REFINED COMPACT GRID VIEW */
            <motion.div
              key="grid-layout"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-2 gap-3"
            >
              {filteredMatches.map((match, idx) => {
                const countdown = matchCountdown(match.expiresAt);
                return (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
                >
                  {/* Tarjeta tipo póster: foto 3:4 con el nombre sobre un degradé abajo —
                      menos texto suelto debajo de cada foto y más foto por fila. */}
                  <div
                    className={`relative aspect-[3/4] rounded-[20px] overflow-hidden cursor-pointer group ${isLight ? 'bg-[#efe7d8] shadow-elevation-sm' : 'bg-[#131f36]'}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      sounds.playClick();
                      setSelectedMatch(match);
                      setSelectedGalleryIdx(0);
                    }}
                    onClick={() => {
                      sounds.playClick();
                      setSelectedMatch(match);
                      setSelectedGalleryIdx(0);
                    }}
                    title="Ver perfil completo"
                  >
                    <ProfilePhoto
                      url={match.other.photos[0]?.url}
                      name={match.other.displayName}
                      className="w-full h-full"
                      imageClassName="transition-transform duration-500 group-hover:scale-105"
                      fallbackClassName="text-3xl"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-[#0a1120]/95 via-[#0a1120]/55 to-transparent pointer-events-none" />
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      {countdown && (
                        <span
                          className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10.5px] font-bold backdrop-blur-sm ${
                            countdown.urgent ? 'bg-amber-500/90 text-white' : 'bg-black/50 text-white'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[12px]">schedule</span>
                          {countdown.label}
                        </span>
                      )}
                      {match.unread > 0 && (
                        <span className="min-w-[24px] h-6 px-2 rounded-full bg-[#ec4d86] text-white text-[11px] font-bold flex items-center justify-center shadow-elevation-sm">
                          {match.unread} {match.unread === 1 ? 'nuevo' : 'nuevos'}
                        </span>
                      )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col gap-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <h3 className="text-[16px] font-bold text-white leading-tight truncate drop-shadow-sm">
                          {match.other.displayName}, {match.other.age}
                        </h3>
                        <VerifiedMark badges={match.other.badges} size={15} />
                        {match.other.lastActive === 'En línea' && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="En línea" aria-label="En línea" />
                        )}
                      </div>
                      <span className={`text-[11.5px] font-semibold truncate ${match.unread > 0 ? 'text-[#ffa3c4]' : 'text-white/75'}`}>
                        {match.unread > 0 ? `${match.unread} sin leer` : match.label}
                      </span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        sounds.playClick();
                        onOpenChat(match.id);
                      }}
                      className="absolute top-2 right-2 w-11 h-11 rounded-full bg-white/90 backdrop-blur-sm shadow-elevation-md flex items-center justify-center text-[#ec4d86]"
                      title="Abrir chat"
                      aria-label="Abrir chat"
                    >
                      <span className="material-symbols-outlined text-[20px]">chat</span>
                    </motion.button>
                  </div>
                </motion.div>
                );
              })}

              {/* Tile final para seguir explorando: con pocos matches, el grid dejaba
                  mucho espacio vacío debajo en vez de invitar a la próxima acción. */}
              {onExploreMore && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: filteredMatches.length * 0.04, duration: 0.25 }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      onExploreMore();
                    }}
                    className={`w-full aspect-[3/4] rounded-[20px] border-2 border-dashed flex flex-col items-center justify-center gap-2.5 text-center p-4 transition-colors ${
                      isLight
                        ? 'border-[#16223b]/12 hover:border-[#ec4d86] text-[#ec4d86] hover:bg-[#fcf9f2]'
                        : 'border-white/12 hover:border-[#ec4d86]/60 text-[#ffa3c4] hover:bg-white/5'
                    }`}
                  >
                    <span className="w-12 h-12 rounded-full bg-[#ec4d86]/12 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[24px]">explore</span>
                    </span>
                    <span className="text-[13.5px] font-bold leading-tight">Seguir descubriendo</span>
                    <span className={`text-[11.5px] ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>Encontrá más conexiones</span>
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <EmptyState
          icon="favorite_border"
          title={searchQuery ? 'Sin coincidencias' : 'Sin sparks en este filtro'}
          body={
            searchQuery
              ? 'Probá buscando con otro término.'
              : 'Explorá perfiles en Descubrir para generar nuevas conexiones.'
          }
          actions={
            searchQuery
              ? [{ label: 'Limpiar búsqueda', onClick: () => { setSearchQuery(''); setActiveFilter('all'); }, icon: 'close', variant: 'secondary' }]
              : onExploreMore
                ? [{ label: 'Seguir descubriendo', onClick: onExploreMore, icon: 'explore' }]
                : []
          }
        />
      )}

      <InactiveMatchesSection onOpenChat={onOpenChat} />

      {/* ------------------------------------------------------------- */}
      {/* MATCH PROFILE DETAIL MODAL WITH FLUID SPRING ANIMATION        */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {selectedMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 min-[380px]:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedMatch(null)}
              className="absolute inset-0 bg-black/75 backdrop-blur-xs"
            />
            <motion.div
              // Sin opacity en la entrada: con fade-in la foto de la galería
              // quedaba semitransparente sobre el grid y se mezclaba con la
              // foto de atrás. La entrada es opaca (escala + desplazamiento);
              // el fundido corto vive solo en la salida.
              initial={{ scale: 0.93, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30, opacity: { duration: 0.16, ease: 'easeOut' } }}
              className={`relative z-10 w-full max-w-md max-h-[88dvh] rounded-[24px] overflow-hidden flex flex-col shadow-2xl ${
                isLight ? 'bg-white text-[#16223b]' : 'bg-[#0f1a2e] text-[#f5f1e8]'
              }`}
            >
              {/* Modal Header Gallery */}
              <div className="relative h-72 w-full bg-black shrink-0">
                <ProfilePhoto
                  url={selectedMatch.other.photos[selectedGalleryIdx]?.url || selectedMatch.other.photos[0]?.url}
                  name={selectedMatch.other.displayName}
                  className="w-full h-full"
                  fallbackClassName="text-4xl"
                  eager
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                {/* Close & overflow buttons */}
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    onClick={() => { sounds.playClick(); setShowReportBlock(true); }}
                    className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                    aria-label="Reportar o bloquear"
                    title="Reportar o bloquear"
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">more_vert</span>
                  </button>
                  <button
                    onClick={() => setSelectedMatch(null)}
                    className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                    aria-label="Cerrar"
                    title="Cerrar"
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
                  </button>
                </div>

                {/* Photo Dots */}
                {selectedMatch.other.photos.length > 1 && (
                  <div className="absolute top-3 left-3 flex items-center gap-1">
                    {selectedMatch.other.photos.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedGalleryIdx(idx)}
                        aria-label={`Foto ${idx + 1}`}
                        className="py-3 px-1 flex items-center"
                      >
                        <span
                          className={`h-1.5 rounded-full transition-all duration-200 block ${
                            selectedGalleryIdx === idx ? 'w-5 bg-[#ec4d86]' : 'w-2 bg-white/60'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                )}
                {/* Bottom Identity Overlay */}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-[24px] font-bold text-white leading-tight drop-shadow-sm">
                      {selectedMatch.other.displayName}, {selectedMatch.other.age}
                    </h2>
                    <VerifiedMark badges={selectedMatch.other.badges} size={20} />
                  </div>
                  <p className="text-white/80 text-[13px] font-medium mt-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    {selectedMatch.other.city}
                    {selectedMatch.other.lastActive === 'En línea' && <span className="ml-1.5 text-emerald-300 font-semibold">· En línea</span>}
                  </p>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="p-4 overflow-y-auto flex flex-col gap-4">
                {(() => {
                  const countdown = matchCountdown(selectedMatch.expiresAt);
                  if (!countdown) return null;
                  return (
                    <div
                      className={`p-3 rounded-2xl flex items-center gap-3 ${
                        countdown.urgent
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : isLight
                            ? 'bg-[#fcf9f2] text-[#ec4d86]'
                            : 'bg-[#ec4d86]/10 text-[#ffa3c4]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[22px] shrink-0">schedule</span>
                      <p className="text-[12.5px] font-semibold leading-snug">
                        Te quedan {countdown.label} para escribirle antes de que el match se enfríe.
                      </p>
                    </div>
                  );
                })()}
                {/* Bio */}
                <div>
                  <h4 className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#ec4d86] mb-1.5">
                    Sobre {selectedMatch.other.displayName}
                  </h4>
                  <p className={`text-[14px] leading-relaxed ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
                    {selectedMatch.other.bio}
                  </p>
                </div>

                {/* Interests */}
                {selectedMatch.other.interests.length > 0 && (
                  <div>
                    <h4 className={`text-[10.5px] font-bold uppercase tracking-[0.12em] mb-2 ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                      Intereses
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedMatch.other.interests.map((interest) => (
                        <span
                          key={interest.id}
                          className={`h-8 px-3 inline-flex items-center rounded-full text-[12px] font-semibold ${
                            isLight
                              ? 'bg-[#fcf9f2] text-[#2e5570]'
                              : 'bg-white/8 text-[#f5f1e8]'
                          }`}
                        >
                          {interest.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prompts Q&A */}
                {selectedMatch.other.prompts.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h4 className={`text-[10.5px] font-bold uppercase tracking-[0.12em] ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                      Icebreakers
                    </h4>
                    {selectedMatch.other.prompts.map((p) => (
                      <div
                        key={p.id}
                        className={`p-3.5 rounded-2xl ${
                          isLight ? 'bg-[#fcf9f2]' : 'bg-[#131f36]'
                        }`}
                      >
                        <p className="text-[12px] font-bold text-[#ec4d86] mb-1">
                          {p.question}
                        </p>
                        <p className={`text-[13.5px] leading-relaxed ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
                          {p.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Actions Footer - Compact & Elegant */}
              <div
                className={`p-3 border-t flex items-center gap-2 shrink-0 ${
                  isLight ? 'bg-white border-[#16223b]/8' : 'bg-[#0f1a2e] border-white/8'
                }`}
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    sounds.playClick();
                    const id = selectedMatch.id;
                    setSelectedMatch(null);
                    onOpenChat(id);
                  }}
                  className={`flex-1 h-12 text-[14px] font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors ${
                    isLight
                      ? 'bg-[#fcf9f2] text-[#ec4d86] hover:bg-[#efe7d8]'
                      : 'bg-white/8 text-[#ffa3c4] hover:bg-white/12'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">chat</span>
                  <span>Chat</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    sounds.playStamp();
                    const target = selectedMatch;
                    setSelectedMatch(null);
                    onProposeDate(target);
                  }}
                  className="flex-[1.4] h-12 bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white text-[14px] font-bold rounded-2xl shadow-elevation-md flex items-center justify-center gap-2 hover:brightness-105 transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">local_cafe</span>
                  <span>Proponer cita</span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {selectedMatch && (
        <ReportBlockSheet
          open={showReportBlock}
          onOpenChange={setShowReportBlock}
          partnerId={selectedMatch.other.id}
          partnerName={selectedMatch.other.displayName}
          onActionComplete={(action) => {
            if (action === 'blocked') setSelectedMatch(null);
          }}
        />
      )}
    </div>
  );
};
