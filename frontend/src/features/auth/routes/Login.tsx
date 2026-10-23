import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Github, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Logo, LogoMark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { LazyGuidedTour } from '@/features/tour/LazyGuidedTour';
import { LOGIN_TOUR } from '@/features/tour/steps';
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
 */
interface AuthorizeGrant {
  authorizeUrl: string;
  scopes: string[];
  writeAccess: boolean;
}

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
    writeAccess: body.write_access === true,
  };
}

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
  const [grant, setGrant] = useState<AuthorizeGrant | null>(null);
  const [grantError, setGrantError] = useState<string | null>(null);

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
      oauthRedirect(grant.authorizeUrl);
      return;
    }
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
    <div className="relative min-h-svh flex flex-col justify-between bg-background overflow-hidden">
      {/* Unified cyber grid and radial auras */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(168,242,90,0.12),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-cyber-grid bg-[size:44px_44px] opacity-20 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_45%,black_40%,transparent_100%)]" />

      <header className="relative z-10 flex items-center justify-between p-6 max-w-6xl w-full mx-auto">
        <Link to="/" aria-label="Vorza home">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <Card
          className="w-full max-w-md rounded-3xl border border-line/70 bg-surface/85 p-4 shadow-2xl backdrop-blur-2xl transition-all shadow-primary/5"
          data-tour="login-card"
        >
          <CardHeader className="items-center text-center pt-6">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/25 shadow-xs transition-transform hover:scale-105">
              <LogoMark className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-ink">
              Sign in to Vorza
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-ink-dim mt-1.5 leading-relaxed">
              The living, AI-reviewed map of your codebase. Continue with GitHub
              to see your repos.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-3.5 px-6">
            <Button
              size="lg"
              onClick={startOAuth}
              disabled={handling || status === 'loading'}
              className="h-12 rounded-xl text-sm font-semibold shadow-md gap-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Github className="h-5 w-5" />
              Continue with GitHub
            </Button>

            {grantError ? (
              <p className="text-xs text-signal-warn bg-signal-warn/10 p-2.5 rounded-lg border border-signal-warn/25">
                {grantError}
              </p>
            ) : null}

            {config.useMocks ? (
              <>
                <div className="flex items-center gap-3 my-1">
                  <Separator className="flex-1" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                    Demo Mode
                  </span>
                  <Separator className="flex-1" />
                </div>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={useDemoAccount}
                  disabled={handling || status === 'loading'}
                  className="h-12 rounded-xl border-line/80 font-medium hover:bg-raised/80 transition-all"
                >
                  {handling || status === 'loading' ? (
                    <LoaderCircle className="animate-spin h-4 w-4" />
                  ) : (
                    <Github className="h-4 w-4 text-ink-dim" />
                  )}
                  Use demo account
                </Button>
              </>
            ) : null}
          </CardContent>

          <CardFooter className="justify-center px-6 pb-6 pt-2" data-tour="login-consent">
            {grant ? (
              <p
                className="text-xs text-ink-faint text-center leading-relaxed"
                data-testid="consent-copy"
              >
                {consentCopy(grant)}
              </p>
            ) : null}
          </CardFooter>
        </Card>
      </main>

      <footer className="relative z-10 py-6 text-center text-xs text-ink-faint">
        Vorza · Software intelligence for modern engineering teams
      </footer>

      {/* Vorpy's guided tour. Lazy: see `mascot-boundary.test.ts`. */}
      <LazyGuidedTour tour={LOGIN_TOUR} />
    </div>
  );
}