import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ForceDirectedGraph } from './ForceDirectedGraph';
import type { FileNode, GraphLink } from '../types';

const files: FileNode[] = [
  {
    path: 'src/app.tsx',
    loc: 420,
    complexity_score: 28,
    churn_score: 42,
    health_score: 72,
    imports: ['src/lib/api.ts'],
  },
  {
    path: 'src/lib/api.ts',
    loc: 310,
    complexity_score: 44,
    churn_score: 61,
    health_score: 48,
    imports: [],
  },
  {
    path: 'src/lib/utils.ts',
    loc: 95,
    complexity_score: 8,
    churn_score: 12,
    health_score: 94,
    imports: [],
  },
];

const links: GraphLink[] = [{ source: 'src/app.tsx', target: 'src/lib/api.ts' }];

describe('ForceDirectedGraph', () => {
  it('mounts without crashing and maps every node and link', async () => {
    render(
      <ForceDirectedGraph
        files={files}
        links={links}
        selectedPath={null}
        onSelect={() => {}}
      />,
    );

    // Regression: the tick-lookup maps were built with d3's `selection.each`,
    // which hands React-owned elements an `undefined` datum; reading `n.id` on
    // it threw "Cannot read properties of undefined" on every mount and the
    // ErrorBoundary replaced the whole map with "Something went wrong". The
    // scan now reads `data-node-id` / `data-link-id` from the DOM instead, so
    // give the simulation a few timer ticks, then assert the map is intact.
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-node]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-node-id]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-link]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-link-id]')).toHaveLength(1);
  });
});