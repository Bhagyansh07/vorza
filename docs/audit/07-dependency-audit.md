docs/audit/07-dependency-audit.md

# Dependency audit — what is actually reachable

`npm audit` reported **10 vulnerabilities (6 high, 4 moderate)** and this pass
left them untouched. That was a defensible deferral at the time and an
indefensible one now, so this is the triage: each advisory classified by whether
it can execute in this app, what was fixed here, and what is deliberately not.

The headline number is a poor proxy for risk in a Node project. Eight of the ten
live in the dev tree or in build tooling that never ships to a browser, and one
of the two runtime ones is unreachable in a Vite SPA. "10 advisories" sounded
like a crisis and was closer to two findings plus noise.

**Verified 2026-10-05**, npm 12.0.2, Node v24.15.0.

---

## Runtime-reachable

### 1. `react-router` — open redirect via backslash — **MITIGATED IN APP, DEP NOT UPGRADED**

`GHSA-wrjc-x8rr-h8h6` (open redirect in `<Link>` and `useNavigate`, listed as a
CVE-2025-68470 bypass) and `GHSA-337j-9hxr-rhxg` (constructor injection in
`deserializeErrors()`). Affected: `react-router` 6.0.0 – 7.17.0. Installed:
**6.30.6**. Fixed in 7.18.4.

Reachable, and this is a genuine finding rather than a theoretical one:

- `ProtectedRoute.tsx:29` does `<Navigate to="/login" state={{ from: location.pathname }} replace />`
- `Login.tsx:64` does `navigate(from, { replace: true })` after sign-in

`location.pathname` is whatever was in the address bar, so an attacker who sends
a victim a link to `https://<app>/\evil.com` gets that string stored in
`location.state.from` and navigated to after authentication. The `\` is the
advisory's payload: browsers treat it like `/` inside an authority, making it a
protocol-relative URL pointing off-origin.

**Fixed in the application**, in `features/auth/routes/safe-redirect.ts`, with
`Login.tsx` calling it. It rejects a backslash, a `//` prefix, a non-`/` prefix,
a leading control character or space, and any `:` — and allows percent-encoding,
because `/repos/abc%2Fdef` is a real repo id and rejecting it would break a real
link to fix a fake one. 11 tests, including the advisory's exact payload.

**Why the dependency was not upgraded.** `react-router-dom@7.18.4` is a major
version. The v6→v7 migration changes the router surface across every route, and
it cannot be done safely in the same commit as a security fix — the natural
failure mode is a rushed migration that breaks auth. It is filed as roadmap
**F12**.

The app-level guard is the right shape regardless of the dependency version.
7.18.4 fixes a class of separators; depending on the library to sanitise an
attacker-reachable redirect target means relying on a transitive guarantee
instead of owning it.

### 2. `react-router` `deserializeErrors()` — **NOT REACHABLE**

Constructor injection during SSR hydration data deserialisation. This app is a
pure client-side Vite SPA:

- no `renderToString`, no `hydrateRoot` anywhere in `src/`
- no `StaticRouter`, `ServerRouter`, `createStaticHandler` or
  `deserializeErrors` usage

There is no server rendering and therefore no hydration payload to deserialise.
Recorded as **not applicable**, not as fixed.

---

## Dev-tree only — not shipped to a browser

Verified by scanning every emitted chunk in `dist/assets/` for the package
names. `brace-expansion`, `braces`, `micromatch`, `fast-glob`, `chokidar`,
`@vitest/mocker` and `tailwindcss`: **zero matches** in any of the four JS
chunks.

| Advisory | Severity | Reachable at runtime? | Action |
|---|---|---|---|
| `brace-expansion` quadratic expansion + stack exhaustion (`GHSA-q2hr-2g5m-vwhr`, `GHSA-qhr7-859c-m2p7`, `GHSA-6j4f-fj2g-mc7p`) | high | No — eslint only | **Fixed** by `npm audit fix`: 1.1.18 → 1.1.21, 5.0.9 → 5.0.12 |
| `braces` stack-exhaustion DoS (`GHSA-vfj7-8cjw-p6xm`) | high | No — `tailwindcss`→`chokidar`→`micromatch` | Deferred, see below |
| `@vitest/mocker` path traversal (`GHSA-82fw-gwwq-j7x9`) | moderate | No — vitest only | Deferred |

These are **real advisories with real severity ratings** and the honest
position is that they are unfixed. What is true, and worth stating precisely,
is that they cannot execute in a deployed browser: they require an attacker to
control glob patterns or test mocks in a development machine or a CI runner.
That is a much smaller surface than "6 high vulnerabilities" suggests, and it is
not nothing — a compromised CI is a serious event.

`brace-expansion` was fixed because `npm audit fix` did it cleanly with no
breaking change: three transitive bumps inside eslint's tree, `git diff` on the
lockfile confirms nothing else moved. Full suite re-run after.

The other two need a major upgrade each — `tailwindcss` 3→4 and `vitest` 3→5 —
and each is a migration with its own risk, filed as roadmap **F13**.

---

## After this pass

```
$ npm audit
9 vulnerabilities (4 moderate, 5 high)
```

Down one from 10. The 5 remaining high are `braces` instances reached through
`tailwindcss`'s watcher and eslint's copy of `micromatch` — all dev-tree. The
2 remaining moderate runtime advisories are the react-router pair: one
mitigated in application code, one unreachable.

`npm audit --omit=dev` reports **2 moderate, 0 high** — the two react-router
advisories, since react-router is the only runtime dependency with a finding.

---

## The lesson, stated plainly

The useful work was not the dependency bump, it was reading each advisory and
asking *where does this code run*. Two of ten were reachable. One of those two
was a real open-redirect chain through the auth flow that no tool had flagged and
that reading the code surfaced immediately.

A count of 10 with no triage invites either panic or dismissal. Both are wrong.
The honest statement was always "one open redirect in the login redirect, now
guarded; eight advisories in dev tooling that do not ship; one not applicable
without SSR" — and that took an afternoon to establish, not a scan.

**NOT VERIFIED:** no exploit was run against a live deploy, so the open-redirect
chain is established by reading `ProtectedRoute` and `Login` plus the advisory
text, not by observing a redirect. The unit tests assert the guard's behaviour,
not that a browser followed a malicious link. Fixing `react-router-dom`
(F12) is the change that would make that unnecessary to reason about.