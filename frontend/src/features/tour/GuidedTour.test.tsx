import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { GuidedTour } from './GuidedTour';
import type { TourDefinition } from './types';

/**
 * The engine is shared by every screen, so these tests pin the contract a
 * visitor depends on: an invite, a step counter, forward and back, Escape to
 * leave with focus handed back -- plus the two behaviours that keep it honest:
 * reduced motion jumps instead of gliding, and a step whose anchor is absent is
 * dropped rather than pointing at nothing.
 */

const TOUR: TourDefinition = {
  id: 'test',
  invite: 'Show me around',
  label: 'The test tour',
  steps: [
    {
      target: 'one',
      eyebrow: 'First',
      title: 'Step one',
      body: 'Body one.',
      animation: 'idle',
    },
    {
      target: 'two',
      eyebrow: 'Second',
      title: 'Step two',
      body: 'Body two.',
      animation: 'thinking',
    },
    {
      target: 'three',
      eyebrow: 'Third',
      title: 'Step three',
      body: 'Body three.',
      animation: 'celebrate',
    },
  ],
};

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

function addAnchor(target: string): void {
  const el = document.createElement('div');
  el.setAttribute('data-tour', target);
  // jsdom returns a zero-sized rect, which the engine treats as "not on screen".
  el.getBoundingClientRect = () =>
    ({ top: 0, left: 0, right: 100, bottom: 50, width: 100, height: 50, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(el);
}

describe('GuidedTour', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubMatchMedia(false);
    Element.prototype.scrollIntoView = vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
    addAnchor('one');
    addAnchor('two');
    addAnchor('three');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('invites a tour, then opens on the first step', () => {
    render(<GuidedTour tour={TOUR} />);
    const start = screen.getByRole('button', {
      name: /start the vorpy guided tour/i,
    });
    expect(start).toBeTruthy();
    expect(within(start).getByText('The test tour')).toBeTruthy();

    fireEvent.click(start);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Step one')).toBeTruthy();
    expect(within(dialog).getByText('1 / 3')).toBeTruthy();
  });

  it('steps forward and back, and records that it has been seen', () => {
    render(<GuidedTour tour={TOUR} />);
    fireEvent.click(
      screen.getByRole('button', { name: /start the vorpy guided tour/i }),
    );
    expect(window.localStorage.getItem('vorza:tour:test')).toBe('seen');

    fireEvent.click(screen.getByRole('button', { name: /^next/i }));
    expect(screen.getByText('Step two')).toBeTruthy();
    expect(screen.getByText('2 / 3')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^back/i }));
    expect(screen.getByText('Step one')).toBeTruthy();
  });

  it('closes on Escape and hands focus back to the invite', () => {
    render(<GuidedTour tour={TOUR} />);
    fireEvent.click(
      screen.getByRole('button', { name: /start the vorpy guided tour/i }),
    );
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    const start = screen.getByRole('button', {
      name: /start the vorpy guided tour/i,
    });
    expect(document.activeElement).toBe(start);
  });

  it('jumps instead of gliding when reduced motion is set', () => {
    stubMatchMedia(true);
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<GuidedTour tour={TOUR} />);
    fireEvent.click(
      screen.getByRole('button', { name: /start the vorpy guided tour/i }),
    );

    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toMatchObject({ behavior: 'auto' });
  });

  it('drops a step whose anchor is not on screen', () => {
    render(<GuidedTour tour={TOUR} />);
    // Remove the third target before opening, as a route still loading would.
    document.querySelector('[data-tour="three"]')?.remove();

    fireEvent.click(
      screen.getByRole('button', { name: /start the vorpy guided tour/i }),
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^next/i }));
    expect(screen.getByText('Step two')).toBeTruthy();
    expect(screen.getByText('2 / 2')).toBeTruthy();
    // The last visible step ends the tour rather than showing a dead Next.
    expect(screen.getByRole('button', { name: /^done/i })).toBeTruthy();
  });
});
