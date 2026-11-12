import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/* Gramática FINDY — misma intención, mismo lenguaje.
 * primary: mueve la historia hacia adelante (gradiente coral = acción FINDY).
 * secondary: alternativa válida con borde (misma presencia, menos empuje).
 * tertiary: contextual/discreta (icono, menú, cancelar).
 * destructive: reportar, bloquear, eliminar.
 * special: identidad propia de FINDY (pasaporte/sello, ticket dashed).
 * link: texto accionable.
 * El radio lo pone el tamaño/contexto (hero = pill vía className); el color
 * lo pone la intención. Deuda honesta: texto blanco sobre coral no llega a
 * 4.5:1 — candidato futuro `ink-on-coral` cuando se revise la marca. */
// Radio unificado: píldora en todos los tamaños (igual que chips, nav pill y
// CTAs hero) — antes convivían rounded-xl / 2xl / full según el tamaño.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-bold tracking-[-0.005em] transition-all focus-glow disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white shadow-[var(--shadow-coral)] hover:brightness-[1.05] active:brightness-95',
        secondary:
          'border border-black/10 bg-white text-[#16223b] hover:bg-[#fcf9f2] hover:border-black/15 dark:border-white/12 dark:bg-[#131f36] dark:text-[#f5f1e8] dark:hover:bg-[#17233d] dark:hover:border-white/20',
        tertiary:
          'text-[#16223b] hover:bg-black/5 dark:text-[#f5f1e8] dark:hover:bg-white/8',
        destructive:
          'bg-red-500 text-white shadow-elevation-sm hover:bg-red-600 dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-800',
        special:
          'border-2 border-dashed border-rose-400 bg-rose-50/50 text-rose-700 hover:bg-rose-100/80 dark:border-rose-500/40 dark:bg-rose-950/20 dark:text-rose-300 font-label-caps tracking-widest uppercase',
        link: 'text-rose-600 underline-offset-4 hover:underline dark:text-rose-400',
      },
      size: {
        default: 'h-11 px-5 text-[14px]',
        sm: 'h-9 px-4 text-[13px]',
        lg: 'h-13 px-7 text-[15.5px]',
        icon: 'h-11 w-11',
        'icon-sm': 'h-9 w-9 text-xs',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
