/**
 * The consent copy must describe the grant the backend will actually request.
 *
 * This file exists because of a false claim that shipped. The login page said:
 *
 *   "By continuing you grant Vorza read access to your GitHub repos."
 *
 * and the landing page said:
 *
 *   "Vorza asks for read access to the repos you connect and nothing else."
 *
 * Both were false, in two independent ways:
 *
 * 1. **The scope grants write access.** The backend requests `repo`, which
 *    GitHub documents as "full access to public and private repositories
 *    including read and write access to code, commit statuses, repository
 *    invitations, collaborators, deployment statuses, and repository webhooks".
 *    Verified against
 *    https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
 *
 * 2. **It was not scoped to connected repos.** An OAuth scope covers every
 *    repository the user can reach, not the ones they chose to connect.
 *
 * Nothing could catch this. The claim was a hardcoded string in the frontend
 * and the value it described was on the other side of a network call. A test
 * asserting the sentence reads nicely would pass forever.
 *
 * So the backend now reports the grant, and these tests pin the copy to it.
 * The invariant: `write_access: true` must never produce copy claiming
 * read-only access.
 */
import { describe, expect, it } from 'vitest';

import { consentCopy } from './Login';

const grant = (scopes: string[], writeAccess: boolean) => ({
  authorizeUrl: 'https://github.com/login/oauth/authorize?x=1',
  scopes,
  writeAccess,
});

/**
 * Phrases that would constitute a false claim if asserted about the grant.
 *
 * Matching these needs care: the copy legitimately contains the words
 * "not read-only", because saying "GitHub's offer is not read-only" is the
 * honest version of the sentence. A naive substring check fails on that -- it
 * cannot tell an assertion from a denial, so the test rejected correct copy.
 *
 * So negations are stripped first, and only what remains counts as a claim.
 * If a future edit phrases the denial differently, the assertion below stops
 * being meaningful rather than silently passing, because the strip list is
 * asserted in its own right further down.
 */
const READ_ONLY_CLAIMS = [
  'read access only',
  'read-only access',
  'read only',
  'read-only',
  'nothing else',
];

/** Denials, removed before checking. */
const NEGATIONS = [
  'not read-only',
  'not read only',
  "isn't read-only",
  "isn't read only",
  'never read-only',
  'no read-only',
];

/** Copy with read-only denials removed: what remains is assertion, not denial. */
const withoutDenials = (copy: string): string => {
  let out = copy.toLowerCase();
  for (const negation of NEGATIONS) {
    out = out.split(negation).join('__denied__');
  }
  return out;
};

describe('consentCopy', () => {
  // --- the actual defect: `repo` was described as read-only ---------------
  it('does not claim read-only when the backend reports write access', () => {
    const copy = consentCopy(grant(['read:user', 'repo'], true));
    const asserted = withoutDenials(copy);
    for (const claim of READ_ONLY_CLAIMS) {
      expect(asserted, `copy asserts "${claim}"`).not.toContain(claim);
    }
  });

  it('says read and write when the backend reports write access', () => {
    const copy = consentCopy(grant(['read:user', 'repo'], true));
    // Both halves must be present. Saying only "read" understates it; saying
    // only "write" overstates it, since Vorza never writes.
    expect(copy).toContain('read and write');
    expect(copy).toContain('only reads');
  });

  it('names the scopes so the grant is not a black box', () => {
    const copy = consentCopy(grant(['read:user', 'repo'], true));
    expect(copy).toContain('read:user');
    expect(copy).toContain('repo');
  });

  // --- a genuinely read-only grant may say so ------------------------------
  it('may claim read-only when the backend reports no write access', () => {
    // Not the case today, but the copy has to be correct in both directions or
    // it is just a different lie. If someone later narrows the scope, saying
    // "read and write" would be its own false claim.
    const copy = consentCopy(grant(['read:user'], false));
    expect(copy.toLowerCase()).toContain('read-only');
    expect(copy).toContain('read:user');
  });

  // --- a missing report must not become a confident claim ------------------
  it('does not claim read-only when the backend reported nothing', () => {
    // An older backend, or a response missing the field. The previous code
    // treated a missing value as `false` and would have shown "read access" --
    // guessing in the direction of the nicer-sounding lie. This asserts the
    // opposite: unknown is not read-only.
    const copy = consentCopy(grant([], false));
    const asserted = withoutDenials(copy);
    for (const claim of READ_ONLY_CLAIMS) {
      expect(
        asserted,
        `copy guesses "${claim}" from an unknown grant`
      ).not.toContain(claim);
    }
  });

  it('still produces usable copy when the scope list is empty', () => {
    // `consentCopy` returns a string and is rendered unconditionally once the
    // grant exists, so it must never return empty or undefined.
    for (const scopes of [[], ['read:user'], ['read:user', 'repo']]) {
      for (const writeAccess of [true, false]) {
        const copy = consentCopy(grant(scopes, writeAccess));
        expect(typeof copy).toBe('string');
        expect(copy.trim().length).toBeGreaterThan(20);
      }
    }
  });

  it('the denial stripper actually neutralises a denial', () => {
    // Without this, every assertion above could pass for the wrong reason: a
    // helper that removed nothing would make them vacuously true, which is how
    // a test stops testing anything while still being green.
    expect(withoutDenials('this is not read-only at all')).not.toContain(
      'read-only'
    );
    expect(withoutDenials('this IS read-only')).toContain('read-only');
  });

  it('the write-access copy still denies read-only, in words', () => {
    // So the stripper is not passing because the copy avoids the phrase
    // entirely -- the honest copy says it out loud.
    expect(consentCopy(grant(['read:user', 'repo'], true)).toLowerCase()).toContain(
      'not read-only'
    );
  });

  it('is deterministic, so the same grant always reads the same way', () => {
    const a = consentCopy(grant(['read:user', 'repo'], true));
    const b = consentCopy(grant(['read:user', 'repo'], true));
    expect(a).toBe(b);
  });
});