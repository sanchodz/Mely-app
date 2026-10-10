import React from 'react';
import { motion } from 'motion/react';
import type { Match } from '../types';
import { useTheme } from '../context/ThemeContext';
import { sounds } from '../utils/audio';
import { Button } from './ui/button';
import { ProfilePhoto } from './ProfilePhoto';

/*
 * Cierre de Descubrir: "te quedaste sin perfiles". En vez de un callejón sin
 * salida, empuja a lo que hace a FINDY distinto — hablar con quien ya hiciste
 * match. Primero los matches sin charla (son los que más se pierden).
 *
 * La animación es el mazo que se va: tres cartas que se abren y caen, y queda
 * un corazón. Respeta prefers-reduced-motion vía el MotionConfig de App.
 */

interface OutOfProfilesViewProps {
  /** 'quota' = se terminó el cupo del día; 'empty' = no queda nadie con estos filtros. */
  reason: 'quota' | 'empty';
  matches: Match[];
  /** Hora en que vuelve el cupo (solo 'quota'). */
  resetsAt?: string | null;
  /** false en Gold/Black: no tiene sentido ofrecer ampliar el cupo. */
  canExpandQuota?: boolean;
  onOpenMatches?: () => void;
  onOpenChat?: (connectionId: string) => void;
  onOpenStore?: () => void;
  onReload?: () => void;
  isReloading?: boolean;
  /** Acciones extra del caso 'empty' (ej: quitar el filtro de intención). */
  extraActions?: { label: string; onClick: () => void }[];
}

const MAX_FACES = 3;

/** Matches a los que conviene escribir primero: sin charla, después los más nuevos. */
export function matchesToNudge(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    const aQuiet = a.lastMessageAt ? 1 : 0;
    const bQuiet = b.lastMessageAt ? 1 : 0;
    if (aQuiet !== bQuiet) return aQuiet - bQuiet;
    return new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime();
  });
}

const FLY_OUT = [
  { x: -90, rotate: -24 },
  { x: 0, rotate: 4 },
  { x: 90, rotate: 22 },
];

const DeckGoneAnimation: React.FC<{ isLight: boolean }> = ({ isLight }) => (
  <div className="relative mx-auto h-[132px] w-[200px]" aria-hidden="true">
    {FLY_OUT.map((to, i) => (
      <motion.div
        key={i}
        initial={{ x: 0, y: 0, rotate: (i - 1) * 6, opacity: 1, scale: 1 }}
        animate={{ x: to.x, y: 46, rotate: to.rotate, opacity: 0, scale: 0.86 }}
        transition={{ delay: 0.15 + i * 0.12, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className={`absolute left-1/2 top-2 -ml-[38px] h-[104px] w-[76px] rounded-[var(--radius-md)] border shadow-elevation-md ${
          isLight ? 'border-[#e6dccb] bg-white' : 'border-white/10 bg-[#131f36]'
        }`}
      >
        <div className={`m-2 h-[60px] rounded-[var(--radius-sm)] ${isLight ? 'bg-[#efe7d8]' : 'bg-white/8'}`} />
        <div className={`mx-2 h-1.5 w-10 rounded-full ${isLight ? 'bg-[#efe7d8]' : 'bg-white/10'}`} />
      </motion.div>
    ))}
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.75, type: 'spring', stiffness: 320, damping: 16 }}
      className="absolute left-1/2 top-[30px] -ml-9 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-[#ec4d86] to-[#ff6b9e] text-white shadow-[0_12px_28px_-8px_rgba(236,77,134,0.6)]"
    >
      <motion.span
        className="material-symbols-outlined text-[36px]"
        style={{ fontVariationSettings: "'FILL' 1" }}
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ delay: 1.2, duration: 1.4, repeat: Infinity, repeatDelay: 1.2 }}
      >
        favorite
      </motion.span>
    </motion.div>
  </div>
);

