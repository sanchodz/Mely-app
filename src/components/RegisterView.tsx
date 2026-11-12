import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { ARGENTINA_CITIES } from '../data/mockData';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { updateProfile, replacePrompts, uploadPhoto, listInterests } from '../lib/api/profile';
import { redeemCode } from '../lib/api/wallet';
import { ApiError } from '../lib/apiClient';
import { toast } from 'sonner';
import { isPasswordValid } from '../lib/passwordRules';
import { PasswordStrengthChecklist } from './PasswordStrengthChecklist';
import type { Gender } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { GoogleAuthButton, isGoogleAuthAvailable } from './GoogleAuthButton';
import type { GooglePrefill } from './LoginView';

interface RegisterViewProps {
  onGoToLogin: () => void;
  googlePrefill?: GooglePrefill | null;
}

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'WOMAN', label: 'Mujer' },
  { value: 'MAN', label: 'Hombre' },
  { value: 'NON_BINARY', label: 'No binario' },
  { value: 'OTHER', label: 'Otro' },
];

const FIELD_LABELS: Record<string, string> = {
  displayName: 'nombre',
  bio: 'bio',
  city: 'ciudad',
  job: 'trabajo',
  seeking: 'a quién te gustaría conocer',
  interestIds: 'intereses',
  email: 'correo',
  password: 'contraseña',
  dateOfBirth: 'fecha de nacimiento',
};

/**
 * Cuando el backend rechaza el registro por validación (código VALIDATION), la API
 * manda el detalle campo por campo (zod .flatten()) pero acá solo se mostraba el
 * mensaje genérico "Datos inválidos" — sin decir cuál campo ni por qué, así que quien
 * lo veía no tenía forma de corregirlo. Esto arma un mensaje concreto a partir de esos
 * detalles cuando existen, y si no, cae al mensaje del server tal cual.
 */
function describeValidationError(err: ApiError): string {
  const details = err.details as { fieldErrors?: Record<string, string[]> } | undefined;
  const firstField = details?.fieldErrors ? Object.keys(details.fieldErrors)[0] : undefined;
  const firstMessage = firstField ? details?.fieldErrors?.[firstField]?.[0] : undefined;
  if (firstField && firstMessage) {
    const label = FIELD_LABELS[firstField] ?? firstField;
    return `Revisá el campo "${label}": ${firstMessage}`;
  }
  return err.message;
}

function isAdult(dateOfBirth: string): boolean {
  if (!dateOfBirth) return false;
  // Comparación por fecha calendario (no por ms/365.25): el cálculo anterior
  // fallaba por horas de zona horaria justo el día del cumpleaños 18.
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age >= 18;
}

