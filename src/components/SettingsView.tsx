import React, { useEffect, useState } from 'react';
import { motion, type Variants } from 'motion/react';
import { toast } from 'sonner';
import { ARGENTINA_CITIES } from '../data/mockData';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useInterests, useUpdateProfile, useReplacePrompts, useDeleteAccount, useUpdateLocation } from '../hooks/useProfile';
import { useRequestPhoneCode, useVerifyPhone } from '../hooks/useAuth';
import { useBlockedUsers, useUnblockUser } from '../hooks/useModeration';
import { usePushSubscription } from '../hooks/usePushSubscription';
import { getCurrentCoords } from '../lib/geolocation';
import { ApiError } from '../lib/apiClient';
import type { Gender, LookingFor, Prompt } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent } from './ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';

interface SettingsViewProps {
  onSignOut: () => void;
}

type SheetId = 'profile' | 'prompts' | 'discovery' | 'phone' | 'blocked' | null;

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'WOMAN', label: 'Mujer' },
  { value: 'MAN', label: 'Hombre' },
  { value: 'NON_BINARY', label: 'No binario' },
  { value: 'OTHER', label: 'Otro' },
];

const LOOKING_FOR_OPTIONS: { value: LookingFor; label: string }[] = [
  { value: 'RELATIONSHIP', label: 'Relación seria' },
  { value: 'CASUAL', label: 'Algo casual' },
  { value: 'FRIENDSHIP', label: 'Amistad' },
  { value: 'UNSURE', label: 'Todavía no sé' },
];

// --- Fila de lista reutilizable, patrón "Ajustes" estándar de apps mobile ---
interface RowProps {
  icon: string;
  label: string;
  description?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  danger?: boolean;
  isLight: boolean;
}

