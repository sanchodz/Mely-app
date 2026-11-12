import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-12 w-full rounded-[var(--radius-md)] border border-black/10 bg-white px-4 py-2 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.03)] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#8a93a8] focus-glow focus-visible:border-[#ec4d86] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/12 dark:bg-white/[0.05] dark:text-[#f5f1e8] dark:placeholder:text-[#6e7891] dark:shadow-none transition-all font-body-sm text-[#16223b]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
