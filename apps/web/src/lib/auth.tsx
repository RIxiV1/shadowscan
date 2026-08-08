import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginResponse, UserDto } from '@shadowscan/shared';
import { apiRequest, getAccessToken, onSessionExpired, setAccessToken } from './api-client';

// Session state.
type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: UserDto | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [status, setStatus] = useState<AuthStatus>(() => (getAccessToken() ? 'checking' : 'anonymous'));
  const [user, setUser] = useState<UserDto | null>(null);

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setStatus('anonymous');
      return;
    }
    try {
      const profile = await apiRequest<UserDto>('/auth/me');
      setUser(profile);
      setStatus('authenticated');
    } catch {
      // A stored token that the server rejects - expired, revoked, or issued by
      // a previous deployment with a different secret - is simply discarded.
      setAccessToken(null);
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The API client emits this on any 401, including one raised by a background
  // query. Without it, an expired session leaves the shell rendered with every
  // panel showing its own error.
  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null);
        setStatus('anonymous');
      }),
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setAccessToken(result.accessToken);
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(() => {
    // Sign-out is purely client-side: the token is stateless and short-lived, so
    // there is no server session to destroy. Discarding it is the whole
    // operation. A server-side denylist would be the addition needed to make
    // this a true revocation, and it is not warranted at this scale.
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, isAdmin: user?.role === 'admin', signIn, signOut, refresh }),
    [status, user, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
