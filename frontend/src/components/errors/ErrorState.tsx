import { AlertTriangle, RefreshCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toErrorMessage } from '@/lib/errors';

interface ErrorStateProps {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
}

/** Shared full-width error state for query failures. */
export function ErrorState({ title = 'Something went wrong', error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card/50 px-6 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <div>
        <p className="font-medium">{title}</p>
        {error ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {toErrorMessage(error)}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCcw />
          Try again
        </Button>
      ) : null}
    </div>
  );
}