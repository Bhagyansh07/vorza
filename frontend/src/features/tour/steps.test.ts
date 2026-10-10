import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { TOURS } from './steps';
import type { AnimationKey } from '@/components/mascot/VorpyMascot';

/**
 * The step lists are hand-written data that only work if the markup agrees. A
 * typo in a `target` is invisible at runtime -- the engine just drops the step --
 * so these checks tie every target to a real `data-tour` anchor in the source,
 * and keep the copy clean.
 *
 * The anchor set is read from source (like `mascot-boundary.test.ts` does) so a
 * step pointing at a target nobody rendered fails here, not in a browser.
 */

const here = dirname(fileURLToPath(import.meta.url)); // src/features/tour
const SRC = resolve(here, '../..');

const ANIMATIONS: readonly AnimationKey[] = [
  'sleeping',
  'waking',
  'idle',
  'thinking',
  'working',
  'excited',
  'drowsy',
  'celebrate',
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Every `data-tour="..."` value rendered anywhere in `src`, minus the tour's own tests. */
function anchorsInSource(): Set<string> {
  const anchors = new Set<string>();
  const pattern = /data-tour="([^"]+)"/g;
  for (const file of sourceFiles(SRC)) {
    if (/\.test\.tsx?$/.test(file)) continue;
    const code = readFileSync(file, 'utf8');
    for (const match of code.matchAll(pattern)) anchors.add(match[1]);
  }
  return anchors;
}

describe('tour definitions', () => {
  const anchors = anchorsInSource();
  const tours = Object.entries(TOURS);

  it('has an anchor in the markup for every step target', () => {
    const missing: string[] = [];
    for (const [name, tour] of tours) {
      for (const step of tour.steps) {
        if (!anchors.has(step.target)) missing.push(`${name}:${step.target}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('gives every tour a unique id and at least one step', () => {
    const ids = tours.map(([, tour]) => tour.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [, tour] of tours) expect(tour.steps.length).toBeGreaterThan(0);
  });

  it('keeps every step complete, on-palette and free of em dashes', () => {
    for (const [name, tour] of tours) {
      for (const step of tour.steps) {
        const where = `${name}:${step.target}`;
        expect(step.eyebrow.trim(), where).not.toBe('');
        expect(step.title.trim(), where).not.toBe('');
        expect(step.body.trim(), where).not.toBe('');
        expect(ANIMATIONS, where).toContain(step.animation);
        // House style: no em dashes in visible copy.
        expect(step.body.includes('\u2014'), where).toBe(false);
        expect(step.title.includes('\u2014'), where).toBe(false);
      }
    }
  });

  it('uses the mascot animation vocabulary only', () => {
    // Guards against a typo that would make the mascot fall back silently.
    expect(new Set(ANIMATIONS).size).toBe(ANIMATIONS.length);
  });
});
