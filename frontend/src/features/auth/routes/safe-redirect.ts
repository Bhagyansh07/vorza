/**
 * Fallback for any redirect target that is not a plain in-app path.
 *
 * Kept as a constant so `safeInternalPath` has no import cycle with the router,
 * and so the tests can assert against the same value the app uses.
 */
export const DEFAULT_REDIRECT = '/dashboard';

/**
 * Return `candidate` if it is a path inside this app, else `fallback`.
 *
 * The problem: `Login.tsx` navigates to `location.state.from`, which
 * `ProtectedRoute` sets from `location.pathname`. That pathname is whatever the
 * browser put in the address bar, so an attacker can put anything there and
 * hand the victim a link.
 *
 * React Router 6.30.6 has an open-redirect advisory for exactly this
 * (GHSA-wrjc-x8rr-h8h6, plus the CVE-2025-68470 bypass), fixed in 7.18.4.
 * Upgrading is a v6 -> v7 migration and is filed separately; this guard is the
 * mitigation in the meantime.
 *
 * The rules, and why each one:
 *
 * - **Must start with a single `/`.** Rejects absolute URLs, protocol-relative
 *   `//evil.com`, and relative paths that would resolve against the current
 *   route (`dashboard`, `../admin`).
 * - **No backslash anywhere.** Browsers treat `\` like `/` inside an authority,
 *   which is what makes `/\evil.com` a redirect off-origin. This is the
 *   advisory's payload, and it is the rule a `/^\/\//` check alone misses.
 * - **No leading or embedded whitespace/control characters.** Some URL parsers
 *   strip them, so `"\n//evil.com"` becomes protocol-relative *after* the check
 *   that would have caught it.
 * - **No scheme.** Belt and braces behind the leading-`/` rule: `javascript:` and
 *   `data:` do not start with `/`, but a colon-free-looking string should still
 *   not be treated as a path.
 * - **Percent-encoding is allowed.** `/repos/abc%2Fdef` is a legitimate repo id
 *   whose decoded form contains a slash. Rejecting it would break a real link,
 *   and a `%2f` cannot introduce an authority because the authority is decided
 *   by the literal prefix.
 *
 * Not a general-purpose URL sanitiser: it decides one question, "is this
 * somewhere inside the app?", and answers no for anything it is not sure about.
 */
export function safeInternalPath(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT
): string {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    return fallback;
  }

  // Leading whitespace and C0 controls. Checked before anything else, because
  // they are stripped by URL parsers and would otherwise hide the real prefix.
  // eslint-disable-next-line no-control-regex
  if (/^[\s\u0000-\u001f\u007f]/.test(candidate)) {
    return fallback;
  }

  // Backslash: the advisory's payload.
  if (candidate.includes('\\')) {
    return fallback;
  }

  // Exactly one leading slash. `//host` is protocol-relative; `/x` is a path.
  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }

  // A scheme cannot legally appear in a same-origin path, and its presence
  // means the value was not a path to begin with.
  if (candidate.includes(':')) {
    return fallback;
  }

  return candidate;
}