export const OutOfProfilesView: React.FC<OutOfProfilesViewProps> = ({
  reason,
  matches,
  resetsAt,
  canExpandQuota = true,
  onOpenMatches,
  onOpenChat,
  onOpenStore,
  onReload,
  isReloading = false,
  extraActions = [],
}) => {
  const { isLight } = useTheme();
  const nudge = matchesToNudge(matches);
  const faces = nudge.slice(0, MAX_FACES);
  const hasMatches = nudge.length > 0;
  const quiet = nudge.filter((m) => !m.lastMessageAt).length;

  const resetTime = resetsAt
    ? new Date(resetsAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const title = reason === 'quota' ? 'Te quedaste sin perfiles por hoy' : 'Ya no quedan perfiles para ver';

  const body = hasMatches
    ? quiet > 0
      ? `Tenés ${quiet === 1 ? 'un match que espera' : `${quiet} matches que esperan`} tu primer mensaje. Te recomendamos conocer mejor a alguien que ya te eligió: una charla de hoy vale más que cien perfiles.`
      : 'Te recomendamos seguir conociendo a tus matches: una charla de hoy vale más que cien perfiles.'
    : 'Todavía no tenés matches. Mientras tanto, un perfil completo y con fotos hace que más gente te dé like.';

  const muted = isLight ? 'text-[#5b6478]' : 'text-[#ffa3c4]/80';

  return (
    <motion.section
      role="status"
      aria-label={title}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center px-4 py-10 text-center gap-3"
    >
      <DeckGoneAnimation isLight={isLight} />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.3 }}
        className="flex flex-col items-center gap-2"
      >
        <h3 className={`text-[19px] font-bold ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>{title}</h3>
        <p className={`max-w-[290px] text-[13px] leading-relaxed ${muted}`}>{body}</p>

        {faces.length > 0 && (
          <ul className="mt-2 flex items-start justify-center gap-4" aria-label="Matches para escribir">
            {faces.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onOpenChat?.(m.id);
                  }}
                  className="flex w-[68px] flex-col items-center gap-1.5"
                  aria-label={`Escribirle a ${m.other.displayName}`}
                >
                  <span className="relative">
                    <ProfilePhoto
                      url={m.other.photos[0]?.url}
                      name={m.other.displayName}
                      className="h-14 w-14 rounded-full border-2 border-[#ec4d86]/70"
                      fallbackClassName="text-base"
                    />
                    {!m.lastMessageAt && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#ec4d86] text-white">
                        <span className="material-symbols-outlined text-[12px]">chat_bubble</span>
                      </span>
                    )}
                  </span>
                  <span className={`w-full truncate text-[11.5px] font-semibold ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
                    {m.other.displayName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
          {hasMatches && onOpenMatches && (
            <Button
              size="sm"
              className="rounded-full gap-1.5"
              onClick={() => {
                sounds.playClick();
                onOpenMatches();
              }}
            >
              <span className="material-symbols-outlined text-[15px]">favorite</span>
              Ir a mis matches
            </Button>
          )}
          {reason === 'quota' && canExpandQuota && onOpenStore && (
            <Button
              size="sm"
              variant={hasMatches ? 'secondary' : 'primary'}
              className="rounded-full gap-1.5"
              onClick={() => {
                sounds.playClick();
                onOpenStore();
              }}
            >
              <span className="material-symbols-outlined text-[15px]">storefront</span>
              Ampliar cupo
            </Button>
          )}
          {reason === 'empty' && onReload && (
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full gap-1.5"
              onClick={() => {
                sounds.playClick();
                onReload();
              }}
            >
              <span className="material-symbols-outlined text-[15px]">refresh</span>
              {isReloading ? 'Buscando…' : 'Buscar de nuevo'}
            </Button>
          )}
          {extraActions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                sounds.playClick();
                a.onClick();
              }}
              className={`text-[12px] font-bold underline underline-offset-4 ${isLight ? 'text-[#ec4d86]' : 'text-[#ffa3c4]'}`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {reason === 'quota' && resetTime && (
          <p className={`mt-2 font-mono text-[11px] ${muted}`}>Tus perfiles vuelven a las {resetTime}</p>
        )}
      </motion.div>
    </motion.section>
  );
};
