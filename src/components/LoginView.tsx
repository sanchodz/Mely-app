import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { forgotPassword } from '../lib/api/auth';
import { ApiError } from '../lib/apiClient';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent } from './ui/dialog';
import { GoogleAuthButton, isGoogleAuthAvailable } from './GoogleAuthButton';

export type GooglePrefill = { pendingToken: string; email: string; name?: string };

interface LoginViewProps {
  onGoToRegister: () => void;
  onGoogleNeedsProfile: (data: GooglePrefill) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onGoToRegister, onGoogleNeedsProfile }) => {
  const { isLight, toggleTheme } = useTheme();
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const recoveryTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (recoveryTimer.current !== null) window.clearTimeout(recoveryTimer.current);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim()) {
      setErrorMsg('Por favor ingresá tu correo electrónico.');
      return;
    }
    if (!password) {
      setErrorMsg('Por favor ingresá tu contraseña.');
      return;
    }

    setIsSubmitting(true);
    sounds.playClick();
    try {
      await login(email.trim(), password);
      sounds.playStamp();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.code === 'UNAUTHORIZED'
            ? 'Email o contraseña incorrectos.'
            : err.message
          : 'No pudimos conectar con el servidor. Probá de nuevo.';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleCredential = async (idToken: string) => {
    setErrorMsg('');
    sounds.playClick();
    try {
      const result = await loginWithGoogle(idToken);
      if (result.needsProfile) {
        onGoogleNeedsProfile({ pendingToken: result.pendingToken, email: result.email, name: result.name });
      } else {
        sounds.playStamp();
      }
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError ? err.message : 'No pudimos conectar con Google. Probá de nuevo.',
      );
    }
  };

  const handleSendRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    sounds.playStamp();
    try {
      await forgotPassword(recoveryEmail.trim());
      setRecoverySent(true);
      // Si se desmonta (cambio de pantalla) antes de los 2.5s, el timer se limpia arriba.
      if (recoveryTimer.current !== null) window.clearTimeout(recoveryTimer.current);
      recoveryTimer.current = window.setTimeout(() => {
        recoveryTimer.current = null;
        setShowRecoveryModal(false);
        setRecoverySent(false);
        setRecoveryEmail('');
      }, 2500);
    } catch {
      setRecoveryError('No pudimos enviar el enlace. Probá de nuevo en un momento.');
    }
  };

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
  } satisfies Variants;
  const item = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
  } satisfies Variants;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="w-full max-w-[420px] mx-auto px-6 flex flex-col justify-center text-ink"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}
    >
      {/* Theme toggle, unobtrusive corner control */}
      <motion.button
        variants={item}
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          sounds.playClick();
          toggleTheme();
        }}
        className={`self-end w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
          isLight ? 'bg-black/[0.05] text-[#16223b] hover:bg-black/[0.08]' : 'bg-white/8 text-[#f5f1e8] hover:bg-white/14'
        }`}
        title="Cambiar tema de color"
        aria-label="Cambiar tema de color"
      >
        <motion.span
          key={isLight ? 'light' : 'dark'}
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="material-symbols-outlined text-[20px] block"
        >
          {isLight ? 'dark_mode' : 'light_mode'}
        </motion.span>
      </motion.button>

      {/* Wordmark + one-line promise */}
      <motion.div variants={item} className="mt-4 mb-8">
        <span className="font-wordmark text-[22px] font-bold text-[#ec4d86] tracking-[0.02em] block leading-none">FINDY</span>
        <h1 className="t-display text-ink mt-4">
          Bienvenida
          <br />
          <span className="italic" style={{ color: 'var(--coral-500)' }}>de vuelta.</span>
        </h1>
        <p className="t-body text-ink-muted mt-3 max-w-[32ch]">Iniciá sesión para seguir tus citas y conversaciones.</p>
      </motion.div>

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="form-alert" role="alert">
              <span className="material-symbols-outlined text-[18px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
              <span>{errorMsg}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.form variants={item} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu.correo@ejemplo.com"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center h-5">
            <Label htmlFor="login-pass">Contraseña</Label>
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setShowRecoveryModal(true);
              }}
              className="text-link text-[13px] -my-2 py-2 -mr-1 px-1"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <div className="relative flex items-center">
            <Input
              id="login-pass"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresá tu contraseña"
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1 w-11 h-11 rounded-full flex items-center justify-center focus:outline-none cursor-pointer text-ink-muted hover:text-ink transition-colors"
              aria-label="Ver u ocultar contraseña"
            >
              <span className="material-symbols-outlined text-[21px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
        </div>

        <Label className="flex items-center gap-2.5 cursor-pointer select-none min-h-[44px] -my-2 text-[14px] font-medium text-ink-muted">
          <Checkbox checked={rememberMe} onCheckedChange={(v) => setRememberMe(v === true)} />
          Recordar mi sesión
        </Label>

        <motion.div whileTap={{ scale: 0.97 }}>
          <Button
            id="login-submit-btn"
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting}
            className="w-full mt-1"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                Iniciando sesión...
              </span>
            ) : (
              'Iniciar sesión'
            )}
          </Button>
        </motion.div>
      </motion.form>

      {isGoogleAuthAvailable() && (
      <motion.div variants={item} className="or-divider my-6">
        <span>o continuá con</span>
      </motion.div>
      )}

      <motion.div variants={item}>
        <GoogleAuthButton onCredential={handleGoogleCredential} text="signin_with" />
      </motion.div>

      <motion.div variants={item} className="mt-8 flex items-center justify-center gap-1.5 min-h-[44px]">
        <span className="text-[14px] text-ink-muted">¿No tenés cuenta?</span>
        <button
          id="btn-switch-register"
          type="button"
          onClick={() => {
            sounds.playClick();
            onGoToRegister();
          }}
          className="text-link text-[14px] h-11 px-1 inline-flex items-center"
        >
          Registrate
        </button>
      </motion.div>

      {/* Password Recovery Modal */}
      <Dialog open={showRecoveryModal} onOpenChange={setShowRecoveryModal}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[360px] p-6 gap-2">
          <div className="icon-tile mb-1">
            <span className="material-symbols-outlined text-[22px]">lock_reset</span>
          </div>
          <h3 className="t-title text-ink pr-8">Recuperar contraseña</h3>
          <p className="t-body-sm text-ink-muted mb-3">
            Ingresá el correo asociado a tu cuenta para recibir un enlace seguro de restablecimiento.
          </p>

          {recoverySent ? (
            <div className="form-alert form-alert-success justify-center text-center font-medium">
              Si el correo existe, te enviamos un enlace de restablecimiento. Revisá tu bandeja.
            </div>
          ) : (
            <form onSubmit={handleSendRecovery} className="flex flex-col gap-3">
              {recoveryError && (
                <div className="form-alert" role="alert">
                  {recoveryError}
                </div>
              )}
              <Input
                type="email"
                required
                placeholder="tu.correo@ejemplo.com"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
              />
              <Button type="submit" variant="primary" size="lg" className="w-full">
                Enviar enlace de recuperación
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
