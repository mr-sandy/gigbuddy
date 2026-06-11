import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

export type AuthState =
  | { status: 'unknown' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; daysUntilExpiry: number };

interface AuthContextValue {
  auth: AuthState;
  setAuth: (next: AuthState) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ initial, children }: { initial: AuthState; children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(initial);
  const value = useMemo(() => ({ auth, setAuth }), [auth]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
