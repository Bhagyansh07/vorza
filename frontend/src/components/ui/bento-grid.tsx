import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

/**
 * Bento grid family, upgraded with luxury glassmorphic surfaces,
 * soft ambient depth, and reactive hover lighting.
 */
export function BentoGrid({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn('grid w-full auto-rows-[14rem] grid-cols-3 gap-4', className)}
      {...props}
    />
  );
}

interface BentoCardProps extends ComponentPropsWithoutRef<'div'> {
  title: string;
  description: string;
  icon?: ReactNode;
  /** Large display value rendered above the title, e.g. a NumberTicker. */
  stat?: ReactNode;
  /** Optional trailing action, rendered as a Link with an arrow. */
  to?: string;
  actionLabel?: string;
  /** Anything painted behind the foreground content. */
  background?: ReactNode;
  /** Accent span control, e.g. "col-span-3 lg:col-span-1". */
  className: string;
}

export function BentoCard({
  title,
  description,
  icon,
  stat,
  to,
  actionLabel,
  background,
  className,
  ...props
}: BentoCardProps) {
  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line/70 bg-surface/70 shadow-panel backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10',
        className
      )}
      {...props}
    >
      {/* Specular ambient glass gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-radial-at-t from-primary/10 to-transparent"
      />

      {background ? (
        <div className="pointer-events-none absolute inset-0">{background}</div>
      ) : null}

      <div className="relative flex flex-col gap-1.5 p-6">
        {icon ? (
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs mb-1">
            {icon}
          </div>
        ) : null}
        {stat ? (
          <div className="text-3xl font-semibold leading-none tracking-tight text-ink tabular">
            {stat}
          </div>
        ) : null}
        <h3 className="text-lg font-semibold leading-tight text-ink">{title}</h3>
        <p className="text-xs sm:text-sm text-ink-dim leading-relaxed">{description}</p>
      </div>

      {to && actionLabel ? (
        <div className="relative flex items-center gap-2 p-6 pt-0">
          <Link
            to={to}
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary transition-all group-hover:gap-2.5"
          >
            {actionLabel}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}