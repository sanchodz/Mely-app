import React, { useMemo, useRef, useState } from 'react';
import { motion, type Variants } from 'motion/react';
import { toast } from 'sonner';
import { Stamp } from '../types';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useStamps } from '../hooks/useStamps';
import { useWallet } from '../hooks/useWallet';
import {
  useDeletePhoto,
  useSubmitVerificationSelfie,
  useUploadAudioBio,
  useUploadPhoto,
} from '../hooks/useProfile';
import { Button } from './ui/button';

interface ProfileViewProps {
  onSelectStamp: (stamp: Stamp) => void;
  onOpenFullSettings?: () => void;
  onOpenStore?: () => void;
  onSignOut: () => void;
}

const MAX_PHOTOS = 6;

/** Niveles del pasaporte por sellos desbloqueados — progresión sin paywall ni rachas. */
const PASSPORT_LEVELS = [
  { at: 0, name: 'Nueva historia' },
  { at: 1, name: 'Primera cita' },
  { at: 3, name: 'Exploradora' },
  { at: 6, name: 'Habitante FINDY' },
  { at: 10, name: 'Leyenda' },
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  onSelectStamp,
  onOpenFullSettings,
  onOpenStore,
  onSignOut,
}) => {
  const { isLight } = useTheme();
  const { user, refreshUser } = useAuth();
  const { data: stamps = [] } = useStamps();
  const { data: wallet } = useWallet();
  const uploadAudioBio = useUploadAudioBio();
  const submitVerificationSelfie = useSubmitVerificationSelfie();
  const uploadPhoto = useUploadPhoto();
  const deletePhoto = useDeletePhoto();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // % de completitud del perfil — heurística simple sobre las señales que el
  // diseño (MyProfile.dc.html) destaca como "lo que falta": fotos, bio, prompts,
  // intereses, audio-bio y verificación de identidad.
  const completeness = useMemo(() => {
    if (!user) return { pct: 0, hint: '' };
    const checks: { done: boolean; hint: string }[] = [
      { done: user.photos.length >= 4, hint: 'Agregá una foto más para brillar y aparecer en más descubrimientos.' },
      { done: Boolean(user.bio && user.bio.trim().length > 0), hint: 'Contá algo de vos en tu bio.' },
      { done: user.prompts.length > 0, hint: 'Respondé al menos un prompt para romper el hielo.' },
      { done: user.interests.length >= 3, hint: 'Sumá tus intereses para conectar por lo que te gusta.' },
      { done: Boolean(user.audioBio), hint: 'Grabá tu audio-bio: los perfiles con voz generan más matches.' },
      { done: user.badges.verification === 'VERIFIED', hint: 'Verificá tu identidad y sumá el tilde azul.' },
    ];
    const done = checks.filter((c) => c.done).length;
    const pct = Math.round((done / checks.length) * 100);
    const nextHint = checks.find((c) => !c.done)?.hint ?? '¡Tu perfil está completo!';
    return { pct, hint: nextHint };
  }, [user]);

  if (!user) return null;

  const unlockedStamps = stamps.filter((s) => s.unlocked);
  const walletBalance = wallet?.balance ?? 0;

  const passportLevel =
    [...PASSPORT_LEVELS].reverse().find((l) => unlockedStamps.length >= l.at) ?? PASSPORT_LEVELS[0];
  const nextPassportLevel = PASSPORT_LEVELS.find((l) => l.at > unlockedStamps.length) ?? null;
  const passportProgress = nextPassportLevel
    ? Math.min(1, unlockedStamps.length / nextPassportLevel.at)
    : 1;

  const trustChecks = [
    { done: user.emailVerified, label: 'Correo verificado' },
    { done: user.phoneVerified, label: 'Teléfono verificado' },
    { done: user.badges.verification === 'VERIFIED', label: 'Identidad verificada' },
    { done: user.badges.trusted, label: 'Citas verificadas' },
  ];

  const handleInvite = async () => {
    sounds.playClick();
    const shareText = 'Pasaporte de citas reales, no catálogo. Sumate a FINDY.';
    const shareUrl = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'FINDY', text: shareText, url: shareUrl });
        return;
      }
      throw new Error('share no disponible');
    } catch (err) {
      // Cerrar el sheet nativo no es un error: solo se silencia esa salida.
      if (err instanceof Error && err.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
        toast.success('Enlace copiado', { description: 'Pasalo por donde quieras.' });
      } catch {
        toast.error('No se pudo compartir', { description: 'Copiá el enlace manualmente.' });
      }
    }
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadPhoto.mutate(file, {
      onSuccess: () => {
        sounds.playNotification();
        refreshUser();
      },
      onError: (err: any) => toast.error(err?.message ?? 'No se pudo subir la foto'),
    });
    e.target.value = '';
  };

  const handleDeletePhoto = (photoId: string) => {
    if (user.photos.length <= 1) {
      toast.error('Necesitás al menos una foto en tu perfil.');
      return;
    }
    deletePhoto.mutate(photoId, {
      onSuccess: () => {
        toast.success('Foto eliminada.');
        refreshUser();
      },
      onError: (err: any) => toast.error(err?.message ?? 'No se pudo eliminar la foto'),
    });
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadAudioBio.mutate(file, {
      onSuccess: () => {
        sounds.playNotification();
        refreshUser();
      },
      onError: (err: any) => toast.error(err?.message ?? 'No se pudo subir el audio'),
    });
    e.target.value = '';
  };

  const handleSelfieFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    submitVerificationSelfie.mutate(file, {
      onSuccess: () => {
        sounds.playNotification();
        toast.success('Selfie enviada — la revisamos y te avisamos.');
        refreshUser();
      },
      onError: (err: any) => toast.error(err?.message ?? 'No se pudo enviar la selfie'),
    });
    e.target.value = '';
  };

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  };

  // Un solo lenguaje de superficies en toda la vista: tarjeta blanca/medianoche
  // con borde hairline y sombra suave; "sunken" para bloques internos.
  const cardStyle = {
    background: isLight ? '#FFFFFF' : 'var(--midnight-900)',
    borderColor: isLight ? 'var(--color-line)' : 'var(--hairline-strong)',
  };
  const sunkenStyle = {
    background: isLight ? 'var(--color-canvas)' : 'var(--midnight-950)',
    borderColor: isLight ? 'var(--color-line)' : 'var(--hairline)',
  };
  const mutedText = isLight ? 'var(--text-on-light-muted)' : 'var(--text-secondary)';
  const faintText = isLight ? 'var(--text-on-light-muted)' : 'var(--text-tertiary)';
  const primaryText = isLight ? 'var(--text-on-light)' : 'var(--text-primary)';
  const trackBg = isLight ? 'var(--color-line)' : 'var(--midnight-700)';
  const coralTile = { background: 'rgba(255,107,158,0.14)', color: 'var(--coral-500)' };

  // Función, no componente: definida dentro del render, un componente se remontaría en cada cambio.
  const sectionHeading = (title: string, aside?: React.ReactNode) => (
    <div className="flex items-end justify-between gap-3 px-0.5">
      <h2 className="text-[21px] italic font-semibold leading-tight" style={{ fontFamily: 'var(--font-display)', color: primaryText }}>
        {title}
      </h2>
      {aside}
    </div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-6 pb-8">
      {/* Header: título + acceso a Ajustes — reemplaza el botón de gear "flotante"
          suelto que había antes, per MyProfile.dc.html. */}
      <motion.div variants={item} className="flex items-center justify-between">
        <h1 className="text-[28px] italic font-semibold leading-none" style={{ fontFamily: 'var(--font-display)', color: primaryText }}>
          Mi perfil
        </h1>
        <Button
          variant="tertiary"
          size="icon"
          onClick={() => {
            sounds.playClick();
            onOpenFullSettings?.();
          }}
          className="w-11 h-11 rounded-full border shadow-elevation-sm"
          aria-label="Ajustes"
          style={cardStyle}
        >
          <span className="material-symbols-outlined text-[22px]" style={{ color: mutedText }}>
            settings
          </span>
        </Button>
      </motion.div>

      {/* Identity: avatar + nombre + verificación */}
      <motion.section variants={item} className="flex items-center gap-4">
        <div className="relative shrink-0">
          <div
            className="w-[92px] h-[92px] rounded-full p-[3px]"
            style={{ background: 'linear-gradient(135deg, var(--coral-600), var(--coral-300))' }}
          >
            <div
              className="w-full h-full rounded-full overflow-hidden border-[3px]"
              style={{ background: 'linear-gradient(155deg, var(--midnight-500), var(--midnight-800))', borderColor: isLight ? 'var(--color-canvas)' : '#0A1120' }}
            >
              {user.photos[0]?.url && (
                <img src={user.photos[0].url} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              photoInputRef.current?.click();
            }}
            aria-label="Editar foto"
            className="absolute bottom-0 right-0 w-9 h-9 rounded-full flex items-center justify-center border-[3px] shadow-elevation-sm"
            style={{ background: 'var(--coral-500)', borderColor: isLight ? 'var(--color-canvas)' : '#0A1120' }}
          >
            <span className="material-symbols-outlined text-[15px]" style={{ color: 'var(--ink-on-coral)' }}>
              edit
            </span>
          </button>
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="text-[24px] italic font-semibold leading-tight truncate" style={{ fontFamily: 'var(--font-display)', color: primaryText }}>
            {user.displayName}, {user.age}
          </span>
          {user.badges.verification === 'VERIFIED' && (
            <span
              className="self-start inline-flex items-center gap-1 h-6 pl-1.5 pr-2.5 rounded-full text-[12px] font-bold"
              style={{ background: 'rgba(127,191,160,0.16)', color: 'var(--success-500)' }}
              title="Identidad verificada"
            >
              <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                verified
              </span>
              Perfil verificado
            </span>
          )}
          <span className="text-[13.5px] leading-snug" style={{ color: mutedText }}>
            {[user.job, user.city].filter(Boolean).join(' · ') || user.membership.tierLabel}
          </span>
        </div>
      </motion.section>

      {/* Recompensas / Tienda — antes vivía como una tarjeta de wallet al final; el
          diseño la sube arriba como promo de primer nivel. */}
      {onOpenStore && (
        <motion.button
          variants={item}
          type="button"
          onClick={() => {
            sounds.playClick();
            onOpenStore();
          }}
          className="flex items-center gap-3.5 rounded-[var(--radius-lg)] border p-4 text-left shadow-elevation-sm transition-transform active:scale-[0.98]"
          style={{
            background: isLight ? 'linear-gradient(150deg,#FFFFFF,var(--cream-050))' : 'linear-gradient(150deg, var(--midnight-700), var(--midnight-900))',
            borderColor: isLight ? 'var(--color-line)' : 'var(--hairline-strong)',
          }}
        >
          <div className="w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center shrink-0" style={coralTile}>
            <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              monetization_on
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: faintText }}>
              Recompensas
            </p>
            <p className="text-[20px] font-bold leading-tight tabular-nums mt-0.5" style={{ color: primaryText }}>
              {walletBalance.toLocaleString('es-AR')} <span className="text-[14px] font-semibold" style={{ color: mutedText }}>coins</span>
            </p>
            <p className="text-[12.5px] mt-0.5 leading-snug" style={{ color: mutedText }}>
              Canjeá lo que ganaste avanzando conexiones
            </p>
          </div>
          <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: isLight ? 'var(--color-canvas)' : 'var(--midnight-950)', color: 'var(--coral-500)' }}>
            <span className="material-symbols-outlined text-[22px]">chevron_right</span>
          </span>
        </motion.button>
      )}

      {/* Completitud */}
      <motion.section variants={item} className="rounded-[var(--radius-lg)] border p-4 flex flex-col gap-3 shadow-elevation-sm" style={cardStyle}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] font-bold" style={{ color: primaryText }}>
            Tu perfil está al {completeness.pct}%
          </span>
          <span className="text-[13px] font-bold tabular-nums px-2 h-6 inline-flex items-center rounded-full" style={coralTile}>
            {completeness.pct}%
          </span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={completeness.pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Completitud del perfil"
          style={{ background: trackBg }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${completeness.pct}%`, background: 'linear-gradient(90deg, var(--coral-600), var(--coral-500))' }}
          />
        </div>
        <span className="text-[13px] leading-snug" style={{ color: mutedText }}>
          {completeness.hint}
        </span>
      </motion.section>

      {/* Fotos */}
      <motion.section variants={item} className="flex flex-col gap-3">
        {sectionHeading(
          'Fotos',
          <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: faintText }}>
            {user.photos.length} de {MAX_PHOTOS}
          </span>,
        )}
        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFileChange} />
        <div className="grid grid-cols-3 gap-2.5">
          {user.photos.map((photo, index) => (
            <div key={photo.id} className="relative aspect-[4/5] rounded-[var(--radius-md)] overflow-hidden group shadow-elevation-sm">
              <img src={photo.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              {index === 0 && (
                <span
                  className="absolute bottom-2 left-2 h-6 px-2 rounded-full inline-flex items-center text-[10.5px] font-bold uppercase tracking-wide text-white"
                  style={{ background: 'rgba(10,17,32,0.6)', backdropFilter: 'blur(6px)' }}
                >
                  Principal
                </span>
              )}
              {/* Siempre visible: con opacity-0 + group-hover era imposible
                  borrar fotos en táctil (no hay hover). Misma estética. */}
              <button
                type="button"
                onClick={() => handleDeletePhoto(photo.id)}
                disabled={deletePhoto.isPending}
                aria-label="Eliminar foto"
                className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white/90 hover:bg-black/75 hover:text-white active:scale-90 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          ))}
          {user.photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                photoInputRef.current?.click();
              }}
              disabled={uploadPhoto.isPending}
              aria-label="Agregar foto"
              className="aspect-[4/5] rounded-[var(--radius-md)] border-[1.5px] border-dashed flex flex-col items-center justify-center gap-1.5"
              style={{ borderColor: isLight ? 'rgba(22,34,59,0.18)' : 'var(--hairline-strong)', background: isLight ? 'var(--cream-050)' : 'var(--midnight-900)' }}
            >
              <span className="w-10 h-10 rounded-full flex items-center justify-center" style={coralTile}>
                <span className={`material-symbols-outlined text-[22px] ${uploadPhoto.isPending ? 'motion-safe:animate-spin' : ''}`}>
                  {uploadPhoto.isPending ? 'progress_activity' : 'add'}
                </span>
              </span>
              <span className="text-[11.5px] font-semibold" style={{ color: mutedText }}>
                Agregar
              </span>
            </button>
          )}
        </div>
      </motion.section>

      {/* Prompts */}
      {user.prompts.length > 0 && (
        <motion.section variants={item} className="flex flex-col gap-3">
          {sectionHeading('Mis prompts')}
          <div className="flex flex-col gap-2.5">
            {user.prompts.map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-3 rounded-[var(--radius-lg)] border p-4 shadow-elevation-sm"
                style={cardStyle}
              >
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <span className="section-kicker">{p.question}</span>
                  <span className="text-[16px] italic leading-snug" style={{ fontFamily: 'var(--font-display)', color: primaryText }}>
                    {p.answer}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onOpenFullSettings?.();
                  }}
                  aria-label="Editar prompt"
                  className="hit-slop shrink-0 w-9 h-9 -mr-1 -mt-1 rounded-full flex items-center justify-center"
                  style={sunkenStyle}
                >
                  <span className="material-symbols-outlined text-[17px]" style={{ color: mutedText }}>
                    edit
                  </span>
                </button>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Intereses */}
      <motion.section variants={item} className="flex flex-col gap-3">
        {sectionHeading('Intereses')}
        <div className="flex flex-wrap items-center gap-2">
          {user.interests.map((interest) => (
            <span
              key={interest.id}
              className="h-9 px-3.5 rounded-[var(--radius-pill)] border flex items-center text-[13px] font-semibold"
              style={{ ...cardStyle, color: primaryText }}
            >
              {interest.name}
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onOpenFullSettings?.();
            }}
            aria-label="Editar intereses"
            className="hit-slop h-9 px-3 rounded-[var(--radius-pill)] border border-dashed flex items-center gap-1 text-[13px] font-semibold"
            style={{ borderColor: isLight ? 'rgba(22,34,59,0.18)' : 'var(--hairline-strong)', color: 'var(--coral-500)' }}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Editar
          </button>
        </div>
      </motion.section>

      {/* --- Más de tu perfil: audio-bio, verificación y sellos — funcionalidad real
          que el mockup no cubre, pero que hay que mantener; se agrupa acá abajo con
          menor jerarquía en vez de competir con la identidad/fotos/prompts de arriba. */}
      <motion.section variants={item} className="flex flex-col gap-3">
        {sectionHeading('Más de tu perfil')}

        <div className="rounded-[var(--radius-lg)] border shadow-elevation-sm overflow-hidden divide-y" style={cardStyle}>
          {/* Audio-bio */}
          <div className="p-4 flex items-center gap-3.5" style={{ borderColor: cardStyle.borderColor }}>
            {user.audioBio ? (
              <>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    if (isPlaying) audioPlayerRef.current?.pause();
                    else audioPlayerRef.current?.play();
                  }}
                  aria-label={isPlaying ? 'Pausar audio-bio' : 'Reproducir audio-bio'}
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-[var(--shadow-coral)]"
                  style={{ background: isPlaying ? 'var(--coral-600)' : 'var(--coral-500)', color: 'var(--ink-on-coral)' }}
                >
                  <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </motion.button>
                <div className="flex-1 min-w-0">
                  <span className="block text-[14.5px] font-bold" style={{ color: primaryText }}>Mi audio-bio</span>
                  <span className="block text-[12.5px] mt-0.5" style={{ color: mutedText }}>
                    {user.audioBio.durationSec != null ? `${user.audioBio.durationSec}s · ` : ''}tocá para escuchar
                  </span>
                </div>
                <audio
                  ref={audioPlayerRef}
                  src={user.audioBio.url}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
              </>
            ) : (
              <>
                <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={coralTile}>
                  <span className="material-symbols-outlined text-[22px]">mic</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-[14.5px] font-bold" style={{ color: primaryText }}>Agregá tu audio-bio</span>
                  <span className="block text-[12.5px] mt-0.5" style={{ color: mutedText }}>Un audio corto de hasta 60 segundos</span>
                </div>
                <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioFileChange} />
                <Button variant="primary" onClick={() => audioInputRef.current?.click()} disabled={uploadAudioBio.isPending} className="rounded-full shrink-0 h-10 px-4 text-[13px]">
                  {uploadAudioBio.isPending ? 'Subiendo...' : 'Subir'}
                </Button>
              </>
            )}
          </div>

          {/* Verificación */}
          {user.badges.verification !== 'VERIFIED' && (
            <div className="p-4 flex items-center gap-3.5" style={{ borderColor: cardStyle.borderColor }}>
              {user.badges.verification === 'PHOTO' ? (
                <>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(227,184,115,0.15)', color: 'var(--warning-500)' }}>
                    <span className="material-symbols-outlined text-[22px]">hourglass_top</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[14.5px] font-bold" style={{ color: primaryText }}>Selfie en revisión</span>
                    <span className="block text-[12.5px] mt-0.5" style={{ color: mutedText }}>Te avisamos apenas la revisemos</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(127,191,160,0.15)', color: 'var(--success-500)' }}>
                    <span className="material-symbols-outlined text-[22px]">verified</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[14.5px] font-bold" style={{ color: primaryText }}>Verificá tu perfil</span>
                    <span className="block text-[12.5px] mt-0.5" style={{ color: mutedText }}>Una selfie rápida y sumás el tilde azul</span>
                  </div>
                  <input ref={selfieInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleSelfieFileChange} />
                  <Button variant="primary" onClick={() => selfieInputRef.current?.click()} disabled={submitVerificationSelfie.isPending} className="rounded-full shrink-0 h-10 px-4 text-[13px]">
                    {submitVerificationSelfie.isPending ? 'Enviando...' : 'Verificar'}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Confianza visible por capas: lo verificado suma, lo pendiente invita. */}
          <div className="p-4 flex flex-col gap-2.5" style={{ borderColor: cardStyle.borderColor }}>
            <div className="flex items-center justify-between">
              <span className="text-[14.5px] font-bold" style={{ color: primaryText }}>Confianza</span>
              <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: faintText }}>
                {trustChecks.filter((c) => c.done).length} de {trustChecks.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {trustChecks.map((check) => (
                <div key={check.label} className="flex items-center gap-2 min-w-0">
                  <span
                    className="material-symbols-outlined text-[18px] shrink-0"
                    style={{
                      color: check.done ? 'var(--success-500)' : isLight ? 'rgba(22,34,59,0.25)' : 'var(--text-tertiary)',
                      fontVariationSettings: check.done ? "'FILL' 1" : undefined,
                    }}
                    aria-hidden="true"
                  >
                    {check.done ? 'check_circle' : 'circle'}
                  </span>
                  <span className="text-[13px] font-medium truncate" style={{ color: check.done ? primaryText : mutedText }}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Nivel del pasaporte: la retención es el recuerdo, no la racha. */}
          <div className="p-4 flex flex-col gap-2.5" style={{ borderColor: cardStyle.borderColor }}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14.5px] font-bold" style={{ color: primaryText }}>
                Nivel: {passportLevel.name}
              </span>
              <span className="text-[12.5px] font-semibold tabular-nums shrink-0" style={{ color: faintText }}>
                {nextPassportLevel ? `${unlockedStamps.length} de ${nextPassportLevel.at} sellos` : `${unlockedStamps.length} sellos`}
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.round(passportProgress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progreso al siguiente nivel del pasaporte`}
              style={{ background: trackBg }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.round(passportProgress * 100)}%`, background: 'linear-gradient(90deg, var(--coral-600), var(--coral-500))' }}
              />
            </div>
            <span className="text-[12.5px] leading-snug" style={{ color: mutedText }}>
              {nextPassportLevel
                ? `A ${nextPassportLevel.at - unlockedStamps.length} ${nextPassportLevel.at - unlockedStamps.length === 1 ? 'sello' : 'sellos'} de “${nextPassportLevel.name}” — cada cita verificada deja uno.`
                : 'Nivel máximo: tu pasaporte es leyenda.'}
            </span>
          </div>

          {/* Sellos, compactos — antes era una grilla de 4 columnas a toda ancho justo
              debajo del header; ahora es una franja secundaria más chica. */}
          <div className="p-4 flex flex-col gap-3" style={{ borderColor: cardStyle.borderColor }}>
            <div className="flex items-baseline justify-between">
              <span className="text-[14.5px] font-bold" style={{ color: primaryText }}>Sellos</span>
              <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: faintText }}>{unlockedStamps.length} de {stamps.length}</span>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
              {stamps.map((stamp) => (
                <button
                  key={stamp.key}
                  type="button"
                  onClick={() => {
                    sounds.playStamp();
                    onSelectStamp(stamp);
                  }}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-16 focus:outline-none"
                >
                  <div
                    className="w-13 h-13 rounded-full flex items-center justify-center"
                    style={
                      stamp.unlocked
                        ? coralTile
                        : { border: `1.5px dashed ${isLight ? 'rgba(22,34,59,0.18)' : 'var(--hairline-strong)'}`, color: isLight ? 'rgba(22,34,59,0.3)' : 'var(--text-tertiary)' }
                    }
                  >
                    <span className="material-symbols-outlined text-[22px]" style={stamp.unlocked ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                      {stamp.unlocked ? stamp.iconName : 'lock'}
                    </span>
                  </div>
                  <span className="text-[10.5px] font-semibold text-center leading-tight w-16 truncate" style={{ color: stamp.unlocked ? primaryText : mutedText }}>
                    {stamp.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Invitar: crecimiento por recomendación, con share nativo o portapapeles. */}
          <div className="p-4 flex items-center gap-3.5" style={{ borderColor: cardStyle.borderColor }}>
            <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={coralTile}>
              <span className="material-symbols-outlined text-[22px]">group_add</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-[14.5px] font-bold" style={{ color: primaryText }}>Invitá a tus amigas</span>
              <span className="block text-[12.5px] mt-0.5" style={{ color: mutedText }}>Las mejores conexiones llegan recomendadas</span>
            </div>
            <Button variant="primary" onClick={handleInvite} className="rounded-full shrink-0 h-10 px-4 text-[13px]">
              Invitar
            </Button>
          </div>
        </div>
      </motion.section>

      <motion.button
        variants={item}
        whileTap={{ scale: 0.95 }}
        type="button"
        onClick={() => {
          sounds.playClick();
          onSignOut();
        }}
        className="self-center inline-flex items-center gap-1.5 text-[14px] font-bold cursor-pointer min-h-[44px] px-4 rounded-full"
        style={{ color: 'var(--coral-500)' }}
      >
        <span className="material-symbols-outlined text-[18px]">logout</span>
        Cerrar sesión
      </motion.button>
    </motion.div>
  );
};
