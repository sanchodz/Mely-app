import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const labelVariants = cva(
  // Etiquetas de campo en caja normal y 13px (antes 10px en versalitas: se leían
  // apretadas sobre inputs de 16px). Las pantallas que querían caja normal ya lo
  // forzaban con `normal-case tracking-normal`; esos overrides siguen siendo inocuos.
  'font-label-caps text-[13px] font-semibold leading-none tracking-[0.01em] peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[#3e4759] dark:text-[#a9b2c9]'
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
