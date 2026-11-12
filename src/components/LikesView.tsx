import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { sounds } from '../utils/audio';
import { readSentLikes } from '../utils/sentLikes';
import { useTheme } from '../context/ThemeContext';
import { useWhoLikedMe, useSwipe } from '../hooks/useDiscover';
import { usePurchase } from '../hooks/useShop';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { EmptyState } from './StateViews';
import { Skeleton } from './ui/skeleton';

interface LikesViewProps {
  likesUnlockPrice: number;
  onOpenChat: (connectionId: string) => void;
  onExploreMore: () => void;
}

type LikesTab = 'nuevos' | 'enviados';

// Antes era un Dialog modal (WhoLikedYouModal) abierto desde la Tienda. Per el diseño
// aprobado (Likes.dc.html) "Me gusta" pasa a ser una pestaña de primer nivel de la
// bottom nav, a pantalla completa, con tabs Nuevos/Enviados — no un modal. La lógica
// de datos (useWhoLikedMe, like de vuelta, desbloqueo con coins) se mantiene igual.
export const LikesView: React.FC<LikesViewProps> = ({ likesUnlockPrice, onOpenChat, onExploreMore }) => {
  const { isLight } = useTheme();
  const { refreshUser } = useAuth();
  const { data, isLoading } = useWhoLikedMe();
  const { like } = useSwipe();
  const purchase = usePurchase();
  const [tab, setTab] = useState<LikesTab>('nuevos');
  // Sin endpoint de "likes enviados" en el backend: historial local del teléfono.
  const sentLikes = useMemo(() => (tab === 'enviados' ? readSentLikes() : []), [tab]);

  const handleLikeBack = (userId: string, connectionIdIfMatch?: string) => {
    sounds.playHeart();
    like.mutate(userId, {
      onSuccess: (res) => {
        if (res.match) {
          toast.success('¡Es un match! Ya lo tenés en Mensajes.', {
            action: { label: 'Ver', onClick: () => onOpenChat(res.match!.id) },
          });
        }
      },
    });
  };

  const handleUnlock = () => {
    sounds.playCoins();
    purchase.mutate(
      { itemKey: 'LIKES_UNLOCK' },
      {
        onSuccess: () => {
          refreshUser();
          toast.success('Desbloqueado por 24 horas.');
        },
        onError: (err: any) => toast.error(err?.message ?? 'No se pudo desbloquear'),
      },
    );
  };

  const count = data?.count ?? 0;
  const titleColor = isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]';
  const mutedColor = isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]';
  const tileClass = `relative rounded-[var(--radius-lg)] overflow-hidden aspect-[3/4] ${
    isLight ? 'bg-[#efe7d8] shadow-elevation-sm' : 'bg-[#131f36] ring-1 ring-white/8'
  }`;

  return (
    <div className="w-full flex-1 flex flex-col gap-4 pb-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <p className="section-kicker">{tab === 'enviados' ? 'Enviados' : 'Recibidos'}</p>
          <h1 className={`mt-1 text-[22px] font-extrabold tracking-tight leading-tight ${titleColor}`}>
            {isLoading ? 'Cargando…' : count === 0 ? 'Todavía nadie' : `${count} ${count === 1 ? 'persona' : 'personas'}`}
          </h1>
          <p className={`text-[12.5px] mt-0.5 ${mutedColor}`}>
            {isLoading ? ' ' : count === 1 ? 'te dio like' : 'te dieron like'}
          </p>
        </div>
        {!isLoading && count > 0 && (
          <span
            className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
              isLight ? 'bg-[#ffe0ec] text-[#ec4d86]' : 'bg-[#ec4d86]/15 text-[#ffa3c4]'
            }`}
            aria-hidden="true"
          >
            <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
          </span>
        )}
      </div>

      {/* Tabs: control segmentado, una sola pieza en vez de dos pastillas sueltas. */}
      <div
        className={`grid grid-cols-2 gap-1 p-1 rounded-full ${isLight ? 'bg-[#efe7d8]' : 'bg-white/6'}`}
        role="tablist"
        aria-label="Likes"
      >
        {(
          [
            { id: 'nuevos' as const, label: 'Nuevos' },
            { id: 'enviados' as const, label: 'Enviados' },
          ]
        ).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                sounds.playClick();
                setTab(t.id);
              }}
              aria-pressed={active}
              className={`h-10 rounded-full text-[13px] font-bold transition-all active:scale-[0.97] ${
                active
                  ? 'bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white shadow-elevation-sm'
                  : isLight
                  ? 'text-[#5b6478]'
                  : 'text-[#a9b2c9]'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'nuevos' && (
        <div className="relative flex-1">
          {isLoading && (
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="aspect-[3/4] w-full rounded-[var(--radius-lg)]" />
              <Skeleton className="aspect-[3/4] w-full rounded-[var(--radius-lg)]" />
              <Skeleton className="aspect-[3/4] w-full rounded-[var(--radius-lg)]" />
              <Skeleton className="aspect-[3/4] w-full rounded-[var(--radius-lg)]" />
            </div>
          )}

          {!isLoading && data && data.count === 0 && (
            <EmptyState
              icon="favorite_border"
              title="Todavía sin likes"
              body="Nadie te dio like aún. Seguí explorando en Descubrir — tu próxima conexión está a un swipe."
              actions={[{ label: 'Ir a Descubrir', onClick: onExploreMore, icon: 'explore' }]}
            />
          )}

          {!isLoading && data && data.count > 0 && !data.unlocked && (
            <div className="relative">
              {/* Grid de fotos reales, desenfocadas hasta desbloquear */}
              <div className="grid grid-cols-2 gap-3" style={{ filter: 'blur(9px)', opacity: 0.5, pointerEvents: 'none' }} aria-hidden="true">
                {(data.profiles.length > 0 ? data.profiles : Array.from({ length: Math.min(data.count, 4) })).slice(0, 4).map((p: any, i: number) => (
                  <div key={p?.id ?? i} className={`${tileClass} flex items-center justify-center`}>
                    {p?.photos?.[0]?.url ? (
                      <img src={p.photos[0].url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--coral-500)', opacity: 0.4 }}>
                        person
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Overlay de desbloqueo, centrado sobre el grid */}
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div
                  className={`w-full max-w-[300px] p-6 rounded-[var(--radius-lg)] border text-center flex flex-col items-center gap-2 shadow-elevation-lg ${
                    isLight ? 'bg-white border-[#ffe0ec]' : 'bg-[#0f1a2e] border-white/10'
                  }`}
                >
                  <span
                    className={`w-14 h-14 rounded-full flex items-center justify-center mb-1 ${
                      isLight ? 'bg-[#ffe0ec] text-[#ec4d86]' : 'bg-[#ec4d86]/15 text-[#ffa3c4]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[28px]">lock</span>
                  </span>
                  <p className={`text-[17px] font-extrabold tracking-tight ${titleColor}`}>Ver quién te dio like</p>
                  <p className={`text-[12.5px] leading-relaxed max-w-[230px] ${mutedColor}`}>
                    {count} {count === 1 ? 'persona espera' : 'personas esperan'} tu respuesta. Desbloqueá la lista con monedas o Premium.
                  </p>
                  <Button variant="primary" onClick={handleUnlock} disabled={purchase.isPending} className="w-full h-12 rounded-full gap-2 mt-2 text-[14px]">
                    <span className="material-symbols-outlined text-[18px]">lock_open</span>
                    <span>Desbloquear · {likesUnlockPrice} ◉</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!isLoading && data && data.unlocked && data.profiles.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {data.profiles.map((p) => (
                <div key={p.id} className={tileClass}>
                  {p.photos[0]?.url && (
                    <img src={p.photos[0].url} alt={p.displayName} loading="lazy" decoding="async" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-3 pt-10 bg-gradient-to-t from-black/85 via-black/45 to-transparent">
                    <p className="text-white text-[14px] font-bold truncate drop-shadow-xs">{p.displayName}, {p.age}</p>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleLikeBack(p.id)}
                      disabled={like.isPending}
                      className="w-full h-10 mt-2 gap-1.5 rounded-full text-[12.5px]"
                    >
                      <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                      <span>Me gusta</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'enviados' && (
        <div className="relative flex-1">
          {sentLikes.length === 0 ? (
            <EmptyState
              icon="send"
              title="Nada enviado todavía"
              body="Cuando reacciones a alguien en Descubrir, queda registrado acá."
              actions={[{ label: 'Ir a Descubrir', onClick: onExploreMore, icon: 'explore' }]}
            />
          ) : (
            <>
              <p className={`text-[12px] px-0.5 mb-3 leading-snug ${mutedColor}`}>
                {sentLikes.length} {sentLikes.length === 1 ? 'like enviado' : 'likes enviados'} desde este teléfono. Si hay match, aparece en Mensajes.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {sentLikes.map((s) => (
                  <div key={s.profileId} className={tileClass}>
                    {s.photoUrl ? (
                      <img src={s.photoUrl} alt={s.displayName} loading="lazy" decoding="async" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--coral-500)', opacity: 0.4 }}>
                          person
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-3 pt-10 bg-gradient-to-t from-black/85 via-black/45 to-transparent">
                      <p className="text-white text-[14px] font-bold truncate drop-shadow-xs">{s.displayName}, {s.age}</p>
                      <span className="mt-1.5 inline-flex items-center gap-1 h-6 px-2 rounded-full bg-white/15 border border-white/20 text-[10.5px] font-bold text-white">
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                        A la espera
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
