import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[96px] w-full rounded-[var(--radius-md)] border border-black/10 bg-white px-4 py-3 text-sm placeholder:text-[#8a93a8] focus-glow focus-visible:border-[#ec4d86] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/12 dark:bg-white/[0.05] dark:text-[#f5f1e8] dark:placeholder:text-[#6e7891] transition-all font-body-sm text-[#16223b] leading-relaxed',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
