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

  return (
    <div className="w-full flex-1 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-0.5 px-0.5">
        <h1
          className="font-display text-[22px] font-semibold"
          style={{ color: isLight ? 'var(--text-on-light)' : 'var(--text-primary)' }}
        >
          Me gusta
        </h1>
        <p className="text-[12.5px]" style={{ color: isLight ? 'var(--text-on-light-muted)' : 'var(--text-secondary)' }}>
          {isLoading ? 'Cargando…' : `${data?.count ?? 0} ${(data?.count ?? 0) === 1 ? 'persona te dio like' : 'personas te dieron like'}`}
        </p>
      </div>

      {/* Tab pills */}
      <div className="flex gap-2 px-0.5">
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
              onClick={() => {
                sounds.playClick();
                setTab(t.id);
              }}
              aria-pressed={active}
              className="min-h-[40px] px-4 rounded-[var(--radius-pill)] text-[12.5px] font-bold transition-all active:scale-95"
              style={
                active
                  ? { background: 'var(--coral-500)', color: 'var(--ink-on-coral)' }
                  : {
                      background: 'transparent',
                      border: `1px solid ${isLight ? 'rgba(22,34,59,0.12)' : 'var(--hairline-strong)'}`,
                      color: isLight ? 'var(--text-on-light-muted)' : 'var(--text-secondary)',
                    }
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'nuevos' && (
        <div className="relative flex-1">
          {isLoading && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Skeleton className="h-40 w-full rounded-[var(--radius-lg)]" />
              <Skeleton className="h-40 w-full rounded-[var(--radius-lg)]" />
              <Skeleton className="h-40 w-full rounded-[var(--radius-lg)]" />
              <Skeleton className="h-40 w-full rounded-[var(--radius-lg)]" />
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
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3" style={{ filter: 'blur(7px)', opacity: 0.55, pointerEvents: 'none' }}>
                {(data.profiles.length > 0 ? data.profiles : Array.from({ length: Math.min(data.count, 4) })).slice(0, 4).map((p: any, i: number) => (
                  <div key={p?.id ?? i} className="relative aspect-[3/4] w-full rounded-[var(--radius-lg)] overflow-hidden flex items-center justify-center" style={{ background: 'var(--midnight-850)' }}>
                    {p?.photos?.[0]?.url ? (
                      <img src={p.photos[0].url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--coral-500)', opacity: 0.4 }}>
                        person
                      </span>
                    )}
                    {p?.displayName && (
                      <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
                        <p className="text-white text-[12.5px] font-bold truncate">{p.displayName}, {p.age}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Overlay de desbloqueo, centrado sobre el grid */}
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div
                  className="w-full max-w-[280px] p-4 rounded-[var(--radius-lg)] border text-center flex flex-col items-center gap-2 shadow-[var(--shadow-lg)]"
                  style={{
                    background: isLight ? '#FFFFFF' : 'var(--midnight-900)',
                    borderColor: isLight ? 'rgba(22,34,59,0.1)' : 'var(--hairline-strong)',
                  }}
                >
                  <span className="material-symbols-outlined text-[26px]" style={{ color: 'var(--coral-500)' }}>
                    lock
                  </span>
                  <p className="text-[13.5px] font-bold" style={{ color: isLight ? 'var(--text-on-light)' : 'var(--text-primary)' }}>
                    Ver quién te dio like
                  </p>
                  <p className="text-[11.5px]" style={{ color: isLight ? 'var(--text-on-light-muted)' : 'var(--text-secondary)' }}>
                    Desbloqueala con monedas. Con Plus, Gold o Black ya está incluida.
                  </p>
                  <Button variant="primary" onClick={handleUnlock} disabled={purchase.isPending} className="w-full gap-1.5 mt-1">
                    <span className="material-symbols-outlined text-[16px]">lock_open</span>
                    <span>Desbloquear · {likesUnlockPrice} ◉</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!isLoading && data && data.unlocked && data.profiles.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {data.profiles.map((p) => (
                <div
                  key={p.id}
                  className="relative rounded-[var(--radius-lg)] overflow-hidden border aspect-[3/4]"
                  style={{ borderColor: isLight ? 'rgba(22,34,59,0.1)' : 'var(--hairline-strong)', background: 'var(--midnight-850)' }}
                >
                  {p.photos[0]?.url && (
                    <img src={p.photos[0].url} alt={p.displayName} loading="lazy" decoding="async" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
                    <p className="text-white text-[12.5px] font-bold truncate">{p.displayName}, {p.age}</p>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleLikeBack(p.id)}
                      disabled={like.isPending}
                      className="w-full h-7 mt-1.5 gap-1 text-[11px]"
                    >
                      <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
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
              <p className="text-[11.5px] px-0.5 mb-3" style={{ color: isLight ? 'var(--text-on-light-muted)' : 'var(--text-secondary)' }}>
                {sentLikes.length} {sentLikes.length === 1 ? 'like enviado' : 'likes enviados'} desde este teléfono. Si hay match, aparece en Mensajes.
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {sentLikes.map((s) => (
                  <div
                    key={s.profileId}
                    className="relative rounded-[var(--radius-lg)] overflow-hidden border aspect-[3/4]"
                    style={{ borderColor: isLight ? 'rgba(22,34,59,0.1)' : 'var(--hairline-strong)', background: 'var(--midnight-850)' }}
                  >
                    {s.photoUrl ? (
                      <img src={s.photoUrl} alt={s.displayName} loading="lazy" decoding="async" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--coral-500)', opacity: 0.4 }}>
                          person
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
                      <p className="text-white text-[12.5px] font-bold truncate">{s.displayName}, {s.age}</p>
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-white/85">
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
