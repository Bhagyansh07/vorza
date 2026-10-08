import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

/**
 * Bento grid family, adapted from magicui's BentoGrid/BentoCard (MIT).
 *
 * Adapted for Vorza's constraints:
 *  - no `dark:` variants, no literal colours: every surface/ink/line class
 *    below is a token, so the grid follows both themes through index.css;
 *  - `@radix-ui/react-icons` replaced with lucide (already a dependency);
 *  - `action` renders a react-router `Link` instead of a bare `<a>` so SPA
 *    navigation never reloads the shell.
 *
 * The layout contract is magicui's: a 3-column grid of 22rem auto rows where
 * a card opts into taller/wider spans via its own `className`.
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
  to,
  actionLabel,
  background,
  className,
  ...props
}: BentoCardProps) {
  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-xl border border-line bg-surface shadow-panel transition-colors hover:border-primary/50',
        className
      )}
      {...props}
    >
      {background ? (
        <div className="pointer-events-none absolute inset-0">{background}</div>
      ) : null}

      <div className="relative flex flex-col gap-1 p-5">
        {icon ? <div className="text-primary">{icon}</div> : null}
        <h3 className="text-lg font-semibold leading-tight text-ink">{title}</h3>
        <p className="text-sm text-ink-dim">{description}</p>
      </div>

      {to && actionLabel ? (
        <div className="relative flex items-center gap-2 p-5 pt-0">
          <Link
            to={to}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/90"
          >
            {actionLabel}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}