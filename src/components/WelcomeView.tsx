import React from 'react';
import { motion } from 'motion/react';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';

interface WelcomeViewProps {
  onCreateAccount: () => void;
  onGoToLogin: () => void;
}

// Pantalla de bienvenida (hero) que faltaba antes del formulario de login — per
// Main.dc.html del diseño aprobado: wordmark + link "Ya tengo cuenta" arriba, una
// tarjeta ilustrada con glow coral detrás, titular editorial en dos líneas (la
// segunda en coral itálica) y dos CTAs (crear cuenta / ya tengo cuenta). Antes
// LoginView arrancaba directo en el formulario, sin ningún momento de marca.
//
// Quien recién la descarga no sabe qué son los coins, la Tienda ni el pasaporte, así
// que acá se vende primero la idea (gente en serio, citas reales) y después se explica
// en tres pasos cómo funciona, sin jerga de la app.
const HOW_IT_WORKS = [
  {
    icon: 'verified_user',
    title: 'Gente real',
    text: 'Verificás tu perfil con una selfie y ves quién más lo hizo. Así sabés con quién hablás.',
  },
  {
    icon: 'forum',
    title: 'Charlas con intención',
    text: 'Pocos matches, bien elegidos. Si nadie escribe en 48 h, el match se enfría.',
  },
  {
    icon: 'local_cafe',
    title: 'Se ven en persona',
    text: 'Proponés una cita, escanean un QR al encontrarse y los dos ganan premios.',
  },
] as const;

const EASE = [0.16, 1, 0.3, 1] as const;

export const WelcomeView: React.FC<WelcomeViewProps> = ({ onCreateAccount, onGoToLogin }) => {
  const { isLight } = useTheme();

  return (
    <div
      className="w-full max-w-[420px] mx-auto px-6 flex flex-col text-ink"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
    >
      {/* Top bar: wordmark + "Ya tengo cuenta" (atajo con área táctil de 44px). */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="flex items-center justify-between h-11"
      >
        <span className="font-wordmark text-[24px] italic font-bold leading-none" style={{ color: 'var(--coral-500)' }}>
          Findy
        </span>
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onGoToLogin();
          }}
          className="text-link h-11 -mr-2 px-2 inline-flex items-center text-[13.5px]"
        >
          Ya tengo cuenta
        </button>
      </motion.div>

      {/* Hero: glow coral + tarjeta ilustrada apilada */}
      <div className="relative flex items-center justify-center h-[224px] my-2">
        <div
          className="absolute w-[300px] h-[300px] rounded-full pointer-events-none"
          style={{
            background: isLight
              ? 'radial-gradient(circle, rgba(255,107,158,0.22) 0%, rgba(255,107,158,0) 68%)'
              : 'radial-gradient(circle, rgba(255,107,158,0.3) 0%, rgba(255,107,158,0) 68%)',
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: -8 }}
          transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
          className="absolute w-[152px] h-[194px] rounded-[var(--radius-lg)]"
          style={{
            background: isLight ? '#ffffff' : 'var(--midnight-700)',
            border: `1px solid ${isLight ? 'rgba(22,34,59,0.08)' : 'var(--hairline-strong)'}`,
            boxShadow: isLight ? '0 18px 40px -20px rgba(10,17,32,0.35)' : 'var(--shadow-lg)',
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotate: 8 }}
          animate={{ opacity: 1, scale: 1, rotate: 5 }}
          transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
          className="relative z-10 w-[158px] h-[202px] rounded-[var(--radius-lg)] overflow-hidden"
          style={{
            background: 'linear-gradient(155deg, var(--coral-700) 0%, var(--coral-500) 55%, var(--coral-300) 100%)',
            boxShadow: '0 24px 48px -20px rgba(201,54,109,0.55)',
          }}
        >
          <div className="absolute top-3 left-3 h-7 px-2.5 rounded-[var(--radius-pill)] bg-white/92 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--coral-600)', fontVariationSettings: "'FILL' 1" }}>
              verified
            </span>
            <span className="text-[11px] font-extrabold leading-none" style={{ color: 'var(--coral-700)' }}>
              Perfil verificado
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-4 pt-10 bg-gradient-to-t from-[#3a0a1e]/70 via-[#3a0a1e]/20 to-transparent">
            <p className="text-white text-[17px] font-extrabold leading-none tracking-[-0.01em]">Clara, 29</p>
            <p className="text-white/85 text-[12px] mt-2 leading-snug italic" style={{ fontFamily: 'var(--font-display)' }}>
              "Nunca pensé que iba a volver a tener ganas de conocer a alguien."
            </p>
          </div>
        </motion.div>
      </div>

      {/* Titular editorial */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: EASE }}
        className="mt-1 mb-5"
      >
        <h1 className="t-display text-[31px] text-ink">
          Acá conocés gente
          <br />
          <span className="italic" style={{ color: 'var(--coral-500)' }}>
            en serio.
          </span>
        </h1>
        <p className="t-body-sm text-[14px] text-ink-muted mt-2.5 max-w-[36ch]">
          Findy no es para scrollear perfiles toda la noche: es para salir y conocerse en persona.
        </p>
      </motion.div>

      {/* Cómo funciona */}
      <motion.ol
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4, ease: EASE }}
        className="flex flex-col gap-3 mb-6"
      >
        {HOW_IT_WORKS.map((step) => (
          <li key={step.title} className="flex items-start gap-3.5">
            <span className="icon-tile w-9 h-9 rounded-xl">
              <span className="material-symbols-outlined text-[19px]">{step.icon}</span>
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[14.5px] font-bold leading-tight text-ink">{step.title}</p>
              <p className="t-caption text-[12.5px] text-ink-muted mt-0.5">{step.text}</p>
            </div>
          </li>
        ))}
      </motion.ol>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4, ease: EASE }}
        className="flex flex-col gap-3"
      >
        <button
          id="welcome-create-account-btn"
          type="button"
          onClick={() => {
            sounds.playClick();
            onCreateAccount();
          }}
          className="btn-pill btn-pill-primary"
        >
          Crear cuenta gratis
        </button>
        <button
          id="welcome-goto-login-btn"
          type="button"
          onClick={() => {
            sounds.playClick();
            onGoToLogin();
          }}
          className="btn-pill btn-pill-secondary"
        >
          Ya tengo cuenta
        </button>
      </motion.div>

      {/* Trust line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        className="flex items-center justify-center gap-1.5 mt-4"
      >
        <span className="material-symbols-outlined text-[15px]" style={{ color: 'var(--coral-500)', fontVariationSettings: "'FILL' 1" }}>
          verified
        </span>
        <span className="t-caption text-ink-muted">Gratis para empezar. Sin tarjeta.</span>
      </motion.div>
    </div>
  );
};
