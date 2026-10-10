import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { TOUR_STEPS, VorpyTour } from './VorpyTour';

/**
 * The tour is a guide, not a slideshow: these tests pin the behaviour a visitor
 * depends on -- start, step forward and back, a visible step counter, Escape to
 * leave with focus handed back -- plus the two honesty rules: reduced motion
 * jumps instead of gliding, and every step points at an anchor that exists.
 */

function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

describe('VorpyTour', () => {
  let anchors: HTMLElement;

  beforeEach(() => {
    stubMatchMedia(false);
    // jsdom has neither a layout nor scrollIntoView; both are stubbed so the
    // scroll effect can run.
    Element.prototype.scrollIntoView = vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
    anchors = document.createElement('div');
    anchors.innerHTML = TOUR_STEPS.map(
      (step) => `<div data-tour="${step.target}"></div>`,
    ).join('');
    document.body.appendChild(anchors);
  });

  afterEach(() => {
    anchors.remove();
    vi.unstubAllGlobals();
  });

  it('invites a tour, then opens on the first step', () => {
    render(<VorpyTour />);
    const start = screen.getByRole('button', {
      name: /start the vorpy guided tour/i,
    });
    expect(start).toBeTruthy();

    fireEvent.click(start);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(TOUR_STEPS[0].title)).toBeTruthy();
    expect(within(dialog).getByText(`1 / ${TOUR_STEPS.length}`)).toBeTruthy();
  });

  it('steps forward and back through the tour', () => {
    render(<VorpyTour />);
    fireEvent.click(
      screen.getByRole('button', { name: /start the vorpy guided tour/i }),
    );

    fireEvent.click(screen.getByRole('button', { name: /^next/i }));
    expect(screen.getByText(TOUR_STEPS[1].title)).toBeTruthy();
    expect(screen.getByText(`2 / ${TOUR_STEPS.length}`)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^back/i }));
    expect(screen.getByText(TOUR_STEPS[0].title)).toBeTruthy();
  });

  it('closes on Escape and hands focus back to the invite', () => {
    render(<VorpyTour />);
    fireEvent.click(
      screen.getByRole('button', { name: /start the vorpy guided tour/i }),
    );
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    // The invite is remounted by React, so it is a new node; assert focus on the
    // node that is actually in the document.
    const start = screen.getByRole('button', {
      name: /start the vorpy guided tour/i,
    });
    expect(document.activeElement).toBe(start);
  });

  it('jumps instead of gliding when reduced motion is set', () => {
    stubMatchMedia(true);
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<VorpyTour />);
    fireEvent.click(
      screen.getByRole('button', { name: /start the vorpy guided tour/i }),
    );

    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toMatchObject({ behavior: 'auto' });
  });
});

describe('the tour anchors exist', () => {
  it('every step target is a data-tour anchor in the landing markup', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = ['../routes/Landing.tsx', './ScrollStory.tsx']
      .map((file) => readFileSync(resolve(here, file), 'utf8'))
      .join('\n');

    for (const step of TOUR_STEPS) {
      expect(source).toContain(`data-tour="${step.target}"`);
    }
  });
});
