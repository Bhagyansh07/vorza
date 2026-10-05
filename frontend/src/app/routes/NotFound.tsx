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
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <MapIcon className="h-10 w-10 text-primary/70" />
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">
        This corner of the map doesn't exist.
      </p>
      <Button asChild>
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}