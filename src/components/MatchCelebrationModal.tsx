import React, { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Profile } from '../types';
import { sounds } from '../utils/audio';
import { useAuth } from '../context/AuthContext';
import { computeAffinity } from '../utils/compatibility';
import { Button } from './ui/button';
import { ProfilePhoto } from './ProfilePhoto';

interface MatchCelebrationModalProps {
  profile: Profile | null;
  coinsEarned?: number;
  myAvatar?: string;
  onSendMessage: () => void;
  onClose: () => void;
  /** El diferenciador FINDY: del match al plan en un tap. Opcional para no romper callers. */
  onProposePlan?: () => void;
  /** Fragmento que originó el like (pilar 3). Opcional; si no hay, no se muestra. */
  contextLabel?: string | null;
}

export const MatchCelebrationModal: React.FC<MatchCelebrationModalProps> = ({
  profile,
  coinsEarned = 0,
  myAvatar,
  onSendMessage,
  onClose,
  onProposePlan,
  contextLabel,
}) => {
  const firedFor = useRef<string | null>(null);
  const { user } = useAuth();
  const primaryCtaRef = useRef<HTMLButtonElement>(null);
  // Dismiss por gesto: si el panel se arrastró, el click fantasma al soltar
  // no debe disparar ningún CTA.
  const panelDragged = useRef(false);

  // Foco inicial en la acción principal: teclado y lector entran directo al
  // momento, sin tabear desde el fondo.
  useEffect(() => {
    if (profile) primaryCtaRef.current?.focus({ preventScroll: true });
  }, [profile]);

  // Salida digna de un momento especial: ESC cierra, el fondo no scrollea
  // mientras dura, y el lector de pantalla lo recibe como diálogo.
  useEffect(() => {
    if (!profile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sounds.playClick();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [profile, onClose]);

  // Chip de "interés en común" que faltaba (Match.dc.html): el primer interés que
  // aparece tanto en el perfil propio como en el del match.
  const sharedInterest = useMemo(() => {
    if (!profile || !user) return null;
    const mine = new Set(user.interests.map((i) => i.id));
    return profile.interests.find((i) => mine.has(i.id)) ?? null;
  }, [profile, user]);

  // Ronda 7: el motivo nunca puede faltar. Cadena: fragmento → interés común →
  // señal de afinidad → misma búsqueda. Todo con datos reales del perfil.
  const fallbackReason = useMemo(() => {
    if (!profile || !user || contextLabel || sharedInterest) return null;
    const mine = user.interests.map((i) => i.id);
    const affinity = computeAffinity(profile, mine);
    if (affinity.signals.length > 0) return affinity.signals[0].label;
    if (user.lookingFor && profile.lookingFor && user.lookingFor === profile.lookingFor && profile.lookingForLabel) {
      return `ambos buscan ${profile.lookingForLabel.toLowerCase()}`;
    }
    return null;
  }, [profile, user, contextLabel, sharedInterest]);

  useEffect(() => {
    if (!profile || firedFor.current === profile.id) return;
    firedFor.current = profile.id;
    const colors = ['#ec4d86', '#ff6b9e', '#ffa3c4', '#ffffff'];
    const burst = (originX: number) =>
      confetti({
        particleCount: 60,
        angle: originX < 0.5 ? 60 : 120,
        spread: 65,
        startVelocity: 45,
        origin: { x: originX, y: 0.65 },
        colors,
        zIndex: 110,
        disableForReducedMotion: true,
      });
    burst(0.15);
    burst(0.85);
    const fallTimer = window.setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 100,
        startVelocity: 30,
        origin: { x: 0.5, y: 0.3 },
        colors,
        zIndex: 110,
        disableForReducedMotion: true,
      });
    }, 200);
    return () => window.clearTimeout(fallTimer);
  }, [profile]);

  return (
    <AnimatePresence>
      {profile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 min-[380px]:p-6 overflow-y-auto">
          {/* p-4 en teléfonos chicos (320px): el p-6 fijo robaba 48px al panel.
              overflow-y-auto + my-auto en el panel: en landscape o pantallas
              bajas el contenido scrollea en vez de cortar los CTAs. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 14 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            // Deslizar hacia abajo cierra, como un bottom-sheet: gesto nativo
            // en mobile. Solo vertical y con elástico corto para no pelear con
            // el scroll del contenedor en pantallas bajas.
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.4}
            onDragStart={() => { panelDragged.current = false; }}
            onDrag={(_, info) => { if (Math.abs(info.offset.y) > 12) panelDragged.current = true; }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 550) {
                sounds.playClick();
                onClose();
              }
            }}
            onClickCapture={(e) => {
              if (panelDragged.current) {
                panelDragged.current = false;
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            className="relative z-10 w-full max-w-[340px] flex flex-col items-center text-center my-auto touch-pan-y"
            role="dialog"
            aria-modal="true"
            aria-label={`Es un match con ${profile.displayName}`}
          >
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              aria-label="Cerrar"
              className="absolute -top-2 right-0 w-11 h-11 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <span className="text-[11px] font-extrabold tracking-[0.2em] text-[#ffa3c4] uppercase mt-2">Findy</span>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="text-[40px] leading-none italic font-semibold text-white mt-3"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Es un match
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-[14px] text-white/75 mt-2 leading-snug max-w-[260px]"
            >
              A vos y a {profile.displayName} les gustaron mutuamente
            </motion.p>

            {/* El "por qué" antes que cualquier acción: primero lo específico
                (el fragmento que originó este match), después lo compartido. */}
            {contextLabel && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="mt-3 flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-white/10 border border-white/15 px-3.5 py-1.5 max-w-[280px]"
              >
                <span className="material-symbols-outlined text-[16px] text-[var(--coral-300)]">
                  auto_stories
                </span>
                <span className="text-[12.5px] font-medium text-white/90 truncate">
                  Conectaron por: {contextLabel}
                </span>
              </motion.div>
            )}

            {sharedInterest && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.48, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className={`${contextLabel ? 'mt-2' : 'mt-3'} flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-white/10 border border-white/15 px-3.5 py-1.5 max-w-[280px]`}
              >
                <span className="material-symbols-outlined text-[16px] text-[var(--coral-300)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  favorite
                </span>
                <span className="text-[12.5px] font-medium text-white/90 truncate">
                  A ambos les gusta {sharedInterest.name.toLowerCase()}
                </span>
              </motion.div>
            )}

            {fallbackReason && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.48, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="mt-3 flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-white/10 border border-white/15 px-3.5 py-1.5 max-w-[280px]"
              >
                <span className="material-symbols-outlined text-[16px] text-[var(--coral-300)]">
                  auto_stories
                </span>
                <span className="text-[12.5px] font-medium text-white/90 truncate">
                  En común: {fallbackReason}
                </span>
              </motion.div>
            )}

            {coinsEarned > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.55, type: 'spring', stiffness: 340, damping: 20 }}
                className="mt-3 flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-white/10 border border-white/15 px-3.5 py-1.5"
              >
                <span className="material-symbols-outlined text-[16px] text-amber-300" style={{ fontVariationSettings: "'FILL' 1" }}>
                  monetization_on
                </span>
                <span className="text-[13px] font-bold text-white">+{coinsEarned} monedas</span>
              </motion.div>
            )}

            <div className="relative flex items-center justify-center mt-8 mb-9 h-[120px] w-[208px]">
              <motion.div
                initial={{ opacity: 0, x: 16, rotate: -6 }}
                animate={{ opacity: 1, x: 0, rotate: -6 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 20 }}
                className="absolute left-0 w-28 h-28 rounded-full p-[3px] bg-gradient-to-br from-[#ff6b9e] to-[#ec4d86]/40 shadow-elevation-lg"
              >
                <div className="w-full h-full rounded-full overflow-hidden border-[3px] border-[#0f1a2e] bg-white/10 flex items-center justify-center">
                  {myAvatar ? (
                    <img src={myAvatar} alt="Vos" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-white/80 text-[26px] font-bold" aria-hidden="true">
                      {(user?.displayName ?? 'V').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -16, rotate: 6 }}
                animate={{ opacity: 1, x: 0, rotate: 6 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 20 }}
                className="absolute right-0 w-28 h-28 rounded-full p-[3px] bg-gradient-to-br from-[#ec4d86]/40 to-[#ff6b9e] shadow-elevation-lg"
              >
                <div className="w-full h-full rounded-full overflow-hidden border-[3px] border-[#0f1a2e]">
                  <ProfilePhoto
                    url={profile.photos[0]?.url}
                    name={profile.displayName}
                    className="w-full h-full"
                  />
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 400, damping: 18 }}
                className="absolute z-10 w-12 h-12 rounded-full bg-gradient-to-br from-[#ec4d86] to-[#ff6b9e] flex items-center justify-center shadow-[0_8px_22px_rgba(236,77,134,0.6)] ring-4 ring-[#0f1a2e]"
              >
                <span className="material-symbols-outlined text-[22px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                  favorite
                </span>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="w-full flex flex-col gap-2.5"
            >
              {onProposePlan ? (
                <Button
                  ref={primaryCtaRef}
                  variant="primary"
                  type="button"
                  onClick={() => {
                    sounds.playStamp();
                    onProposePlan();
                  }}
                  className="w-full h-13 rounded-[var(--radius-pill)] text-[15px] font-bold flex items-center justify-center gap-2"
                  style={{ color: 'var(--ink-on-coral)' }}
                >
                  <span className="material-symbols-outlined text-[19px]">local_cafe</span>
                  Proponer un plan
                </Button>
              ) : (
                <Button
                  ref={primaryCtaRef}
                  variant="primary"
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onSendMessage();
                  }}
                  className="w-full h-13 rounded-[var(--radius-pill)] text-[15px] font-bold"
                  style={{ color: 'var(--ink-on-coral)' }}
                >
                  Enviar mensaje
                </Button>
              )}
              {onProposePlan && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onSendMessage();
                  }}
                  className="w-full h-13 rounded-[var(--radius-pill)] border border-white/25 text-white/85 text-[14px] font-bold transition-all duration-150 active:scale-[0.98] hover:bg-white/5"
                >
                  Enviar mensaje primero
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onClose();
                }}
                className="w-full h-13 rounded-[var(--radius-pill)] border border-white/25 text-white/85 text-[14px] font-bold transition-all duration-150 active:scale-[0.98] hover:bg-white/5"
              >
                Seguir explorando
              </button>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
