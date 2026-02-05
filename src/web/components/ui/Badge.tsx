import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'capturing' | 'processing' | 'complete' | 'failed';
}

export function Badge({ className, variant = 'complete', children, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider transition-colors',
        {
          'border-blue-500/30 bg-blue-500/10 text-blue-400': variant === 'capturing',
          'border-amber-500/30 bg-amber-500/10 text-amber-400': variant === 'processing',
          'border-emerald-500/30 bg-emerald-500/10 text-emerald-400': variant === 'complete',
          'border-red-500/30 bg-red-500/10 text-red-400': variant === 'failed',
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}