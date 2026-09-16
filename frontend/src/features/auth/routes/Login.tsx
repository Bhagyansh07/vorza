import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Github, LoaderCircle, MapIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { config, oauthRedirect } from '@/lib/config';
import { toErrorMessage } from '@/lib/errors';

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

/** Backend owns the OAuth URL (client_id, redirect_uri, signed state). */
async function fetchAuthorizeUrl(): Promise<string> {
  const response = await fetch(`${config.apiUrl}/auth/github/login`);
  if (!response.ok) {
    throw new Error('GitHub OAuth is not configured on the backend');
  }
  const body = (await response.json()) as { message?: string };
  if (!body.message) {
    throw new Error('GitHub OAuth is not configured on the backend');
  }
  return body.message;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, status, login, completeLogin } = useAuth();
  const [handling, setHandling] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

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

  const startOAuth = async () => {
    setHandling(true);
    try {
      const url = await fetchAuthorizeUrl();
      oauthRedirect(url);
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
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-md bg-primary/20">
            <MapIcon className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Vorza</CardTitle>
          <CardDescription>
            The living, AI-reviewed map of your codebase. Sign in with GitHub to
            see your repos.
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

          {config.useMocks ? (
            <>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">
                  backend not wired — demo mode
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
          <p className="text-xs text-muted-foreground">
            By continuing you grant Vorza read access to your GitHub repos.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}