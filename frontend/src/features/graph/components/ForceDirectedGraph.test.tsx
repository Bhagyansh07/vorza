import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

  it('exposes every node as a focusable button with an accessible name (R8)', async () => {
    render(
      <ForceDirectedGraph
        files={files}
        links={links}
        selectedPath={null}
        onSelect={() => {}}
      />,
    );

    // W5: the canvas is a labelled group (not role="img", which would make the
    // interactive children presentational), and each node is a real button.
    expect(document.querySelector('svg')).toHaveAttribute('role', 'group');

    const node = screen.getByRole('button', { name: /src\/app\.tsx/ });
    expect(node).toHaveAttribute('tabindex', '0');
    expect(node).toHaveAttribute('aria-pressed', 'false');
    expect(node.getAttribute('aria-label')).toMatch(/Healthy health/);
  });

  it('selects a node with the keyboard: Enter (R8)', () => {
    const onSelect = vi.fn();
    render(
      <ForceDirectedGraph
        files={files}
        links={links}
        selectedPath={null}
        onSelect={onSelect}
      />,
    );

    const node = screen.getByRole('button', { name: /src\/lib\/api\.ts/ });
    fireEvent.keyDown(node, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('src/lib/api.ts');
  });

  it('selects a node with the keyboard: Space (R8)', () => {
    const onSelect = vi.fn();
    render(
      <ForceDirectedGraph
        files={files}
        links={links}
        selectedPath={null}
        onSelect={onSelect}
      />,
    );

    const node = screen.getByRole('button', { name: /src\/app\.tsx/ });
    fireEvent.keyDown(node, { key: ' ' });
    expect(onSelect).toHaveBeenCalledWith('src/app.tsx');
  });
});