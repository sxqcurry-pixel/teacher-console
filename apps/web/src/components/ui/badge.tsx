import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default: 'bg-primary/15 text-primary border-primary/25',
        secondary: 'bg-secondary text-secondary-foreground border-input',
        destructive: 'bg-destructive/15 text-destructive border-destructive/30',
        success: 'bg-success/15 text-success border-success/30',
        warning: 'bg-warning/15 text-warning border-warning/30',
        gold: 'bg-[hsl(45_93%_55%_/_0.18)] text-[hsl(45_93%_70%)] border-[hsl(45_93%_55%_/_0.35)]',
        outline: 'text-foreground border-input',
        ghost: 'text-muted-foreground border-transparent bg-transparent px-1.5',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
