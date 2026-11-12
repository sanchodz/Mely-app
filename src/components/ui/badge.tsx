import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] text-[11.5px] font-bold leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 select-none',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-rose-600 text-white shadow hover:bg-rose-700 dark:bg-rose-600 dark:text-white',
        secondary:
          'border-transparent bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
        destructive:
          'border-transparent bg-red-500 text-white shadow hover:bg-red-600 dark:bg-red-900 dark:text-red-100',
        outline:
          'text-foreground border-rose-200 dark:border-rose-900/50 text-slate-800 dark:text-rose-200',
        verified:
          'border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30',
        keepsake:
          'border-rose-300/80 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 font-label-caps uppercase tracking-wider',
        gold:
          'border-amber-400/40 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/40 font-label-caps uppercase tracking-wider',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
