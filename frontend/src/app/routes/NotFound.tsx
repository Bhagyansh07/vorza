import { Link } from 'react-router-dom';
import { MapIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDocumentMeta } from '@/lib/seo';

export function NotFound() {
  useDocumentMeta({
    title: 'Not found',
    description: 'This page does not exist.',
    // A 404 must not be indexed, or the URL keeps getting re-submitted.
    path: '/404',
    noindex: true,
  });

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 text-center overflow-hidden">
      {/* Unified cyber grid and radial ambient auras */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(168,242,90,0.12),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-cyber-grid bg-[size:44px_44px] opacity-20 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_45%,black_40%,transparent_100%)]" />

      <div className="relative z-10 mx-auto max-w-md rounded-3xl border border-line/70 bg-surface/80 p-8 sm:p-10 shadow-2xl backdrop-blur-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/25 shadow-inner">
          <MapIcon className="h-8 w-8" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary font-bold">
          Telemetry · Coordinates Uncharted
        </span>
        <h1 className="mt-2 text-5xl font-extrabold tracking-tight text-ink font-mono">
          404
        </h1>
        <p className="mt-3 text-sm text-ink-dim leading-relaxed">
          This coordinate lies beyond the edge of mapped dependencies. Return to the workspace to resume analysis.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg" className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md px-6">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}