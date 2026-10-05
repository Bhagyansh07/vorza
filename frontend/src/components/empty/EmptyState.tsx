import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  body: string | ReactNode;
  primary?: {
    label: string;
    onClick?: () => void;
    asChild?: boolean;
    children?: ReactNode;
  };
  secondary?: {
    label: string;
    onClick?: () => void;
    asChild?: boolean;
    children?: ReactNode;
  };
  className?: string;
}

/**
 * Shared full-width empty state with a primary action.
 * Must never contain the word "loading".
 */
export function EmptyState({
  icon,
  title,
  body,
  primary,
  secondary,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card/40 px-6 py-12 text-center ${className}`}
    >
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="font-medium">{title}</p>
        {typeof body === 'string' ? (
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{body}</p>
        ) : (
          <div className="mt-1 max-w-xl text-sm text-muted-foreground">{body}</div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {primary ? (
          <Button onClick={primary.onClick} asChild={primary.asChild}>
            {primary.children ?? primary.label}
          </Button>
        ) : null}
        {secondary ? (
          <Button variant="outline" onClick={secondary.onClick} asChild={secondary.asChild}>
            {secondary.children ?? secondary.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