// Fila estándar de Ajustes: ícono líder en un tile tintado (orienta más rápido que
// el texto solo), label a 15px, descripción neutra y chevron solo cuando navega.
// Alto mínimo 56px para que cada fila sea un objetivo táctil cómodo.
const SettingsRow: React.FC<RowProps> = ({ icon, label, description, onClick, trailing, danger, isLight }) => {
  const content = (
    <>
      <span
        className={`w-9 h-9 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 ${
          danger
            ? 'bg-red-500/12 text-red-500'
            : isLight
              ? 'bg-[var(--coral-100)] text-[var(--coral-700)]'
              : 'bg-[var(--coral-500)]/15 text-[var(--coral-300)]'
        }`}
        aria-hidden="true"
      >
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </span>
      <div className="flex-1 min-w-0 text-left">
        <span className={`block text-[15px] font-semibold leading-snug ${danger ? 'text-red-500' : isLight ? 'text-[var(--text-on-light)]' : 'text-[var(--text-primary)]'}`}>
          {label}
        </span>
        {description && (
          <span className={`block text-[12.5px] mt-0.5 leading-snug ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}>
            {description}
          </span>
        )}
      </div>
      {trailing}
      {onClick && (
        <span className={`material-symbols-outlined text-[22px] shrink-0 ${isLight ? 'text-[var(--text-on-light-muted)]/60' : 'text-[var(--text-tertiary)]'}`} aria-hidden="true">
          chevron_right
        </span>
      )}
    </>
  );

  if (!onClick) {
    return <div className="w-full flex items-center gap-3.5 px-4 py-3 min-h-14">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => {
        sounds.playClick();
        onClick();
      }}
      className={`w-full flex items-center gap-3.5 px-4 py-3 min-h-14 text-left transition-colors cursor-pointer ${
        isLight ? 'hover:bg-[var(--color-canvas)] active:bg-[var(--color-canvas)]' : 'hover:bg-white/5 active:bg-white/5'
      }`}
    >
      {content}
    </button>
  );
};

const SettingsGroup: React.FC<{ title?: string; children: React.ReactNode; isLight: boolean }> = ({ title, children, isLight }) => (
  <div className="flex flex-col gap-2.5">
    {title && <span className="section-kicker px-1">{title}</span>}
    {/* Tarjeta estándar: borde hairline + sombra suave, igual que Perfil y Tienda. */}
    <div
      className={`rounded-[var(--radius-lg)] border overflow-hidden divide-y shadow-elevation-sm ${
        isLight
          ? 'bg-white border-[var(--color-line)] divide-[var(--color-line)]'
          : 'bg-[var(--midnight-900)] border-[var(--hairline-strong)] divide-[var(--hairline)]'
      }`}
    >
      {children}
    </div>
  </div>
);

const StatusPill: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <span
    className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.06em] shrink-0 ${
      ok ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300' : 'bg-amber-500/12 text-amber-600 dark:text-amber-300'
    }`}
  >
    <span className="material-symbols-outlined text-[14px]" style={ok ? { fontVariationSettings: "'FILL' 1" } : undefined} aria-hidden="true">
      {ok ? 'check_circle' : 'schedule'}
    </span>
    {label}
  </span>
);

export const SettingsView: React.FC<SettingsViewProps> = ({ onSignOut }) => {
  const { theme, setTheme, isLight } = useTheme();
  const { user, refreshUser } = useAuth();
  const { data: interests = [] } = useInterests();
  const updateProfile = useUpdateProfile();
  const replacePrompts = useReplacePrompts();
  const deleteAccount = useDeleteAccount();
  const requestPhoneCode = useRequestPhoneCode();
  const verifyPhoneCode = useVerifyPhone();
  const updateLocation = useUpdateLocation();
  const { state: pushState, subscribe: subscribePush, unsubscribe: unsubscribePush } = usePushSubscription();
  const [isTogglingPush, setIsTogglingPush] = useState(false);
  const { data: blockedUsers = [], isLoading: isLoadingBlocked } = useBlockedUsers();
  const unblockUser = useUnblockUser();

  const handleUpdateLocation = async () => {
    sounds.playClick();
    try {
      const coords = await getCurrentCoords();
      await updateLocation.mutateAsync(coords);
      await refreshUser();
      sounds.playStamp();
      toast.success('Ubicación actualizada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pudimos actualizar tu ubicación.');
    }
  };

  const handleTogglePush = async (checked: boolean) => {
    sounds.playClick();
    setIsTogglingPush(true);
    try {
      if (checked) {
        await subscribePush();
        toast.success('Notificaciones push activadas.');
      } else {
        await unsubscribePush();
        toast.success('Notificaciones push desactivadas.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pudimos cambiar la configuración.');
    } finally {
      setIsTogglingPush(false);
    }
  };

  const [activeSheet, setActiveSheet] = useState<SheetId>(null);
  const [phoneStep, setPhoneStep] = useState<'enter' | 'verify'>('enter');
  const [phoneInput, setPhoneInput] = useState(user?.phone ?? '+54 ');
  const [phoneCode, setPhoneCode] = useState('');

  const openPhoneSheet = () => {
    setPhoneStep('enter');
    setPhoneInput(user?.phone ?? '+54 ');
    setPhoneCode('');
    setActiveSheet('phone');
  };

  const handleSendPhoneCode = async () => {
    try {
      await requestPhoneCode.mutateAsync(phoneInput.trim());
      sounds.playClick();
      setPhoneStep('verify');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No pudimos enviar el código. Probá de nuevo.');
    }
  };

  const handleVerifyPhoneCode = async () => {
    try {
      await verifyPhoneCode.mutateAsync(phoneCode.trim());
      await refreshUser();
      sounds.playStamp();
      toast.success('Teléfono verificado correctamente.');
      setActiveSheet(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Código inválido o vencido.');
    }
  };

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [city, setCity] = useState(user?.city ?? ARGENTINA_CITIES[0]);
  const [zone, setZone] = useState(user?.zone ?? '');
  const [job, setJob] = useState(user?.job ?? '');
  const [studies, setStudies] = useState(user?.studies ?? '');
  const [gender, setGender] = useState<Gender>(user?.gender ?? 'WOMAN');
  const [seeking, setSeeking] = useState<Gender[]>(user?.seeking ?? ['MAN']);
  const [lookingFor, setLookingFor] = useState<LookingFor>(user?.lookingFor ?? 'UNSURE');
  const [selectedInterestIds, setSelectedInterestIds] = useState<string[]>(user?.interests.map((i) => i.id) ?? []);
  const [blindTeaser, setBlindTeaser] = useState(user?.blindPrompt?.teaser ?? '');
  const [blindPhilosophy, setBlindPhilosophy] = useState(user?.blindPrompt?.philosophy ?? '');
  const [blindIdealDate, setBlindIdealDate] = useState(user?.blindPrompt?.idealDate ?? '');
  const [prompts, setPrompts] = useState<Prompt[]>(user?.prompts ?? []);

  const [minAge, setMinAge] = useState(user?.minAge ?? 21);
  const [maxAge, setMaxAge] = useState(user?.maxAge ?? 40);
  const [maxDistanceKm, setMaxDistanceKm] = useState(user?.maxDistanceKm ?? 25);

  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setBio(user.bio ?? '');
    setCity(user.city ?? ARGENTINA_CITIES[0]);
    setZone(user.zone ?? '');
    setJob(user.job ?? '');
    setStudies(user.studies ?? '');
    setGender(user.gender);
    setSeeking(user.seeking);
    setLookingFor(user.lookingFor);
    setSelectedInterestIds(user.interests.map((i) => i.id));
    setBlindTeaser(user.blindPrompt?.teaser ?? '');
    setBlindPhilosophy(user.blindPrompt?.philosophy ?? '');
    setBlindIdealDate(user.blindPrompt?.idealDate ?? '');
    setPrompts(user.prompts);
    setMinAge(user.minAge);
    setMaxAge(user.maxAge);
    setMaxDistanceKm(user.maxDistanceKm);
  }, [user]);

  if (!user) return null;

  const toggleSeeking = (g: Gender) => {
    sounds.playClick();
    setSeeking((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const toggleInterest = (id: string) => {
    sounds.playClick();
    setSelectedInterestIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 20) return prev;
      return [...prev, id];
    });
  };

  const addPrompt = () => {
    if (prompts.length >= 5) return;
    setPrompts((prev) => [...prev, { id: `new-${Date.now()}`, question: '', answer: '' }]);
  };

  // El backend no hace merge parcial de minAge/maxAge (si no vienen en el body los
  // resetea a 18-99), así que cualquier guardado — venga del panel que venga — manda
  // el estado completo. Así los 3 botones de "Guardar" son intercambiables y ninguno
  // pisa por accidente lo que se editó en otro panel.
  const saveAll = async (successMessage: string) => {
    if (seeking.length === 0) {
      toast.error('Elegí al menos a quién querés conocer.');
      return;
    }
    try {
      await updateProfile.mutateAsync({
        displayName,
        gender,
        seeking,
        lookingFor,
        bio: bio || null,
        city: city || null,
        zone: zone || null,
        job: job || null,
        studies: studies || null,
        interestIds: selectedInterestIds,
        blindPromptTeaser: blindTeaser || null,
        blindPromptPhilosophy: blindPhilosophy || null,
        blindPromptIdealDate: blindIdealDate || null,
        maxDistanceKm,
        minAge,
        maxAge,
      });
      await replacePrompts.mutateAsync(prompts.map((p) => ({ question: p.question, answer: p.answer })));
      await refreshUser();
      sounds.playStamp();
      toast.success(successMessage);
      setActiveSheet(null);
    } catch (err: any) {
      toast.error(err?.message ?? 'No se pudo guardar');
    }
  };

  const isSaving = updateProfile.isPending || replacePrompts.isPending;

  const containerVariants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
  };
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={`w-full max-w-[420px] mx-auto flex flex-col gap-6 pb-24 ${isLight ? 'text-[var(--text-on-light)]' : 'text-[var(--text-primary)]'}`}
    >
      <motion.div variants={itemVariants}>
      <SettingsGroup title="Tu perfil" isLight={isLight}>
        <SettingsRow
          isLight={isLight}
          icon="badge"
          label="Editar perfil"
          description="Nombre, bio, ocupación, género e intereses"
          onClick={() => setActiveSheet('profile')}
        />
        <SettingsRow
          isLight={isLight}
          icon="chat_bubble"
          label="Prompts e Icebreakers"
          description={`${prompts.length}/5 prompts · Perfil a ciegas`}
          onClick={() => setActiveSheet('prompts')}
        />
        <SettingsRow
          isLight={isLight}
          icon="radar"
          label="Preferencias de descubrimiento"
          description={`${maxDistanceKm} km · ${minAge}-${maxAge} años`}
          onClick={() => setActiveSheet('discovery')}
        />
      </SettingsGroup>
      </motion.div>

      <motion.div variants={itemVariants}>
      <SettingsGroup title="Apariencia" isLight={isLight}>
        <SettingsRow
          isLight={isLight}
          icon={isLight ? 'light_mode' : 'dark_mode'}
          label="Modo oscuro"
          description={isLight ? 'Blanco & Coral' : 'Obsidiana & Cereza'}
          trailing={
            <Switch
              checked={!isLight}
              onCheckedChange={(checked) => {
                sounds.playClick();
                setTheme(checked ? 'dark' : 'light');
              }}
              aria-label="Modo oscuro"
            />
          }
        />
        <SettingsRow
          isLight={isLight}
          icon="volume_up"
          label="Sonidos de la app"
          trailing={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  sounds.playStamp();
                }}
                className="h-9 px-3 text-[12px] rounded-full tracking-normal"
              >
                Sello
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  sounds.playCoins();
                }}
                className="h-9 px-3 text-[12px] rounded-full tracking-normal"
              >
                Coins
              </Button>
            </div>
          }
        />
      </SettingsGroup>
      </motion.div>

      {pushState !== 'unsupported' && (
        <motion.div variants={itemVariants}>
        <SettingsGroup title="Notificaciones" isLight={isLight}>
          <SettingsRow
            isLight={isLight}
            icon="notifications_active"
            label="Notificaciones push"
            description={
              pushState === 'denied'
                ? 'Bloqueadas por el navegador — activalas en su configuración de sitio'
                : 'Recibí avisos de matches, citas y monedas aunque tengas la app cerrada'
            }
            trailing={
              <Switch
                checked={pushState === 'subscribed'}
                disabled={pushState === 'denied' || pushState === 'checking' || isTogglingPush}
                onCheckedChange={handleTogglePush}
                aria-label="Notificaciones push"
              />
            }
          />
        </SettingsGroup>
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
      <SettingsGroup title="Seguridad" isLight={isLight}>
        <SettingsRow
          isLight={isLight}
          icon="mail"
          label="Email"
          trailing={<StatusPill ok={user.emailVerified} label={user.emailVerified ? 'VERIFICADO' : 'PENDIENTE'} />}
        />
        <SettingsRow
          isLight={isLight}
          icon="call"
          label="Teléfono"
          description={user.phoneVerified ? undefined : 'Verificalo por WhatsApp'}
          onClick={user.phoneVerified ? undefined : openPhoneSheet}
          trailing={<StatusPill ok={user.phoneVerified} label={user.phoneVerified ? 'VERIFICADO' : 'PENDIENTE'} />}
        />
        <SettingsRow
          isLight={isLight}
          icon="verified_user"
          label="Verificación de identidad"
          trailing={
            <span className={`inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.06em] shrink-0 ${isLight ? 'bg-[var(--coral-100)] text-[var(--coral-700)]' : 'bg-[var(--coral-500)]/15 text-[var(--coral-300)]'}`}>{user.badges.verificationLabel}</span>
          }
        />
        <SettingsRow
          isLight={isLight}
          icon="block"
          label="Cuentas bloqueadas"
          description={blockedUsers.length > 0 ? `${blockedUsers.length} bloqueada${blockedUsers.length === 1 ? '' : 's'}` : 'No bloqueaste a nadie todavía'}
          onClick={() => setActiveSheet('blocked')}
        />
      </SettingsGroup>
      </motion.div>

      <motion.div variants={itemVariants}>
      <SettingsGroup title="Cuenta" isLight={isLight}>
        <SettingsRow
          isLight={isLight}
          icon="logout"
          label="Cerrar sesión"
          onClick={() => setShowSignOutConfirm(true)}
        />
        <SettingsRow
          isLight={isLight}
          icon="delete_forever"
          label="Eliminar cuenta permanentemente"
          danger
          onClick={() => setShowDeleteConfirm(true)}
        />
      </SettingsGroup>
      </motion.div>

      {/* --- PANEL: Editar Perfil --- */}
      <Sheet open={activeSheet === 'profile'} onOpenChange={(open) => !open && setActiveSheet(null)}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[var(--radius-xl)] flex flex-col gap-5 p-5 pb-8">
          <SheetHeader>
            <SheetTitle>Editar Perfil</SheetTitle>
          </SheetHeader>

          <div>
            <Label className="mb-1.5 block">Nombre</Label>
            <Input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={2} maxLength={40} />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <Label className="mb-1.5 block">Ciudad</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="text-[12px]">
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
            <div>
              <Label className="mb-1.5 block">Barrio / Zona</Label>
              <Input type="text" value={zone} onChange={(e) => setZone(e.target.value)} maxLength={80} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <Label className="mb-1.5 block">Ocupación</Label>
              <Input type="text" value={job} onChange={(e) => setJob(e.target.value)} maxLength={80} />
            </div>
            <div>
              <Label className="mb-1.5 block">Estudios</Label>
              <Input type="text" value={studies} onChange={(e) => setStudies(e.target.value)} maxLength={80} />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Bio</Label>
            <Textarea rows={3} value={bio ?? ''} onChange={(e) => setBio(e.target.value)} maxLength={300} className="text-[12px]" />
          </div>

          <div>
            <Label className="mb-1.5 block">Tu género</Label>
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setGender(g.value);
                  }}
                  className={`h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-all cursor-pointer ${
                    gender === g.value
                      ? 'bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white border-transparent shadow-[var(--shadow-coral)]'
                      : isLight
                      ? 'bg-white border-[var(--color-line)] text-[var(--text-on-light)]'
                      : 'bg-[var(--midnight-950)] border-[var(--hairline-strong)] text-[var(--text-secondary)]'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Buscás conocer a</Label>
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => toggleSeeking(g.value)}
                  className={`h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-all cursor-pointer ${
                    seeking.includes(g.value)
                      ? 'bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white border-transparent shadow-[var(--shadow-coral)]'
                      : isLight
                      ? 'bg-white border-[var(--color-line)] text-[var(--text-on-light)]'
                      : 'bg-[var(--midnight-950)] border-[var(--hairline-strong)] text-[var(--text-secondary)]'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Estás buscando</Label>
            <Select value={lookingFor} onValueChange={(v) => setLookingFor(v as LookingFor)}>
              <SelectTrigger className="text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOOKING_FOR_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">Intereses ({selectedInterestIds.length}/20)</Label>
            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => {
                const isSelected = selectedInterestIds.includes(interest.id);
                return (
                  <button
                    key={interest.id}
                    type="button"
                    onClick={() => toggleInterest(interest.id)}
                    className={`h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white border-transparent shadow-[var(--shadow-coral)]'
                        : isLight
                        ? 'bg-white text-[var(--text-on-light)] border-[var(--color-line)]'
                        : 'bg-[var(--midnight-950)] text-[var(--text-secondary)] border-[var(--hairline-strong)]'
                    }`}
                  >
                    {isSelected ? `✓ ${interest.name}` : `+ ${interest.name}`}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={() => saveAll('Perfil actualizado correctamente.')}
            disabled={isSaving}
            className="w-full h-12 rounded-full gap-2 mt-1 text-[15px]"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            <span>Guardar perfil</span>
          </Button>
        </SheetContent>
      </Sheet>

      {/* --- PANEL: Prompts e Icebreakers --- */}
      <Sheet open={activeSheet === 'prompts'} onOpenChange={(open) => !open && setActiveSheet(null)}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[var(--radius-xl)] flex flex-col gap-5 p-5 pb-8">
          <SheetHeader>
            <SheetTitle>Prompts e Icebreakers</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-2.5">
            <span className="section-kicker">Perfil a ciegas</span>
            <Input
              type="text"
              value={blindTeaser}
              onChange={(e) => setBlindTeaser(e.target.value)}
              maxLength={160}
              placeholder="Un adelanto misterioso de vos..."
              className="text-[12px]"
            />
            <Textarea
              rows={2}
              value={blindPhilosophy}
              onChange={(e) => setBlindPhilosophy(e.target.value)}
              maxLength={300}
              placeholder="Tu filosofía de vida en unas líneas..."
              className="text-[12px]"
            />
            <Textarea
              rows={2}
              value={blindIdealDate}
              onChange={(e) => setBlindIdealDate(e.target.value)}
              maxLength={300}
              placeholder="Tu cita ideal..."
              className="text-[12px]"
            />
          </div>

          <div className={`pt-5 border-t flex flex-col gap-3 ${isLight ? 'border-[var(--color-line)]' : 'border-[var(--hairline)]'}`}>
            <div className="flex items-center justify-between">
              <span className="section-kicker">Prompts de perfil ({prompts.length}/5)</span>
              {prompts.length < 5 && (
                <button type="button" onClick={addPrompt} className="hit-slop h-8 px-2.5 -my-2 rounded-full text-[12.5px] font-bold text-[#ec4d86] flex items-center gap-1 cursor-pointer">
                  <span className="material-symbols-outlined text-[16px]">add</span>Agregar
                </button>
              )}
            </div>
            {prompts.length === 0 && (
              <p className={`text-[13px] leading-snug ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}>
                Todavía no agregaste ninguno. Los prompts aparecen en tu perfil para que rompan el hielo con vos.
              </p>
            )}
            {prompts.map((p, i) => (
              <div key={p.id} className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={p.question}
                    onChange={(e) => setPrompts((prev) => prev.map((x, idx) => (idx === i ? { ...x, question: e.target.value } : x)))}
                    maxLength={120}
                    placeholder="Pregunta"
                    className="flex-1 h-11 font-bold text-[#ec4d86] dark:text-[#ffa3c4]"
                  />
                  <Button
                    type="button"
                    variant="tertiary"
                    size="icon"
                    onClick={() => setPrompts((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-[#ec4d86] shrink-0 w-11 h-11"
                    aria-label="Borrar prompt"
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  value={p.answer}
                  onChange={(e) => setPrompts((prev) => prev.map((x, idx) => (idx === i ? { ...x, answer: e.target.value } : x)))}
                  maxLength={300}
                  placeholder="Tu respuesta"
                  className="text-[12px]"
                />
              </div>
            ))}
          </div>

          <Button type="button" variant="primary" onClick={() => saveAll('Prompts guardados.')} disabled={isSaving} className="w-full h-12 rounded-full mt-1 text-[15px]">
            Guardar prompts
          </Button>
        </SheetContent>
      </Sheet>

      {/* --- PANEL: Preferencias de Descubrimiento --- */}
      <Sheet open={activeSheet === 'discovery'} onOpenChange={(open) => !open && setActiveSheet(null)}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[var(--radius-xl)] flex flex-col gap-5 p-5 pb-8">
          <SheetHeader>
            <SheetTitle>Preferencias de Descubrimiento</SheetTitle>
          </SheetHeader>
          <p className={`text-[13px] leading-snug -mt-2 ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}>
            Estos valores son tu punto de partida cada vez que abrís los filtros de Descubrir.
          </p>

          <div className={`p-4 rounded-[var(--radius-md)] border flex items-center gap-3 ${isLight ? 'bg-[var(--color-canvas)] border-[var(--color-line)]' : 'bg-[var(--midnight-950)] border-[var(--hairline)]'}`}>
            <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isLight ? 'bg-[var(--coral-100)] text-[var(--coral-700)]' : 'bg-[var(--coral-500)]/15 text-[var(--coral-300)]'}`}><span className="material-symbols-outlined text-[20px]">location_on</span></span>
            <div className="flex-1 min-w-0">
              <span className="block text-[14.5px] font-bold">Mi ubicación</span>
              <span className="block text-[12.5px] mt-0.5 text-[var(--text-on-light-muted)] dark:text-[var(--text-secondary)]">
                {user.hasLocation ? 'Activa — se usa para calcular la distancia' : 'No activada — no filtramos por distancia'}
              </span>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={handleUpdateLocation} disabled={updateLocation.isPending} className="shrink-0 h-10 px-4 rounded-full text-[13px]">
              {updateLocation.isPending ? '...' : user.hasLocation ? 'Actualizar' : 'Activar'}
            </Button>
          </div>

          <div className={`p-4 rounded-[var(--radius-md)] border flex flex-col gap-4 ${isLight ? 'bg-[var(--color-canvas)] border-[var(--color-line)]' : 'bg-[var(--midnight-950)] border-[var(--hairline)]'}`}>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-on-light-muted)] dark:text-[var(--text-tertiary)]">Distancia máxima</span>
              <span className="text-[18px] text-[#ec4d86] font-bold tabular-nums">{maxDistanceKm} km</span>
            </div>
            <Slider min={1} max={500} step={1} value={[maxDistanceKm]} onValueChange={([v]) => setMaxDistanceKm(v)} />
          </div>
          <div className={`p-4 rounded-[var(--radius-md)] border flex flex-col gap-4 ${isLight ? 'bg-[var(--color-canvas)] border-[var(--color-line)]' : 'bg-[var(--midnight-950)] border-[var(--hairline)]'}`}>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-on-light-muted)] dark:text-[var(--text-tertiary)]">Rango de edad</span>
              <span className="text-[18px] text-[#ec4d86] font-bold tabular-nums">
                {minAge} - {maxAge} años
              </span>
            </div>
            <Slider
              min={18}
              max={99}
              step={1}
              value={[minAge, maxAge]}
              onValueChange={([lo, hi]) => {
                setMinAge(lo);
                setMaxAge(hi);
              }}
            />
          </div>
          <Button type="button" variant="primary" onClick={() => saveAll('Preferencias de descubrimiento actualizadas.')} disabled={isSaving} className="w-full h-12 rounded-full text-[15px]">
            Guardar preferencias
          </Button>
        </SheetContent>
      </Sheet>

      {/* --- PANEL: Verificar Teléfono --- */}
      <Sheet open={activeSheet === 'phone'} onOpenChange={(open) => !open && setActiveSheet(null)}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[var(--radius-xl)] flex flex-col gap-5 p-5 pb-8">
          <SheetHeader>
            <SheetTitle>Verificar Teléfono</SheetTitle>
          </SheetHeader>

          {phoneStep === 'enter' ? (
            <>
              <p className={`text-[13px] leading-snug -mt-2 ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}>
                Te mandamos un código de 6 dígitos por WhatsApp a este número. Incluí el código de país.
              </p>
              <div>
                <Label className="mb-1.5 block">Número de WhatsApp</Label>
                <Input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+54 9 11 1234-5678"
                  className="h-12 font-mono"
                />
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={handleSendPhoneCode}
                disabled={requestPhoneCode.isPending || !phoneInput.trim()}
                className="w-full h-auto min-h-12 py-3 rounded-full whitespace-normal text-[15px]"
              >
                <span className="block text-center leading-snug">
                  <span className="material-symbols-outlined text-[18px] align-middle mr-1.5">chat</span>
                  {requestPhoneCode.isPending ? 'Enviando...' : 'Enviar código por WhatsApp'}
                </span>
              </Button>
            </>
          ) : (
            <>
              <p className={`text-[13px] leading-snug -mt-2 ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}>
                Te escribimos por WhatsApp a {phoneInput}. Ingresá el código de 6 dígitos que recibiste.
              </p>
              <div>
                <Label className="mb-1.5 block">Código de verificación</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="h-14 text-center font-mono text-[22px] tracking-[0.3em]"
                />
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={handleVerifyPhoneCode}
                disabled={verifyPhoneCode.isPending || phoneCode.length < 4}
                className="w-full h-12 rounded-full gap-2 text-[15px]"
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>{verifyPhoneCode.isPending ? 'Verificando...' : 'Verificar código'}</span>
              </Button>
              <button
                type="button"
                onClick={() => setPhoneStep('enter')}
                className="min-h-11 text-[13px] font-bold text-[#ec4d86] text-center cursor-pointer"
              >
                Usar otro número / reenviar código
              </button>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={activeSheet === 'blocked'} onOpenChange={(open) => !open && setActiveSheet(null)}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[var(--radius-xl)] flex flex-col gap-4 p-5 pb-8">
          <SheetHeader>
            <SheetTitle>Cuentas bloqueadas</SheetTitle>
          </SheetHeader>
          <p className={`text-[13px] leading-snug -mt-2 ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}>
            Las personas que bloqueás no pueden verte, escribirte ni aparecer en tu Descubrir.
          </p>
          {isLoadingBlocked ? (
            <div className="flex flex-col gap-2 mt-1">
              <div className="h-14 rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse" />
              <div className="h-14 rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse" />
            </div>
          ) : blockedUsers.length === 0 ? (
            <div className="flex flex-col items-center text-center py-10 gap-3">
              <span className={`w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center text-[#ec4d86] ${isLight ? 'border-[var(--color-line)] bg-white' : 'border-[var(--hairline-strong)] bg-[var(--midnight-900)]'}`}>
                <span className="material-symbols-outlined text-[26px]">block</span>
              </span>
              <p className={`text-[14px] ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}>No bloqueaste a nadie todavía.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-1">
              {blockedUsers.map((b) => (
                <div
                  key={b.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 min-h-14 rounded-[var(--radius-md)] border ${
                    isLight ? 'bg-white border-[var(--color-line)]' : 'bg-[var(--midnight-900)] border-[var(--hairline-strong)]'
                  }`}
                >
                  <span className="text-[14.5px] font-bold truncate">{b.displayName}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={unblockUser.isPending}
                    onClick={async () => {
                      await unblockUser.mutateAsync(b.id);
                      toast.success(`Desbloqueaste a ${b.displayName}`);
                    }}
                    className="h-9 px-3.5 rounded-full text-[12.5px] shrink-0"
                  >
                    Desbloquear
                  </Button>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={showSignOutConfirm} onOpenChange={setShowSignOutConfirm}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[360px] p-6 text-center flex flex-col gap-3">
          <span className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center ${isLight ? 'bg-[var(--coral-100)] text-[var(--coral-700)]' : 'bg-[var(--coral-500)]/15 text-[var(--coral-300)]'}`}>
            <span className="material-symbols-outlined text-[28px]">logout</span>
          </span>
          <h3 className="text-[22px] italic font-semibold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>¿Cerrar sesión?</h3>
          <p className={`text-[13.5px] leading-snug ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}>Vas a poder volver a ingresar en cualquier momento con tus credenciales.</p>
          <div className="flex gap-2.5 mt-2">
            <Button type="button" variant="secondary" onClick={() => setShowSignOutConfirm(false)} className="flex-1 h-12 rounded-full text-[15px]">
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={() => { setShowSignOutConfirm(false); onSignOut(); }} className="flex-1 h-12 rounded-full text-[15px]">
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[360px] p-6 text-center flex flex-col gap-3">
          <span className="mx-auto w-14 h-14 rounded-full flex items-center justify-center bg-red-500/12 text-red-500">
            <span className="material-symbols-outlined text-[28px]">delete_forever</span>
          </span>
          <h3 className="text-[22px] italic font-semibold leading-tight text-red-500" style={{ fontFamily: 'var(--font-display)' }}>Eliminar cuenta</h3>
          <p className={`text-[13.5px] leading-snug ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}>
            Esta acción es permanente. Se borra tu perfil, matches, mensajes y saldo. No se puede deshacer.
          </p>
          <div className="flex gap-2.5 mt-2">
            <Button type="button" variant="secondary" onClick={() => setShowDeleteConfirm(false)} className="flex-1 h-12 rounded-full text-[15px]">
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                await deleteAccount.mutateAsync();
                setShowDeleteConfirm(false);
                onSignOut();
              }}
              disabled={deleteAccount.isPending}
              className="flex-1 h-12 rounded-full text-[15px]"
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
