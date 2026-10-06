import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Github, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';

import { LogoMark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { config, oauthRedirect } from '@/lib/config';
import { toErrorMessage } from '@/lib/errors';
import { useDocumentMeta } from '@/lib/seo';
import { safeInternalPath } from './safe-redirect';

interface QueryState {
  code: string | null;
  token: string | null;
  state: string | null;
  error: string | null;
}

function readQuery(search: string): QueryState {
  const params = new URLSearchParams(search);
  return {
    code: params.get('code'),
    token: params.get('token'),
    state: params.get('state'),
    error: params.get('error'),
  };
}

/**
 * What the backend says it is about to ask GitHub for.
 *
 * Returned alongside the URL so the consent line below describes the real grant.
 * This used to return just the URL while the page asserted "read access" in
 * hardcoded copy -- about a value that lives in the backend and was `repo`,
 * which is read *and write*. See `consentCopy`.
 */
interface AuthorizeGrant {
  authorizeUrl: string;
  scopes: string[];
  writeAccess: boolean;
}

/** Backend owns the OAuth URL (client_id, redirect_uri, signed state). */
async function fetchAuthorizeGrant(): Promise<AuthorizeGrant> {
  const response = await fetch(`${config.apiUrl}/auth/github/login`);
  if (!response.ok) {
    throw new Error('GitHub OAuth is not configured on the backend');
  }
  const body = (await response.json()) as {
    authorize_url?: string;
    scopes?: string[];
    write_access?: boolean;
  };
  if (!body.authorize_url) {
    throw new Error('GitHub OAuth is not configured on the backend');
  }
  return {
    authorizeUrl: body.authorize_url,
    scopes: body.scopes ?? [],
    // A missing field is `false` only for a backend too old to report it.
    // Defaulting the other way would repeat the bug this fixes, so the copy is
    // written to be correct without this field being present.
    writeAccess: body.write_access === true,
  };
}

/**
 * The consent sentence, derived from the grant the backend reports.
 *
 * The point of this function is that "read access" cannot be written as a
 * literal here. If the backend asks for a write scope, the copy says so, in
 * words someone clicking a consent button would understand -- not the scope
 * name, which means nothing to them.
 *
 * `repo` is GitHub's broad repository scope: read and write to code, plus
 * invitations, collaborators, webhooks and org resources. Vorza uses it to
 * clone and never writes -- but the grant is what the user accepts, and a
 * consent screen that understates the grant is the problem, not the scope.
 */
export function consentCopy(grant: AuthorizeGrant): string {
  const names = grant.scopes.length > 0 ? grant.scopes.join(', ') : null;

  if (grant.writeAccess) {
    return names
      ? `Vorza asks GitHub for the ${names} scope, which grants read and write access to your repositories. Vorza only reads -- it clones the repo and fetches pull requests -- but the permission GitHub offers is not read-only.`
      : 'GitHub will ask you to grant Vorza read and write access to your repositories. Vorza only reads, but the permission GitHub offers is not read-only.';
  }

  return names
    ? `Vorza asks GitHub for the ${names} scope: read-only access to your public profile and repository metadata.`
    : 'By continuing you grant Vorza read access to your public GitHub profile.';
}

export function LoginPage() {
  // Indexed but thin: this page is the second sitemap entry.
  useDocumentMeta({
    title: 'Sign in',
    description:
      'Sign in to Vorza with GitHub and connect a repository to map.',
    path: '/login',
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { user, status, login, completeLogin } = useAuth();
  const [handling, setHandling] = useState(false);
  // The grant the backend reported, fetched on mount rather than on click.
  //
  // This timing is the whole point. Fetching on click and then calling
  // `window.location.assign` means any copy rendered at that moment is never
  // seen -- the browser is already leaving the page. A consent claim that
  // appears after the decision is not a consent claim.
  //
  // Fetching on mount also means the URL we navigate to is the exact one whose
  // scopes were described, rather than a second request that could disagree.
  const [grant, setGrant] = useState<AuthorizeGrant | null>(null);
  const [grantError, setGrantError] = useState<string | null>(null);

  // `from` comes from `ProtectedRoute`, which sets it from `location.pathname`
  // -- i.e. from the address bar, so it is attacker-supplied. Sanitised here
  // rather than trusted: see safe-redirect.ts for the advisory this guards.
  const from = safeInternalPath(
    (location.state as { from?: string } | null)?.from
  );

  const query = readQuery(location.search);

  useEffect(() => {
    if (user && status === 'authenticated') {
      navigate(from, { replace: true });
    }
  }, [user, status, from, navigate]);

  useEffect(() => {
    let cancelled = false;

    async function handleOAuthResponse() {
      if (query.error) {
        toast.error('GitHub login was cancelled or rejected.');
        return;
      }
      if (cancelled || (!query.code && !query.token)) return;

      setHandling(true);
      try {
        if (query.token) {
          await completeLogin(query.token);
        } else if (query.code) {
          await login(query.code, query.state ?? undefined);
        }
        if (!cancelled) navigate(from, { replace: true });
      } catch (error) {
        toast.error(toErrorMessage(error));
        if (!cancelled) navigate('/login', { replace: true });
      } finally {
        if (!cancelled) setHandling(false);
      }
    }

    void handleOAuthResponse();
    return () => {
      cancelled = true;
    };
  }, [query.code, query.token, query.error, query.state, completeLogin, login, navigate, from]);

  // Runs once on mount. A failure here is not fatal: the GitHub button reports
  // it on click, because the alternative -- navigating to an authorize URL whose
  // scopes nobody displayed -- is what this change exists to stop.
  useEffect(() => {
    let cancelled = false;
    fetchAuthorizeGrant().then(
      (next) => {
        if (cancelled) return;
        setGrant(next);
        setGrantError(null);
      },
      () => {
        if (cancelled) return;
        setGrant(null);
        setGrantError(
          "Couldn't reach the backend, so the exact GitHub permissions requested cannot be shown. Continuing will retry."
        );
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const startOAuth = async () => {
    if (grant) {
      // Navigate to the very URL whose scopes the footer just described.
      oauthRedirect(grant.authorizeUrl);
      return;
    }
    // No grant yet -- the mount fetch failed, likely because the backend was
    // still starting. Retry rather than dead-ending.
    setHandling(true);
    try {
      const next = await fetchAuthorizeGrant();
      setGrant(next);
      setGrantError(null);
      oauthRedirect(next.authorizeUrl);
    } catch (error) {
      toast.error(toErrorMessage(error));
      setHandling(false);
    }
  };

  const useDemoAccount = async () => {
    setHandling(true);
    try {
      await login('demo');
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(toErrorMessage(error));
    } finally {
      setHandling(false);
    }
  };

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border shadow-panel">
        <CardHeader className="items-center text-center">
          <LogoMark className="mb-3 h-9 w-9 text-primary" />
          <CardTitle className="text-xl tracking-[-0.01em]">
            Sign in to Vorza
          </CardTitle>
          <CardDescription>
            The living, AI-reviewed map of your codebase. Continue with GitHub
            to see your repos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button
            size="lg"
            onClick={startOAuth}
            disabled={handling || status === 'loading'}
          >
            <Github />
            Continue with GitHub
          </Button>

          {/*
            Shown when the mount fetch failed. Without it the button looks ready
            and clicking produces an unrelated toast.
          */}
          {grantError ? (
            <p className="text-xs text-muted-foreground">{grantError}</p>
          ) : null}

          {config.useMocks ? (
            <>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">
                  backend not wired, demo mode
                </span>
                <Separator className="flex-1" />
              </div>
              <Button
                size="lg"
                variant="outline"
                onClick={useDemoAccount}
                disabled={handling || status === 'loading'}
              >
                {handling || status === 'loading' ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Github className="text-muted-foreground" />
                )}
                Use demo account
              </Button>
            </>
          ) : null}
        </CardContent>
        <CardFooter className="justify-center">
          {/*
            Rendered once the backend has reported what it will request. This
            used to be a hardcoded literal asserting "read access" -- untrue,
            because `repo` is read and write, and unverifiable from the
            frontend because the value was on the other side of the network.
          */}
          {grant ? (
            <p
              className="text-xs text-muted-foreground"
              data-testid="consent-copy"
            >
              {consentCopy(grant)}
            </p>
          ) : null}
        </CardFooter>
      </Card>
    </main>
  );
}