export const RegisterView: React.FC<RegisterViewProps> = ({ onGoToLogin, googlePrefill }) => {
  const { isLight } = useTheme();
  const { register, refreshUser, loginWithGoogle, registerWithGoogle } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState(1);

  const goToStep = (next: 1 | 2 | 3) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  // Step 1
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<Gender>('WOMAN');
  const [seeking, setSeeking] = useState<Gender[]>(['MAN']);
  const [city, setCity] = useState(ARGENTINA_CITIES[0]);
  const [job, setJob] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step1Error, setStep1Error] = useState('');
  const [googleData, setGoogleData] = useState<GooglePrefill | null>(googlePrefill ?? null);

  useEffect(() => {
    if (!googlePrefill) return;
    setGoogleData(googlePrefill);
    setEmail(googlePrefill.email);
    setName((prev) => prev || (googlePrefill.name ?? ''));
  }, [googlePrefill]);

  const handleGoogleCredential = async (idToken: string) => {
    setStep1Error('');
    sounds.playClick();
    try {
      const result = await loginWithGoogle(idToken);
      if (result.needsProfile) {
        setGoogleData({ pendingToken: result.pendingToken, email: result.email, name: result.name });
        setEmail(result.email);
        setName((prev) => prev || (result.name ?? ''));
      }
      // Si needsProfile es false ya existe una cuenta vinculada a ese Google: loginWithGoogle
      // ya dejó la sesión iniciada y App.tsx va a sacarnos de este formulario solo.
    } catch (err) {
      setStep1Error(
        err instanceof ApiError ? err.message : 'No pudimos conectar con Google. Probá de nuevo.',
      );
    }
  };

  // Step 2
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Step 3
  const [bio, setBio] = useState('');
  const [availableInterests, setAvailableInterests] = useState<{ id: string; slug: string; name: string }[]>([]);
  const [selectedInterestIds, setSelectedInterestIds] = useState<string[]>([]);
  const [promptQ, setPromptQ] = useState('Mi cita ideal no negociable...');
  const [promptA, setPromptA] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    listInterests()
      .then(setAvailableInterests)
      .catch(() => undefined);
  }, []);

  const toggleSeeking = (g: Gender) => {
    sounds.playClick();
    setSeeking((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const toggleInterest = (id: string) => {
    sounds.playClick();
    setSelectedInterestIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
  };

  const avatarObjectUrl = useRef<string | null>(null);
  // Las URLs de createObjectURL hay que revocarlas: cada foto elegida y
  // descartada dejaba un blob vivo en memoria.
  useEffect(() => () => {
    if (avatarObjectUrl.current) URL.revokeObjectURL(avatarObjectUrl.current);
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    // Permite volver a elegir el mismo archivo después de cambiar de idea.
    e.target.value = '';
    setAvatarFile(file);
    if (avatarObjectUrl.current) {
      URL.revokeObjectURL(avatarObjectUrl.current);
      avatarObjectUrl.current = null;
    }
    const url = file ? URL.createObjectURL(file) : null;
    avatarObjectUrl.current = url;
    setAvatarPreview(url);
  };

  const handleStep1Continue = () => {
    setStep1Error('');
    if (!name.trim() || !dateOfBirth || !email.trim() || (!googleData && !password)) {
      setStep1Error('Completá todos los campos obligatorios.');
      return;
    }
    // El backend exige mínimo 2 caracteres (displayName: z.string().min(2)) pero acá
    // solo se chequeaba que no estuviera vacío — con un nombre de una sola letra dejaba
    // avanzar hasta el paso 3 y recién ahí fallaba con un "Datos inválidos" genérico,
    // sin decir qué campo era ni volver al paso donde se puede corregir.
    if (name.trim().length < 2) {
      setStep1Error('El nombre tiene que tener al menos 2 caracteres.');
      return;
    }
    // Mismo problema que el nombre: la contraseña también tiene reglas del backend
    // (assertPassword en sanitize.ts) que acá no se chequeaban antes de avanzar — el
    // checklist visual de abajo ya las muestra en vivo, esto solo bloquea "Continuar"
    // si todavía falta alguna.
    if (!googleData && !isPasswordValid(password, email)) {
      setStep1Error('Completá los requisitos de la contraseña.');
      return;
    }
    if (!isAdult(dateOfBirth)) {
      setStep1Error('FINDY es exclusivamente para mayores de 18 años.');
      return;
    }
    if (!seeking.length) {
      setStep1Error('Elegí a quién te gustaría conocer.');
      return;
    }
    sounds.playClick();
    goToStep(2);
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!acceptTerms || !acceptPrivacy) return;

    setIsIssuing(true);
    sounds.playStamp();
    try {
      if (googleData) {
        await registerWithGoogle({
          pendingToken: googleData.pendingToken,
          dateOfBirth,
          acceptTerms: true,
          acceptPrivacy: true,
        });
      } else {
        await register({
          email: email.trim(),
          password,
          dateOfBirth,
          acceptTerms: true,
          acceptPrivacy: true,
        });
      }

      await updateProfile({
        displayName: name.trim(),
        gender,
        seeking,
        lookingFor: 'UNSURE',
        bio: bio.trim() || undefined,
        city,
        job: job.trim() || undefined,
        interestIds: selectedInterestIds,
      });

      if (promptA.trim()) {
        await replacePrompts([{ question: promptQ.trim() || 'Mi cita ideal...', answer: promptA.trim() }]);
      }

      if (avatarFile) {
        // La cuenta ya está creada: una foto que falla no debe frenar el alta, pero tampoco perderse en silencio.
        await uploadPhoto(avatarFile).catch((err: unknown) => {
          toast.error('No pudimos subir tu foto', {
            description: `${err instanceof Error ? err.message : 'Probá de nuevo.'} Podés agregarla desde tu perfil.`,
          });
        });
      }

      await redeemCode('WELCOME').catch(() => undefined);
      await refreshUser();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.code === 'EMAIL_TAKEN'
            ? 'Ese correo ya tiene una cuenta registrada. Iniciá sesión.'
            : err.code === 'VALIDATION'
              ? describeValidationError(err)
              : err.message
          : 'No pudimos completar el registro. Probá de nuevo.';
      setSubmitError(message);
      setIsIssuing(false);
    }
  };

  const stepTitle = step === 1 ? 'Creá tu cuenta' : step === 2 ? 'Tu foto' : 'Bio e intereses';
  const stepSubtitle =
    step === 1
      ? 'Sumate a FINDY y empezá a conocer gente real, verificada.'
      : step === 2
      ? 'Elegí una foto clara donde se te vea bien. Podés cambiarla después.'
      : 'Contá un poco de vos para romper el hielo.';

  const slideVariants: Variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
    center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
    exit: (dir: number) => ({ opacity: 0, x: dir * -24, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-[420px] mx-auto px-6 flex flex-col text-ink"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)' }}
    >
      {/* Back + step dots, onboarding chrome */}
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            if (step > 1) {
              goToStep((step - 1) as 1 | 2 | 3);
            } else {
              onGoToLogin();
            }
          }}
          className={`w-11 h-11 -ml-2.5 rounded-full flex items-center justify-center focus:outline-none cursor-pointer transition-colors ${
            isLight ? 'text-[#16223b] hover:bg-black/5' : 'text-[#f5f1e8] hover:bg-white/8'
          }`}
          aria-label="Volver"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        {/* Progreso: 3 segmentos iguales + "Paso n de 3" para que el avance se lea sin contar barritas. */}
        <div className="flex-1 flex items-center gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} aria-label={`Paso ${step} de 3`}>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-1.5 flex-1 max-w-[48px] rounded-full transition-all duration-300 ${step >= n ? 'bg-[#ec4d86]' : isLight ? 'bg-black/10' : 'bg-white/12'}`}
            />
          ))}
        </div>
        <span className="t-caption font-bold text-ink-muted tabular-nums">Paso {step} de 3</span>
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={`header-${step}`}
          custom={direction}
          initial={{ opacity: 0, x: direction * 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="t-display text-[30px] text-ink block">{stepTitle}</span>
          <p className="t-body text-ink-muted mt-2.5 mb-7 max-w-[34ch]">{stepSubtitle}</p>
        </motion.div>
      </AnimatePresence>

      <form onSubmit={handleCompleteRegistration} className="flex flex-col gap-5">
       <AnimatePresence mode="wait" custom={direction}>
        {/* STEP 1: Personal Identification */}
        {step === 1 && (
          <motion.div
            key="step-1"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col gap-5"
          >
            {step1Error && (
              <div className="form-alert" role="alert">
                <span className="material-symbols-outlined text-[18px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                <span>{step1Error}</span>
              </div>
            )}

            <div>
              <Label className="mb-2 block">Nombre</Label>
              <Input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mariel Juárez" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-2 block">Fecha de nacimiento</Label>
                <Input type="date" required value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>

              <div>
                <Label className="mb-2 block">Ciudad</Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARGENTINA_CITIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-2 block">Género</Label>
                <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block">Ocupación</Label>
                <Input type="text" value={job} onChange={(e) => setJob(e.target.value)} placeholder="Opcional" />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Buscás conocer a</Label>
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.map((g) => {
                  const isSelected = seeking.includes(g.value);
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => toggleSeeking(g.value)}
                      className={`h-10 px-4 rounded-full text-[13.5px] font-bold transition-all border-[1.5px] cursor-pointer active:scale-[0.97] ${
                        isSelected
                          ? 'bg-[#ff6b9e] text-[#3a0a1e] border-[#ff6b9e]'
                          : isLight
                          ? 'bg-transparent text-[#16223b] border-black/15 hover:border-[#ec4d86]/50'
                          : 'bg-transparent text-[#f5f1e8] border-white/15 hover:border-[#ff6b9e]/50'
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Email</Label>
              <Input
                type="email"
                required
                readOnly={Boolean(googleData)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu.correo@findy.app"
                className={googleData ? 'opacity-70' : ''}
              />
            </div>

            {googleData ? (
              <div className="form-alert form-alert-success items-center">
                <span className="material-symbols-outlined text-[18px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                <span>Cuenta verificada con Google. No necesitás contraseña.</span>
              </div>
            ) : (
              <div>
                <Label className="mb-2 block">Contraseña</Label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres, letras y números"
                />
                <PasswordStrengthChecklist password={password} email={email} />
              </div>
            )}

            <Button type="button" variant="primary" size="lg" onClick={handleStep1Continue} className="mt-1 w-full">
              Continuar
            </Button>

            {!googleData && isGoogleAuthAvailable() && (
              <>
                <div className="or-divider mt-1">
                  <span>o continuá con</span>
                </div>
                <GoogleAuthButton onCredential={handleGoogleCredential} text="signup_with" />
              </>
            )}
          </motion.div>
        )}

        {/* STEP 2: Photo */}
        {step === 2 && (
          <motion.div
            key="step-2"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col gap-5"
          >
            <div className="flex flex-col items-center gap-4 py-4">
              <div
                className={`relative w-36 h-36 rounded-full overflow-hidden flex items-center justify-center ${
                  avatarPreview ? '' : 'border-2 border-dashed'
                } ${isLight ? 'border-[#ec4d86]/40 bg-[#ff6b9e]/10' : 'border-[#ff6b9e]/40 bg-[#ff6b9e]/12'}`}
                style={avatarPreview ? { boxShadow: '0 0 0 3px var(--coral-500), 0 16px 32px -16px rgba(255,107,158,0.5)' } : undefined}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <span className="material-symbols-outlined text-[56px] text-[#ec4d86]">add_a_photo</span>
                )}
              </div>
              <label
                className={`btn-pill btn-pill-secondary !w-auto !h-11 !px-5 text-[14px] ${isLight ? 'text-[#ec4d86]' : 'text-[#ffa3c4]'}`}
              >
                <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                {avatarFile ? 'Cambiar foto' : 'Subir foto'}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
              </label>
              <p className="t-body-sm text-ink-muted text-center max-w-[280px]">
                Podés subirla ahora o después desde tu perfil.
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              onClick={() => {
                sounds.playClick();
                goToStep(3);
              }}
              size="lg"
              className="mt-1 w-full"
            >
              Continuar
            </Button>
          </motion.div>
        )}

        {/* STEP 3: Bio, Prompts, Interests, and Terms */}
        {step === 3 && (
          <motion.div
            key="step-3"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col gap-5"
          >
            {submitError && (
              <div className="form-alert" role="alert">
                <span className="material-symbols-outlined text-[18px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                <span>{submitError}</span>
              </div>
            )}

            <div>
              <Label className="mb-2 block">Bio</Label>
              <Textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Contá tus afinidades, gustos y lo que buscás compartir en un encuentro..."
              />
            </div>

            <div>
              <Label className="mb-2 block">Intereses ({selectedInterestIds.length}/6)</Label>
              <div className="flex flex-wrap gap-2">
                {availableInterests.map((interest) => {
                  const isSelected = selectedInterestIds.includes(interest.id);
                  return (
                    <button
                      key={interest.id}
                      type="button"
                      onClick={() => toggleInterest(interest.id)}
                      className={`h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all border-[1.5px] cursor-pointer active:scale-[0.97] ${
                        isSelected
                          ? 'bg-[#ff6b9e] text-[#3a0a1e] border-[#ff6b9e] font-bold'
                          : isLight
                          ? 'bg-transparent text-[#16223b] border-black/15 hover:border-[#ec4d86]/50'
                          : 'bg-transparent text-[#f5f1e8] border-white/15 hover:border-[#ff6b9e]/50'
                      }`}
                    >
                      {interest.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Un prompt para romper el hielo (opcional)</Label>
              <Input
                type="text"
                value={promptQ}
                onChange={(e) => setPromptQ(e.target.value)}
                className="mb-2 font-semibold text-[#ec4d86] dark:text-[#ffa3c4]"
              />
              <Input type="text" value={promptA} onChange={(e) => setPromptA(e.target.value)} placeholder="Tu respuesta..." />
            </div>

            {/* Single combined consent block, not a wall of checkboxes */}
            <div className="flex flex-col gap-2.5">
              <Label className="flex items-start gap-3 cursor-pointer select-none text-[13.5px] font-medium leading-relaxed text-ink-muted py-1">
                <Checkbox required checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(v === true)} className="mt-px shrink-0" />
                <span>Acepto los <strong>Términos y condiciones</strong> de FINDY.</span>
              </Label>
              <Label className="flex items-start gap-3 cursor-pointer select-none text-[13.5px] font-medium leading-relaxed text-ink-muted py-1">
                <Checkbox required checked={acceptPrivacy} onCheckedChange={(v) => setAcceptPrivacy(v === true)} className="mt-px shrink-0" />
                <span>Acepto la <strong>Política de privacidad</strong> y la verificación presencial en cada encuentro.</span>
              </Label>
            </div>

            <Button
              id="register-submit-btn"
              type="submit"
              variant="primary"
              size="lg"
              disabled={isIssuing || !acceptTerms || !acceptPrivacy}
              className="w-full mt-1"
            >
              {isIssuing ? (
                <span className="inline-flex items-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  Creando tu cuenta...
                </span>
              ) : (
                'Crear cuenta'
              )}
            </Button>
          </motion.div>
        )}
       </AnimatePresence>
      </form>

      <div className="mt-8 flex items-center justify-center gap-1.5 min-h-[44px]">
        <span className="text-[14px] text-ink-muted">¿Ya tenés cuenta?</span>
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onGoToLogin();
          }}
          className="text-link text-[14px] h-11 px-1 inline-flex items-center"
        >
          Iniciá sesión
        </button>
      </div>
    </motion.div>
  );
};
