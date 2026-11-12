import React from 'react';
import { DateMeet, Match, PlanType } from '../types';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { useAllDateProposals } from '../hooks/useDates';
import { EmptyState } from './StateViews';
import { ProfilePhoto } from './ProfilePhoto';
import { Button } from './ui/button';

const PLAN_LABELS: Record<PlanType, string> = {
  COFFEE: 'Café',
  FOOD: 'Comida',
  BAR: 'Tragos',
  CINEMA: 'Cine',
  ACTIVITY: 'Actividad',
  CHILL: 'Plan tranqui',
  OTHER: 'Plan',
};

const STATUS_LABEL: Record<DateMeet['status'], string> = {
  AGREED: 'Confirmada',
  CHECKED_IN: 'Check-in listo',
  VERIFIED: 'Verificada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No se presentó',
};

function formatDateTime(iso: string | null) {
  if (!iso) return 'A coordinar por chat';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Fecha a confirmar';
  const formatted = date.toLocaleString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  // toLocaleString devuelve todo en minúsculas en es-AR — capitalize por CSS
  // pondría mayúscula en cada palabra ("Lunes, 5 De Ago"), no solo la primera.
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

interface DatesViewProps {
  matches: Match[];
  onOpenChat: (connectionId: string) => void;
  onOpenDateQR: (connectionId: string, partnerName: string, partnerAvatar: string) => void;
  onExploreMatches?: () => void;
}

export const DatesView: React.FC<DatesViewProps> = ({ matches, onOpenChat, onOpenDateQR, onExploreMatches }) => {
  const { isLight } = useTheme();
  const { items, isLoading } = useAllDateProposals(matches);

  // Un solo lenguaje de superficies (igual que Perfil/Tienda): tarjeta + bloque hundido.
  const card = isLight ? 'bg-white border-[var(--color-line)]' : 'bg-[var(--midnight-900)] border-[var(--hairline-strong)]';
  const sunken = isLight ? 'bg-[var(--color-canvas)] border-[var(--color-line)]' : 'bg-[var(--midnight-950)] border-[var(--hairline)]';
  const divider = isLight ? 'border-[var(--color-line)]' : 'border-[var(--hairline)]';
  const strong = isLight ? 'text-[var(--text-on-light)]' : 'text-[var(--text-primary)]';
  const muted = isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]';
  const faint = isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-tertiary)]';
  const coralTile = isLight ? 'bg-[var(--coral-100)] text-[var(--coral-700)]' : 'bg-[var(--coral-500)]/15 text-[var(--coral-300)]';
  // El "agujero" del ticket se recorta con el color del fondo de página.
  const notch = isLight ? 'bg-[var(--color-canvas)] border-[var(--color-line)]' : 'bg-[#0A1120] border-[var(--hairline-strong)]';

  return (
    <div className="flex flex-col gap-6 pb-12 animate-fadeIn">
      {/* Header Info */}
      <div className="flex items-end justify-between gap-4 px-0.5">
        <div className="min-w-0">
          <p className="section-kicker">Tu agenda</p>
          <h2 className={`mt-1.5 text-[28px] italic font-semibold leading-none ${strong}`} style={{ fontFamily: 'var(--font-display)' }}>
            Itinerario de citas
          </h2>
          <p className={`text-[13.5px] mt-2 leading-snug ${muted}`}>Tus encuentros acordados y listos para verificar en persona.</p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 h-8 pl-2 pr-3 rounded-full text-[12.5px] font-bold tabular-nums ${coralTile}`}>
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">confirmation_number</span>
          {items.length} {items.length === 1 ? 'cita' : 'citas'}
        </span>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-4" aria-label="Cargando itinerario">
          {[0, 1].map((i) => (
            <div key={i} className={`border rounded-[var(--radius-lg)] overflow-hidden shadow-elevation-sm ${card}`}>
              <div className={`p-4 flex items-center gap-3.5 border-b border-dashed ${divider}`}>
                <div className="w-12 h-12 rounded-full bg-black/10 dark:bg-white/10 animate-pulse shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="h-2.5 w-24 rounded-full bg-black/10 dark:bg-white/10 animate-pulse" />
                  <div className="h-4 w-32 rounded-full bg-black/10 dark:bg-white/10 animate-pulse" />
                </div>
              </div>
              <div className="p-4 flex flex-col gap-2.5">
                <div className="h-14 rounded-[var(--radius-md)] bg-black/5 dark:bg-white/5 animate-pulse" />
                <div className="h-14 rounded-[var(--radius-md)] bg-black/5 dark:bg-white/5 animate-pulse" />
                <div className="h-11 mt-1 rounded-full bg-black/5 dark:bg-white/5 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <EmptyState
          icon="confirmation_number"
          title="Tu primera cita te está esperando"
          body="Todavía no tenés citas acordadas. Cada match puede convertirse en un plan con lugar verificado y sello de recuerdo."
          actions={
            onExploreMatches
              ? [{ label: 'Ver mis matches', onClick: onExploreMatches, icon: 'local_cafe' }]
              : []
          }
        />
      )}

      {/* List of Date Ticket Stubs */}
      <div className="flex flex-col gap-4">
        {items.map(({ match, dateMeet }: { match: Match; dateMeet: DateMeet }) => {
          const isVerified = dateMeet.status === 'VERIFIED';
          const isAgreed = dateMeet.status === 'AGREED' || dateMeet.status === 'CHECKED_IN';
          const statusClass = isVerified
            ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300'
            : isAgreed
              ? coralTile
              : isLight
                ? 'bg-[var(--color-line)] text-[var(--text-on-light-muted)]'
                : 'bg-white/8 text-[var(--text-secondary)]';

          return (
            <article
              key={dateMeet.id}
              aria-label={`Cita con ${match.other.displayName}`}
              className={`border rounded-[var(--radius-lg)] overflow-hidden relative shadow-elevation-md ${card}`}
            >
              {/* Muescas laterales del ticket, a la altura de la línea perforada. */}
              <div aria-hidden="true" className={`absolute left-0 top-[92px] -translate-y-1/2 -ml-[1px] w-4 h-8 rounded-r-full border-r border-t border-b ${notch}`} />
              <div aria-hidden="true" className={`absolute right-0 top-[92px] -translate-y-1/2 -mr-[1px] w-4 h-8 rounded-l-full border-l border-t border-b ${notch}`} />

              {/* Ticket Top Banner */}
              <div className={`h-[92px] px-5 flex items-center gap-3.5 border-b border-dashed ${divider}`}>
                <div className="w-12 h-12 rounded-full p-[2px] shrink-0" style={{ background: 'linear-gradient(135deg, var(--coral-600), var(--coral-300))' }}>
                  <div className="w-full h-full rounded-full overflow-hidden">
                    <ProfilePhoto url={match.other.photos[0]?.url} name={match.other.displayName} className="w-full h-full" fallbackClassName="text-[14px]" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block truncate text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--coral-600)] dark:text-[var(--coral-300)]">Cita con {match.other.displayName}</span>
                  <h3 className={`text-[22px] italic font-semibold leading-tight mt-1 truncate ${strong}`} style={{ fontFamily: 'var(--font-display)' }}>
                    {PLAN_LABELS[dateMeet.planType]}
                  </h3>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[10.5px] font-bold uppercase tracking-[0.06em] ${statusClass}`}>
                  {STATUS_LABEL[dateMeet.status]}
                </span>
              </div>

              {/* Ticket Content */}
              <div className="p-4 sm:p-5 flex flex-col gap-4">
                <dl className={`rounded-[var(--radius-md)] border divide-y ${sunken} ${isLight ? 'divide-[var(--color-line)]' : 'divide-[var(--hairline)]'}`}>
                  <div className="flex items-center gap-3.5 px-4 min-h-14">
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${coralTile}`}>
                      <span className="material-symbols-outlined text-[19px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">location_on</span>
                    </span>
                    <div className="min-w-0 py-2">
                      <dt className={`text-[11px] font-bold uppercase tracking-[0.12em] ${faint}`}>Lugar</dt>
                      <dd className={`text-[15px] font-semibold leading-snug mt-0.5 truncate ${strong}`}>{dateMeet.zone}</dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-3.5 px-4 min-h-14">
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${coralTile}`}>
                      <span className="material-symbols-outlined text-[19px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">schedule</span>
                    </span>
                    <div className="min-w-0 py-2">
                      <dt className={`text-[11px] font-bold uppercase tracking-[0.12em] ${faint}`}>Horario</dt>
                      <dd className={`text-[15px] font-semibold leading-snug mt-0.5 ${strong}`}>{formatDateTime(dateMeet.scheduledAt)}</dd>
                    </div>
                  </div>
                </dl>

                <div className={`grid gap-2.5 ${isVerified ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      sounds.playClick();
                      onOpenChat(match.id);
                    }}
                    className="h-12 gap-1.5 rounded-full text-[15px]"
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chat</span>
                    <span>Chat</span>
                  </Button>

                  {!isVerified && (
                    <Button
                      variant="primary"
                      onClick={() => {
                        sounds.playClick();
                        onOpenDateQR(match.id, match.other.displayName, match.other.photos[0]?.url ?? '');
                      }}
                      className="h-12 gap-1.5 rounded-full text-[15px]"
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">qr_code_2</span>
                      <span>Pase QR</span>
                    </Button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
