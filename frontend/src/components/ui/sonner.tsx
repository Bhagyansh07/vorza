import { Toaster as SonnerToaster } from 'sonner';

import { cn } from '@/lib/utils';

export function Toaster({ className, ...props }: React.ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      theme="system"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: cn('!bg-card !border-border !text-foreground', className),
          description: '!text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}