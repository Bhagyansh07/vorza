import { cn } from '@/lib/utils';

interface MarkProps {
  className?: string;
}

/**
 * The Vorza mark: a V drawn as two graph edges meeting at a vertex, with a
 * node where each edge starts. It reads as the letter at 16px and as the
 * product's own subject (a node graph) at any size above that.
 *
 * Inherited `currentColor` is deliberate: the same component renders blue on
 * white in the navbar, white on the blue plate in the favicon and app icons,
 * and needs no variant prop to do it.
 */
export function LogoMark({ className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn('h-6 w-6', className)}
    >
      <path
        d="M6.4 6.75 12 17.6l5.6-10.85"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.4" cy="6.75" r="2.6" fill="currentColor" />
      <circle cx="17.6" cy="6.75" r="2.6" fill="currentColor" />
    </svg>
  );
}

interface LogoProps extends MarkProps {
  /** Size class for the wordmark text, e.g. `text-base`. */
  wordClassName?: string;
  /** Accessible label. Defaults to "Vorza". */
  label?: string;
}

/**
 * Horizontal lockup: mark plus wordmark. The wordmark is live text in the
 * interface font rather than an image, so it stays sharp, inherits the page
 * theme, and cannot drift from the type scale.
 */
export function Logo({ className, wordClassName, label = 'Vorza' }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className="h-[22px] w-[22px] shrink-0 text-primary" />
      <span
        className={cn(
          'text-[15px] font-semibold leading-none tracking-[-0.01em] text-foreground',
          wordClassName,
        )}
      >
        {label}
      </span>
    </span>
  );
}
