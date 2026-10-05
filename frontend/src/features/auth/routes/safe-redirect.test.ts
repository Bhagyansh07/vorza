/**
 * Login must only ever navigate to a path inside the app.
 *
 * `from` is read from `location.state.from`, which `ProtectedRoute` sets to
 * `location.pathname`. That pathname is attacker-supplied: anyone can send a
 * victim a link to `https://<app>/\evil.com`, the browser keeps it as the
 * pathname, and after sign-in `navigate(from)` fires.
 *
 * React Router 6.30.6 has an open-redirect advisory here — GHSA-wrjc-x8rr-h8h6,
 * "Open redirect via backslash in `<Link>` and `useNavigate`", plus
 * CVE-2025-68470 bypass — fixed in 7.18.4. Upgrading means a v6 -> v7 migration,
 * which is a breaking change across the whole router surface, so it is filed as
 * its own task rather than smuggled in here.
 *
 * So the app guards its own input in the meantime. That is the right shape
 * anyway: the guard is needed regardless of the dependency version, because the
 * fix in 7.18.4 covers a class of separators, and relying on the library to
 * sanitise an attacker-reachable redirect target is trusting a transitive
 * guarantee rather than owning it.
 */
import { describe, expect, it } from 'vitest';

import { safeInternalPath } from '@/features/auth/routes/safe-redirect';

describe('safeInternalPath', () => {
  it('keeps ordinary in-app paths unchanged', () => {
    expect(safeInternalPath('/dashboard')).toBe('/dashboard');
    expect(safeInternalPath('/repos/abc-123/history')).toBe('/repos/abc-123/history');
  });

  it('keeps a path with a query string or hash', () => {
    expect(safeInternalPath('/dashboard?tab=repos')).toBe('/dashboard?tab=repos');
    expect(safeInternalPath('/repos/x#files')).toBe('/repos/x#files');
  });

  it('keeps a percent-encoded path, since the browser will decode it later', () => {
    // /repos/abc%2Fdef is a legitimate repo id containing a slash once decoded.
    // Rejecting it would break a real link rather than a real attack.
    expect(safeInternalPath('/repos/abc%2Fdef')).toBe('/repos/abc%2Fdef');
  });

  // --- the actual advisory: a leading backslash or double slash -------------

  it('rejects a backslash-prefixed path', () => {
    // The advisory's payload. Browsers treat \ like / in a URL authority, so
    // /\evil.com is a protocol-relative link to evil.com.
    expect(safeInternalPath('/\\evil.com')).toBe('/dashboard');
    expect(safeInternalPath('\\\\evil.com')).toBe('/dashboard');
    expect(safeInternalPath('/foo/\\..\\evil.com')).toBe('/dashboard');
  });

  it('rejects a protocol-relative path', () => {
    expect(safeInternalPath('//evil.com')).toBe('/dashboard');
    expect(safeInternalPath('//evil.com/path')).toBe('/dashboard');
  });

  it('rejects an absolute URL', () => {
    expect(safeInternalPath('https://evil.com')).toBe('/dashboard');
    expect(safeInternalPath('http://evil.com')).toBe('/dashboard');
    expect(safeInternalPath('HTTPS://evil.com')).toBe('/dashboard');
    // Mixed case, because URL schemes are case-insensitive.
    expect(safeInternalPath('jAvAsCrIpT:alert(1)')).toBe('/dashboard');
  });

  it('rejects a relative path, which would resolve against the current route', () => {
    expect(safeInternalPath('dashboard')).toBe('/dashboard');
    expect(safeInternalPath('../admin')).toBe('/dashboard');
    expect(safeInternalPath('./dashboard')).toBe('/dashboard');
  });

  it('rejects whitespace and control characters used to smuggle a target', () => {
    // A leading newline or tab is stripped by some URL parsers, turning
    // "\n//evil.com" into a protocol-relative URL.
    expect(safeInternalPath('\n//evil.com')).toBe('/dashboard');
    expect(safeInternalPath('\t//evil.com')).toBe('/dashboard');
    expect(safeInternalPath('  //evil.com')).toBe('/dashboard');
  });

  it('rejects an empty or missing value by falling back', () => {
    expect(safeInternalPath('')).toBe('/dashboard');
    expect(safeInternalPath(undefined)).toBe('/dashboard');
    expect(safeInternalPath(null)).toBe('/dashboard');
  });

  it('rejects a non-string, since location.state is typed but not guaranteed', () => {
    // `location.state as { from?: string }` is a cast, not a guarantee. A value
    // of 42 would otherwise reach navigate() and crash the post-login redirect.
    expect(safeInternalPath(42 as unknown as string)).toBe('/dashboard');
    expect(safeInternalPath({} as unknown as string)).toBe('/dashboard');
  });

  it('does not reject a path that merely looks like it has an authority', () => {
    // Guarding on a naive /^\/\// alone would also reject a legitimate future
    // route. Confirm the check is on the actual redirect semantics.
    expect(safeInternalPath('/repos//history')).toBe('/repos//history');
  });
});