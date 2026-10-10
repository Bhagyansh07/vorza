import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { validateAvatarDefinition } from '@bible-strong/avatar-core';

/**
 * Guards the committed Vorpy export.
 *
 * The mascot is rendered from `vorpy.avatar.json` (the byte-for-byte Bible
 * Strong Studio export). These assertions lock the parts a reviewer agreed to:
 * it is valid per the runtime's own validator, it carries Vorza's name and
 * colours, and it ships exactly the eight animations chosen in the studio.
 * `neutral`'s eye geometry is the agreed design (big, close-set, slight inward
 * tilt), and the rest of the file is the studio's per-expression variation.
 */

const here = dirname(fileURLToPath(import.meta.url));
const definition = JSON.parse(
  readFileSync(resolve(here, 'vorpy.avatar.json'), 'utf8'),
);

const ANIMATIONS = [
  'sleeping',
  'waking',
  'idle',
  'thinking',
  'working',
  'excited',
  'drowsy',
  'celebrate',
] as const;

describe('Vorpy avatar definition', () => {
  it('passes the studio runtime validator', () => {
    const result = validateAvatarDefinition(definition);
    const errors = result.ok ? [] : result.errors;
    expect(errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('is Vorza’s mascot: name, indigo body, pale eyes', () => {
    expect(definition.name).toBe('Vorpy');
    expect(definition.colors).toEqual({ body: '#2f27ce', eyes: '#e7e9ff' });
  });

  it('ships exactly the eight agreed animations, in order', () => {
    expect(definition.animationOrder).toEqual([...ANIMATIONS]);
    for (const key of ANIMATIONS) {
      expect(definition.animations[key], key).toBeDefined();
    }
    expect(Object.keys(definition.animations).sort()).toEqual(
      [...ANIMATIONS].sort(),
    );
  });

  it('uses the agreed big, close-set, inward-tilted neutral eyes', () => {
    const { eyes } = definition.expressions.neutral;
    expect(eyes.left).toMatchObject({ width: 34, height: 62, angle: 8 });
    expect(eyes.right).toMatchObject({ width: 34, height: 62, angle: -8 });
    // `spacing` is centre-to-centre, so the visible gap is spacing - width.
    expect(eyes.spacing).toBe(50);
    expect(eyes.spacing - eyes.left.width).toBeGreaterThan(0);
  });

  it('keeps every animation step pointing at a real expression', () => {
    for (const key of definition.animationOrder) {
      const animation = definition.animations[key];
      expect(animation.steps.length, key).toBeGreaterThan(0);
      for (const step of animation.steps) {
        expect(definition.expressions[step.expression], `${key} → ${step.expression}`).toBeDefined();
      }
    }
  });

  it('keeps eye geometry on the sphere', () => {
    // The primary surface is a 240px sphere (radius 120). An eye wider than the
    // body, or a non-positive gap, would render as a detached shape.
    for (const [name, expr] of Object.entries<{
      eyes: {
        spacing: number;
        left: { width: number };
        right: { width: number };
      };
    }>(definition.expressions)) {
      expect(expr.eyes.spacing, name).toBeGreaterThan(0);
      expect(expr.eyes.left.width, name).toBeLessThan(120);
      expect(expr.eyes.right.width, name).toBeLessThan(120);
    }
  });
});
