import React, { useState } from 'react';
import { toast } from 'sonner';
import { Stamp, PlanType, MeProfile } from '../types';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { useDatesMeta, useProposeDate } from '../hooks/useDates';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader } from './ui/dialog';
import { ProfilePhoto } from './ProfilePhoto';
import { Sheet, SheetContent } from './ui/sheet';

// --- PROPOSE DATE MODAL ---
interface ProposeDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  partnerName: string;
  /** Nota precargada (pilar 3: el fragmento que originó el match viaja al plan). */
  initialNote?: string;
}

function defaultDateTimeLocal(daysAhead: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function daysUntilWeekday(targetDow: number) {
  const today = new Date().getDay();
  return (targetDow - today + 7) % 7;
}

type DayKey = 'hoy' | 'mañana' | 'sabado' | 'domingo';
type TimeKey = 'mañana' | 'tarde' | 'noche' | 'chat';

// Función (no constante de módulo): daysUntilWeekday depende del día actual y la
// app vive abierta por horas — calculado una vez al importar quedaba rancio pasada la medianoche.
function getDayOptions(): { key: DayKey; label: string; daysAhead: number }[] {
  return [
    { key: 'hoy', label: 'Hoy', daysAhead: 0 },
    { key: 'mañana', label: 'Mañana', daysAhead: 1 },
    { key: 'sabado', label: 'Sábado', daysAhead: daysUntilWeekday(6) },
    { key: 'domingo', label: 'Domingo', daysAhead: daysUntilWeekday(0) },
  ];
}

// "Coordinar por chat" (no fija horario, sólo manda lugar y plan) era antes un botón
// aparte que reemplazaba el input de fecha/hora — funcionalidad real que se mantiene,
// pero ahora vive re-acomodada como una cuarta opción dentro de los chips de Horario
// en vez de competir con ellos por su propio espacio.
const TIME_OPTIONS: { key: TimeKey; label: string; hour: number | null }[] = [
  { key: 'mañana', label: 'Mañana', hour: 10 },
  { key: 'tarde', label: 'Tarde', hour: 16 },
  { key: 'noche', label: 'Noche', hour: 20 },
  { key: 'chat', label: 'Coordinar por chat', hour: null },
];

// Chip reutilizable, per Propose.dc.html: fondo/borde/texto coral cuando está activo,
// hairline transparente cuando no.
const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; className?: string; disabled?: boolean }> = ({
  active,
  onClick,
  children,
  className = '',
  disabled = false,
}) => {
  const { isLight } = useTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={`h-10 px-4 rounded-[var(--radius-pill)] border-[1.5px] text-[13.5px] font-bold whitespace-nowrap transition-all active:scale-[0.97] ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      style={
        active
          ? { background: 'var(--coral-500)', borderColor: 'var(--coral-500)', color: 'var(--ink-on-coral)' }
          : {
              background: 'transparent',
              borderColor: isLight ? 'rgba(22,34,59,0.14)' : 'var(--hairline-strong)',
              color: isLight ? 'var(--text-on-light)' : 'var(--text-primary)',
            }
      }
    >
      {children}
    </button>
  );
};

export const ProposeDateModal: React.FC<ProposeDateModalProps> = ({
  isOpen,
  onClose,
  connectionId,
  partnerName,
  initialNote,
}) => {
  const { data: meta } = useDatesMeta();
  const proposeDate = useProposeDate(connectionId);

  const [zone, setZone] = useState('The Roastery, Palermo Soho');
  const [planType, setPlanType] = useState<PlanType>('COFFEE');
  const [dayKey, setDayKey] = useState<DayKey>('sabado');
  const [timeKey, setTimeKey] = useState<TimeKey>('tarde');
  // El modal se remonta en cada apertura (App lo renderiza condicional), así que
  // initialNote llega como estado inicial sin necesidad de sincronizar.
  const [note, setNote] = useState(initialNote ?? 'Un café de especialidad y caminata por la galería.');
  const [showTemplates, setShowTemplates] = useState(false);

  const quickVenues: { zone: string; planType: PlanType; dayKey: DayKey; timeKey: TimeKey }[] = [
    { zone: 'The Roastery, Palermo Soho', planType: 'COFFEE', dayKey: 'sabado', timeKey: 'tarde' },
    { zone: 'Bistró Rosetta, Recoleta', planType: 'FOOD', dayKey: 'domingo', timeKey: 'noche' },
    { zone: 'Speakeasy Florería Atlántico', planType: 'BAR', dayKey: 'sabado', timeKey: 'noche' },
    { zone: 'Café & Libros El Ateneo', planType: 'CHILL', dayKey: 'mañana', timeKey: 'mañana' },
  ];

  const planOptions = meta?.planTypes ?? [
    { value: 'COFFEE' as PlanType, label: 'Café' },
    { value: 'FOOD' as PlanType, label: 'Comer' },
    { value: 'BAR' as PlanType, label: 'Bar' },
  ];

  const dayOptions = getDayOptions();
  const selectedDay = dayOptions.find((d) => d.key === dayKey)!;
  const selectedTime = TIME_OPTIONS.find((t) => t.key === timeKey)!;
  const coordinateByChat = timeKey === 'chat';
  // Horarios ya pasados (con 30min de margen): sin esto se podía proponer "hoy a
  // la mañana" a las 3 de la tarde. Vale también para sábado/domingo cuando caen hoy.
  const nowHours = new Date().getHours() + new Date().getMinutes() / 60;
  const isPastTime = (hour: number | null, daysAhead: number) =>
    hour !== null && daysAhead === 0 && hour <= nowHours + 0.5;

  const handleDaySelect = (key: DayKey) => {
    sounds.playClick();
    setDayKey(key);
    const target = dayOptions.find((d) => d.key === key)!;
    // Si el horario elegido ya pasó en el día destino, mover al siguiente
    // disponible (o a coordinar por chat) en vez de dejar un estado inválido.
    if (timeKey !== 'chat') {
      const currentHour = TIME_OPTIONS.find((t) => t.key === timeKey)?.hour;
      if (isPastTime(currentHour ?? null, target.daysAhead)) {
        const next = TIME_OPTIONS.find((t) => !isPastTime(t.hour, target.daysAhead) && t.hour !== null);
        setTimeKey(next ? next.key : 'chat');
      }
    }
  };
  const summary = `${planOptions.find((p) => p.value === planType)?.label ?? planType} · ${selectedDay.label} ${
    coordinateByChat ? '· coordinan por chat' : selectedTime.label.toLowerCase()
  } · ${zone}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    const scheduledAt = coordinateByChat
      ? undefined
      : new Date(defaultDateTimeLocal(selectedDay.daysAhead, selectedTime.hour!)).toISOString();
    // Red de seguridad (los chips ya bloquean lo pasado, pero el tiempo corre
    // con el modal abierto): nunca mandar una cita en el pasado al server.
    if (scheduledAt && new Date(scheduledAt).getTime() < Date.now() + 15 * 60 * 1000) {
      toast.error('Ese horario ya pasó', { description: 'Elegí otro día u horario, o coordiná por chat.' });
      return;
    }
    proposeDate.mutate(
      {
        scheduledAt,
        zone,
        planType,
        note: note || undefined,
      },
      {
        onSuccess: () => {
          sounds.playCoins();
          toast.success(`Invitación enviada a ${partnerName}`);
          onClose();
        },
        onError: (err: any) => toast.error(err?.message ?? 'No se pudo enviar la invitación'),
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[420px] p-0 gap-0 rounded-[var(--radius-lg)] overflow-hidden max-h-[90dvh] flex flex-col">
        <DialogHeader className="hairline-b px-6 pt-6 pb-4 pr-14 space-y-1.5 text-left">
          <span className="t-overline text-[#ec4d86] dark:text-[#ffa3c4]">Propuesta de encuentro</span>
          <h3 className="t-display text-[24px] italic text-ink">Invitar a {partnerName}</h3>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-6 overflow-y-auto">
          {/* Día */}
          <div className="flex flex-col gap-2.5">
            <Label className="text-[13px] font-bold text-ink">Día</Label>
            <div className="flex gap-2 flex-wrap">
              {dayOptions.map((d) => (
                <Chip key={d.key} active={dayKey === d.key} onClick={() => handleDaySelect(d.key)}>
                  {d.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Horario (incluye "Coordinar por chat" como cuarta opción) */}
          <div className="flex flex-col gap-2.5">
            <Label className="text-[13px] font-bold text-ink">Horario</Label>
            <div className="flex gap-2 flex-wrap">
              {TIME_OPTIONS.map((t) => (
                <Chip
                  key={t.key}
                  active={timeKey === t.key}
                  disabled={isPastTime(t.hour, selectedDay.daysAhead)}
                  onClick={() => { sounds.playClick(); setTimeKey(t.key); }}
                >
                  {t.label}
                </Chip>
              ))}
            </div>
            {coordinateByChat && (
              <p
                className="surface-inset t-caption text-ink-muted px-3.5 py-2.5 leading-relaxed"
              >
                No fijás un horario: le mandás la propuesta con el lugar y plan, y se ponen de acuerdo con la hora charlando en el chat.
              </p>
            )}
          </div>

          {/* Zona / lugar */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="propose-zone" className="text-[13px] font-bold text-ink">
                Lugar / Dirección
              </Label>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setShowTemplates((prev) => !prev);
                }}
                className="text-link text-[12.5px] min-h-[32px] inline-flex items-center"
              >
                {showTemplates ? 'Ocultar plantillas' : 'Usar una plantilla rápida'}
              </button>
            </div>
            <Input
              id="propose-zone"
              type="text"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              required
              minLength={2}
              maxLength={80}
            />

            {showTemplates && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {quickVenues.map((qv, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setZone(qv.zone);
                      setPlanType(qv.planType);
                      setDayKey(qv.dayKey);
                      setTimeKey(qv.timeKey);
                    }}
                    className={`surface-inset min-h-[52px] px-3 py-2.5 text-left transition-all cursor-pointer active:scale-[0.98] ${
                      zone === qv.zone ? '!border-[#ec4d86]' : ''
                    }`}
                  >
                    <span className="text-[13px] font-bold block truncate text-ink">
                      {planOptions.find((p) => p.value === qv.planType)?.label ?? qv.planType}
                    </span>
                    <span className="t-caption truncate block text-ink-muted mt-0.5">
                      {qv.zone}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tipo de plan */}
          <div className="flex flex-col gap-2.5">
            <Label className="text-[13px] font-bold text-ink">Tipo de plan</Label>
            <div className="flex gap-2 flex-wrap">
              {planOptions.map((p) => (
                <Chip key={p.value} active={planType === p.value} onClick={() => { sounds.playClick(); setPlanType(p.value); }}>
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="propose-note" className="mb-2 block text-[13px] font-bold text-ink">
              Nota o Detalle Especial (Opcional)
            </Label>
            <Input
              id="propose-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Ej: Un café de especialidad y caminata..."
            />
          </div>

          <div className="pt-1 flex flex-col gap-3">
            <p className="surface-inset text-center t-body-sm text-ink-muted px-4 py-3">
              {summary}
            </p>
            <Button
              type="submit"
              disabled={proposeDate.isPending}
              className="w-full h-13 text-[15.5px] font-bold shadow-[var(--shadow-coral)]"
              style={{ background: 'var(--coral-500)', color: 'var(--ink-on-coral)', backgroundImage: 'none' }}
            >
              {proposeDate.isPending ? 'Enviando…' : 'Enviar propuesta'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// --- STAMP KEEPSAKE MODAL ---
interface StampModalProps {
  stamp: Stamp | null;
  onClose: () => void;
}

export const StampModal: React.FC<StampModalProps> = ({ stamp, onClose }) => {
  const { isLight } = useTheme();

  return (
    <Dialog open={Boolean(stamp)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[380px] p-6 pt-8 gap-0 flex flex-col items-center text-center">
        {stamp && (
          <>
            <div
              className={`w-[104px] h-[104px] rounded-full border-[3px] border-[#ec4d86] text-[#ec4d86] flex items-center justify-center stamp-ink mb-5 relative ${
                isLight ? 'bg-white' : 'bg-[#0a1120]'
              }`}
              style={{ boxShadow: '0 16px 32px -16px rgba(255,107,158,0.45)' }}
            >
              <div className="absolute inset-2 border border-dashed border-[#ec4d86]/50 rounded-full" />
              <span className="material-symbols-outlined text-[44px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {stamp.iconName}
              </span>
            </div>

            <span className="t-overline mb-2 text-[#ec4d86] dark:text-[#ffa3c4]">
              {stamp.unlocked ? 'Sello oficial de conexión' : 'Sello por desbloquear'}
            </span>
            <h3 className="t-title text-ink mb-1.5">{stamp.title}</h3>
            <span className="t-body-sm text-ink-muted mb-5">
              {stamp.unlockedAt ? `Fecha: ${new Date(stamp.unlockedAt).toLocaleDateString('es-AR')}` : stamp.description}
            </span>

            <div className="surface-inset p-4 w-full text-left flex flex-col gap-3 mb-5">
              {stamp.location && (
                <div>
                  <span className="t-overline text-[10px] block mb-1 text-ink-faint">
                    LUGAR
                  </span>
                  <p className="t-body-sm font-semibold text-ink">{stamp.location}</p>
                </div>
              )}

              {stamp.partnerName && (
                <div>
                  <span className="t-overline text-[10px] block mb-1 text-ink-faint">
                    ENCUENTRO CON
                  </span>
                  <p className="t-body-sm font-semibold text-ink">{stamp.partnerName}</p>
                </div>
              )}

              {stamp.notes && (
                <div>
                  <span className="t-overline text-[10px] block mb-1 text-ink-faint">
                    MEMORIA / DETALLES
                  </span>
                  <p className="t-body-sm italic text-ink-muted" style={{ fontFamily: 'var(--font-display)' }}>"{stamp.notes}"</p>
                </div>
              )}
            </div>

            <Button
              variant="secondary"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="w-full h-12"
            >
              Cerrar recuerdo
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// --- COIN RECHARGE CONFIRMATION MODAL ---
interface RechargeModalProps {
  pack: { pts: number; price: string; name: string } | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const RechargeModal: React.FC<RechargeModalProps> = ({ pack, onClose, onConfirm }) => {
  return (
    <Dialog open={Boolean(pack)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[380px] p-6 pt-8 gap-0 flex flex-col items-center text-center">
        {pack && (
          <>
            <div className="icon-tile w-16 h-16 rounded-full mb-4">
              <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                monetization_on
              </span>
            </div>

            <span className="t-overline mb-2 text-[#ec4d86] dark:text-[#ffa3c4]">Bóveda personal</span>
            <h3 className="t-title text-ink mb-1.5">{pack.name}</h3>
            <p className="t-body-sm text-ink-muted mb-5">
              Recibirás <strong className="text-[#ec4d86] dark:text-[#ffa3c4]">+{pack.pts} PTS</strong> en tu saldo de Findy para regalos y beneficios de conexión.
            </p>

            <div className="surface-inset p-4 w-full flex justify-between items-center mb-6">
              <span className="t-overline text-[10px] text-ink-muted">Importe total</span>
              <span className="t-title text-ink tabular-nums">{pack.price} USD</span>
            </div>

            <div className="flex gap-2.5 w-full">
              <Button
                variant="tertiary"
                onClick={() => {
                  sounds.playClick();
                  onClose();
                }}
                className="flex-1 h-12"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="flex-1 h-12"
              >
                Confirmar pago
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// --- MENU DRAWER ---
interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: any) => void;
  onSignOut: () => void;
  user: MeProfile;
  /** Contadores opcionales para mostrar un badge junto al link (ej: citas pendientes) —
   * relevante porque Citas y Matches viven en el menú (no en la bottom nav) y
   * perdieron el badge que tenían ahí. */
  badges?: Partial<Record<string, number>>;
}

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSignOut,
  user,
  badges,
}) => {
  const { isLight, toggleTheme } = useTheme();

  const mainLinks = [
    { label: 'Descubrir', tab: 'descubrir', icon: 'explore' },
    { label: 'Matches', tab: 'matches', icon: 'favorite' },
    { label: 'Mensajes', tab: 'mensajes', icon: 'chat_bubble' },
    { label: 'Tienda', tab: 'tienda', icon: 'local_mall' },
    { label: 'Citas', tab: 'citas', icon: 'event_available' },
    { label: 'Perfil', tab: 'perfil', icon: 'badge' },
    { label: 'Ajustes', tab: 'ajustes', icon: 'settings' },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="left"
        className="px-4 pb-4 flex flex-col justify-between overflow-y-auto no-scrollbar"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        <div className="flex flex-col gap-4">
          {/* Header: wordmark alineado con el botón de cerrar (40px) del Sheet. */}
          <div className="h-10 -mt-1 flex items-center pl-2 pr-10">
            <h2 className="font-wordmark text-[20px] font-bold text-[#ec4d86] tracking-[0.02em] leading-none">FINDY</h2>
          </div>

          {/* User mini badge — botón real (era un div con onClick: invisible
              para teclado y lector de pantalla). Misma visual. */}
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onNavigate('perfil');
              onClose();
            }}
            aria-label={`Ir a mi perfil, ${user.displayName}`}
            className="surface-card w-full p-3 flex items-center gap-3 cursor-pointer transition-transform active:scale-[0.99] text-left"
          >
            <ProfilePhoto
              url={user.photos[0]?.url}
              name={user.displayName}
              className="w-12 h-12 rounded-full shrink-0"
            />
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <span className="t-heading text-ink block truncate">{user.displayName}</span>
              <span
                className="inline-flex items-center gap-1 self-start px-2 py-[3px] rounded-[var(--radius-pill)] text-[10.5px] font-extrabold tracking-[0.04em] uppercase leading-none"
                style={{ background: isLight ? 'var(--coral-100)' : 'rgba(255,107,158,0.16)', color: isLight ? 'var(--coral-700)' : 'var(--coral-300)' }}
              >
                {user.membership.tierLabel}
              </span>
            </div>
            <span className="material-symbols-outlined text-[22px] text-ink-faint" aria-hidden="true">
              chevron_right
            </span>
          </button>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-0.5 pt-1" aria-label="Secciones de Findy">
            {mainLinks.map((link) => (
              <button
                key={link.tab}
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onNavigate(link.tab);
                  onClose();
                }}
                className="nav-row group"
              >
                <span className="material-symbols-outlined text-[23px] text-[#ec4d86] group-hover:scale-105 transition-transform leading-none">
                  {link.icon}
                </span>
                <span className="text-[15px] font-semibold flex-1 tracking-[-0.005em]">{link.label}</span>
                {Boolean(badges?.[link.tab]) ? (
                  <span className="count-badge">{badges![link.tab]}</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px] text-ink-faint opacity-60" aria-hidden="true">
                    chevron_right
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="hairline-t pt-3 mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              toggleTheme();
            }}
            className="nav-row"
          >
            <span className="material-symbols-outlined text-[23px] text-[#ec4d86] leading-none">{isLight ? 'dark_mode' : 'light_mode'}</span>
            <span className="text-[15px] font-semibold flex-1 tracking-[-0.005em]">{isLight ? 'Modo oscuro' : 'Modo claro'}</span>
            {/* Mini switch decorativo: estado visible sin texto extra. */}
            <span
              aria-hidden="true"
              className="relative w-9 h-5 rounded-full transition-colors"
              style={{ background: isLight ? 'rgba(22,34,59,0.15)' : 'var(--coral-500)' }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-[0_1px_2px_rgba(10,17,32,0.3)] transition-transform"
                style={{ left: 2, transform: isLight ? 'translateX(0)' : 'translateX(16px)' }}
              />
            </span>
          </button>

          <Button
            variant="secondary"
            onClick={() => {
              sounds.playClick();
              onSignOut();
              onClose();
            }}
            className="w-full h-12 text-[14px] text-[#ec4d86] dark:text-[#ffa3c4]"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>Cerrar sesión</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
