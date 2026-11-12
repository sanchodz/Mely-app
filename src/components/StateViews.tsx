import React from 'react';
import { motion } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { sounds } from '../utils/audio';
import { Button } from './ui/button';

// Lenguaje único de estados Findy: círculo dashed + icono + título + explicación
// + acción. Antes cada vista lo copiaba a mano con pequeñas diferencias (tamaño
// del círculo, copy, padding); ahora es un solo componente con el mismo idioma
// visual en Descubrir, Likes, Matches, Citas, Mensajes y errores.

export interface StateAction {
  label: string;
  onClick: () => void;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'link';
}

interface StateBaseProps {
  icon: string;
  title: string;
  body?: string;
  actions?: StateAction[];
  /** Versión densa para intercalar dentro de listas o paneles chicos. */
  compact?: boolean;
  /** Acento ámbar para estados "límite alcanzado", coral para el resto. */
  accent?: 'coral' | 'amber';
}

const StateShell: React.FC<StateBaseProps & { label: string }> = ({
  icon,
  title,
  body,
  actions = [],
  compact = false,
  accent = 'coral',
  label,
}) => {
  const { isLight } = useTheme();
  const amber = accent === 'amber';
  // Círculo: anillo dashed fino sobre un disco tintado (antes el dashed grueso
  // competía con el icono). El tinte sigue el acento.
  const tint = amber
    ? isLight
      ? 'rgba(200,154,62,0.12)'
      : 'rgba(217,180,92,0.14)'
    : isLight
      ? 'rgba(255,107,158,0.12)'
      : 'rgba(255,107,158,0.14)';
  const ring = amber ? 'rgba(200,154,62,0.45)' : 'rgba(255,107,158,0.5)';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      aria-label={label}
      className={`flex flex-col items-center text-center ${compact ? 'py-8 px-4 gap-2' : 'py-14 px-6 gap-3'}`}
    >
      <div
        className={`relative rounded-full flex items-center justify-center ${compact ? 'w-16 h-16 mb-0.5' : 'w-[88px] h-[88px] mb-1'} ${
          amber ? 'text-amber-500' : 'text-[#ec4d86]'
        }`}
        style={{ background: tint }}
      >
        <span className="absolute inset-0 rounded-full border-[1.5px] border-dashed" style={{ borderColor: ring }} aria-hidden="true" />
        <span className={`material-symbols-outlined ${compact ? 'text-[28px]' : 'text-[38px]'}`} aria-hidden="true">
          {icon}
        </span>
      </div>
      <h3 className={`${compact ? 'text-[16px]' : 'text-[19px]'} font-extrabold tracking-[-0.015em] leading-tight text-ink`}>
        {title}
      </h3>
      {body && (
        <p className={`leading-relaxed text-ink-muted ${compact ? 'text-[13px] max-w-[260px]' : 'text-[14px] max-w-[290px]'}`}>
          {body}
        </p>
      )}
      {actions.length > 0 && (
        <div className={`flex items-center justify-center gap-2.5 flex-wrap ${compact ? 'mt-2' : 'mt-3'}`}>
          {actions.map((a) =>
            a.variant === 'link' ? (
              <button
                key={a.label}
                type="button"
                onClick={() => {
                  sounds.playClick();
                  a.onClick();
                }}
                className="text-link text-[13px] min-h-[40px] px-2 inline-flex items-center underline underline-offset-4"
              >
                {a.label}
              </button>
            ) : (
              <Button
                key={a.label}
                variant={a.variant === 'secondary' ? 'secondary' : 'primary'}
                size={compact ? 'sm' : 'default'}
                onClick={() => {
                  sounds.playClick();
                  a.onClick();
                }}
                className="gap-1.5 px-5"
              >
                {a.icon && <span className="material-symbols-outlined text-[17px]">{a.icon}</span>}
                {a.label}
              </Button>
            ),
          )}
        </div>
      )}
    </motion.div>
  );
};

/** Estado vacío diseñado: responde qué pasó y qué se puede hacer ahora. */
export const EmptyState: React.FC<StateBaseProps> = (props) => <StateShell {...props} label={props.title} />;

interface ErrorStateProps extends Omit<StateBaseProps, 'icon' | 'accent'> {
  icon?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onBack?: () => void;
  backLabel?: string;
}

/** Error controlado: mensaje entendible + acciones (reintentar / volver). */
export const ErrorState: React.FC<ErrorStateProps> = ({
  icon = 'signal_wifi_off',
  title,
  body,
  actions = [],
  onRetry,
  retryLabel = 'Reintentar',
  onBack,
  backLabel = 'Volver',
  compact = false,
}) => {
  const merged: StateAction[] = [
    ...(onRetry ? [{ label: retryLabel, onClick: onRetry, icon: 'refresh', variant: 'primary' as const }] : []),
    ...(onBack ? [{ label: backLabel, onClick: onBack, variant: 'secondary' as const }] : []),
    ...actions,
  ];
  return <StateShell icon={icon} title={title} body={body} actions={merged} compact={compact} accent="coral" label={title} />;
};
