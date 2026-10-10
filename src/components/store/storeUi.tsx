import React from 'react';
import { cn } from '../../lib/utils';

/*
 * Clases compartidas de la Tienda. Todo sale de los tokens de index.css
 * (--midnight-*, --coral-*, --text-*, escala amber = dorado), así la tienda
 * usa exactamente la paleta FINDY sin hex sueltos. `dark:` responde a la
 * clase .dark que alterna ThemeContext.
 */
export const tone = {
  surface: 'bg-white border-[var(--coral-100)] dark:bg-[var(--midnight-900)] dark:border-[var(--hairline-strong)]',
  sunken: 'bg-[var(--color-canvas)] dark:bg-[var(--midnight-950)]',
  strong: 'text-[var(--text-on-light)] dark:text-[var(--text-primary)]',
  muted: 'text-[var(--text-on-light-muted)] dark:text-[var(--text-secondary)]',
  accent: 'text-[var(--coral-600)] dark:text-[var(--coral-300)]',
  gold: 'text-amber-600 dark:text-amber-300',
  divider: 'border-[var(--coral-100)] dark:border-[var(--hairline)]',
} as const;

export const accentText = (accent: 'coral' | 'gold') => (accent === 'gold' ? tone.gold : tone.accent);

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
  <div className="flex items-end justify-between gap-3 px-1">
    <div className="min-w-0">
      {kicker && <span className="section-kicker block mb-1.5">{kicker}</span>}
      <h3 className={cn('text-[19px] italic font-semibold leading-tight', tone.strong)} style={{ fontFamily: 'var(--font-display)' }}>
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
