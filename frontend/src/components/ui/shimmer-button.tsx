import React, { type ComponentPropsWithoutRef, type CSSProperties } from 'react';

import { cn } from '@/lib/utils';

/**
 * ShimmerButton, from magicui (MIT). A button whose perimeter is swept by a
 * rotating light.
 *
 * Adapted for Vorza's token system: the default fill and shimmer are built
 * from `--primary` / `--primary-foreground` instead of `#ffffff`/black, and
 * the hardcoded `border-white/10` + inset glow classes were dropped (the
 * surface border comes from `border-line`).
 *
 * Pass any CSS background string (token-based, e.g. `hsl(var(--primary))`)
 * through `background`; text colour via `className` (`text-primary-foreground`).
 */
export interface ShimmerButtonProps extends ComponentPropsWithoutRef<'button'> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
}

export const ShimmerButton = React.forwardRef<
  HTMLButtonElement,
  ShimmerButtonProps
>(
  (
    {
      shimmerColor = 'hsl(var(--primary-foreground) / 0.9)',
      shimmerSize = '0.05em',
      shimmerDuration = '3s',
      borderRadius = '100px',
      background = 'hsl(var(--primary))',
      className,
      children,
      ...props
    },
    ref
  ) => (
    <button
      style={
        {
          '--spread': '90deg',
          '--shimmer-color': shimmerColor,
          '--radius': borderRadius,
          '--speed': shimmerDuration,
          '--cut': shimmerSize,
          '--bg': background,
        } as CSSProperties
      }
      className={cn(
        'group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-line px-6 py-3 text-primary-foreground [border-radius:var(--radius)] [background:var(--bg)]',
        'transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px',
        className
      )}
      ref={ref}
      {...props}
    >
      {/* spark container */}
      <div className="-z-30 absolute inset-0 overflow-visible blur-[2px]">
        {/* spark */}
        <div className="animate-shimmer-slide absolute inset-0 aspect-[1] h-full rounded-none [mask:none]">
          {/* spark before */}
          <div className="animate-spin-around absolute -inset-full w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
        </div>
      </div>
      {children}

      {/* backdrop */}
      <div className="absolute [inset:var(--cut)] -z-20 [border-radius:var(--radius)] [background:var(--bg)]" />
    </button>
  )
);

ShimmerButton.displayName = 'ShimmerButton';