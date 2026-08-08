import { ShieldHalf } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/layout-parts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';

// Whatever the server said and nothing more. Client-side hints like "no account
// with that email" would undo the enumeration protection the API goes out of
// its way to provide.
export function LoginPage(): JSX.Element {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
      navigate(from, { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? caught
          : new ApiRequestError(0, 'INTERNAL_ERROR', 'Could not reach the server. Check that the API is running.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[340px]">
        <div className="mb-5 flex items-center gap-2">
          <ShieldHalf className="size-4 text-accent" aria-hidden />
          <span className="text-[13px] font-semibold tracking-tight">ShadowScan</span>
          <span className="eyebrow ml-auto">console</span>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[3px] border border-line bg-surface">
          <div className="space-y-3 p-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(error?.fieldError('email'))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(error?.fieldError('password'))}
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="border-l-2 border-risk-critical pl-2 text-[11px] leading-relaxed text-risk-critical"
              >
                {error.message}
              </p>
            ) : null}
          </div>

          <div className="border-t border-line p-3">
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting}>
              {submitting ? <Spinner /> : null}
              {submitting ? 'Signing in' : 'Sign in'}
            </Button>
          </div>
        </form>

        <p className="mt-3 text-[10px] leading-relaxed text-fg-subtle">
          Authorised use only. Sign-in attempts are recorded.
        </p>
      </div>
    </div>
  );
}
