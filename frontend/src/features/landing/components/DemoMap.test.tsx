import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { DemoMap } from './DemoMap';
import { demoFiles, demoLinks, demoSeedPositions } from './demoData';

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 40));
}

describe('DemoMap', () => {
  it('mounts without crashing and maps every node and link (fit is skipped in jsdom)', async () => {
    render(
      <DemoMap
        files={demoFiles()}
        links={demoLinks()}
        positions={demoSeedPositions()}
        height={480}
      />,
    );
    await settle();

    const svg = screen.getByRole('img');
    expect(svg).toHaveAccessibleName(/Demo map of a codebase/);
    expect(document.querySelectorAll('[data-node]')).toHaveLength(demoFiles().length);
    expect(document.querySelectorAll('[data-link-id]')).toHaveLength(demoLinks().length);
  });

  it('exposes every node as a focusable button in blast-radius mode', () => {
    render(
      <DemoMap
        files={demoFiles()}
        links={demoLinks()}
        positions={demoSeedPositions()}
        blastRadius
        selectedPath={null}
        onSelect={() => {}}
        height={460}
      />,
    );

    const locus = demoFiles().find((f) => f.health_score < 70);
    expect(locus).toBeDefined();
    const node = screen.getByRole('button', {
      name: new RegExp(locus!.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    });
    expect(node).toHaveAttribute('tabindex', '0');
    expect(node.getAttribute('aria-label')).toMatch(/dependents/);
  });

  it('surveys a node with the keyboard (Enter)', async () => {
    const onSelect = vi.fn();
    render(
      <DemoMap
        files={demoFiles()}
        links={demoLinks()}
        positions={demoSeedPositions()}
        blastRadius
        selectedPath={null}
        onSelect={onSelect}
        height={460}
      />,
    );
    await settle();

    const locus = demoFiles().find((f) => f.path.startsWith('backend'));
    const node = screen.getByRole('button', {
      name: new RegExp(locus!.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    });
    fireEvent.keyDown(node, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(locus!.path);
  });
});