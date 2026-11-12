import React from 'react';
import { cn } from '../../lib/utils';

/*
 * Clases compartidas de la Tienda. Todo sale de los tokens de index.css
 * (--midnight-*, --coral-*, --text-*, escala amber = dorado), así la tienda
 * usa exactamente la paleta FINDY sin hex sueltos. `dark:` responde a la
 * clase .dark que alterna ThemeContext.
 */
export const tone = {
  surface: 'bg-white border-[var(--color-line)] dark:bg-[var(--midnight-900)] dark:border-[var(--hairline-strong)]',
  sunken: 'bg-[var(--color-canvas)] dark:bg-[var(--midnight-950)]',
  strong: 'text-[var(--text-on-light)] dark:text-[var(--text-primary)]',
  muted: 'text-[var(--text-on-light-muted)] dark:text-[var(--text-secondary)]',
  faint: 'text-[var(--text-on-light-muted)]/80 dark:text-[var(--text-tertiary)]',
  accent: 'text-[var(--coral-600)] dark:text-[var(--coral-300)]',
  gold: 'text-amber-600 dark:text-amber-300',
  divider: 'border-[var(--color-line)] dark:border-[var(--hairline)]',
  /** Tarjeta estándar de la tienda: radio grande, borde hairline, sombra suave. */
  card: 'rounded-[var(--radius-lg)] border shadow-elevation-sm bg-white border-[var(--color-line)] dark:bg-[var(--midnight-900)] dark:border-[var(--hairline-strong)]',
  /** Etiqueta chica en mayúsculas para subtítulos dentro de tarjetas. */
  label: 'text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-on-light-muted)] dark:text-[var(--text-tertiary)]',
} as const;


export const accentTile = (accent: 'coral' | 'gold') =>
  accent === 'gold'
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300'
    : 'bg-[var(--coral-100)] text-[var(--coral-700)] dark:bg-[var(--coral-500)]/15 dark:text-[var(--coral-300)]';

export const Icon: React.FC<{ name: string; className?: string; filled?: boolean }> = ({ name, className, filled }) => (
  <span
    aria-hidden="true"
    className={cn('material-symbols-outlined leading-none', className)}
    style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
  >
    {name}
  </span>
);

/** Título editorial de sección — Fraunces itálica, como el resto de la app. */
export const SectionTitle: React.FC<{ title: string; kicker?: string; aside?: React.ReactNode }> = ({ title, kicker, aside }) => (
  <div className="flex items-end justify-between gap-3 px-0.5">
    <div className="min-w-0">
      {kicker && <span className="section-kicker block mb-1.5">{kicker}</span>}
      <h3 className={cn('text-[21px] italic font-semibold leading-tight', tone.strong)} style={{ fontFamily: 'var(--font-display)' }}>
        {title}
      </h3>
    </div>
    {aside}
  </div>
);

/** Monto en coins con el ícono de moneda — un solo formato en toda la tienda. */
export const Coins: React.FC<{ amount: number; className?: string; iconClassName?: string }> = ({ amount, className, iconClassName }) => (
  <span className={cn('inline-flex items-center gap-1 tabular-nums', className)}>
    <Icon name="monetization_on" filled className={cn('text-[1.05em] text-[var(--coral-600)] dark:text-[var(--coral-300)]', iconClassName)} />
    {amount.toLocaleString('es-AR')}
  </span>
);

/** Indicador de carga en línea (botones, filas). Respeta reduced-motion vía motion-safe. */
export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <Icon name="progress_activity" className={cn('motion-safe:animate-spin', className)} />
);

/** Pastilla de estado — verde = ya es tuyo / te alcanza; dorado = valor; neutra = dato. */
export const Pill: React.FC<{ tone: 'ok' | 'gold' | 'neutral'; icon?: string; children: React.ReactNode; className?: string }> = ({
  tone: pillTone,
  icon,
  children,
  className,
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 h-7 text-[12px] font-bold leading-none whitespace-nowrap',
      pillTone === 'ok' && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
      pillTone === 'gold' && 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
      pillTone === 'neutral' && 'bg-[var(--color-canvas)] text-[var(--text-on-light-muted)] dark:bg-[var(--midnight-800)] dark:text-[var(--text-secondary)]',
      className,
    )}
  >
    {icon && <Icon name={icon} className="text-[14px]" />}
    {children}
  </span>
);

/** Estado vacío chico para pestañas sin datos: mismo idioma que StateViews, en versión densa. */
export const EmptyNote: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
  <div className={cn('rounded-[var(--radius-lg)] border border-dashed px-6 py-10 flex flex-col items-center gap-3 text-center', tone.divider, tone.sunken)}>
    <span className={cn('w-12 h-12 rounded-full flex items-center justify-center', accentTile('coral'))}>
      <Icon name={icon} className="text-[24px]" />
    </span>
    <p className={cn('text-[14px] leading-snug max-w-[26ch]', tone.muted)}>{children}</p>
  </div>
);
