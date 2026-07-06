import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Client-side auth for the Vite SPA.
 *
 * Auth.js sessions live in an httpOnly cookie set by /api/auth/*. We can't
 * read the cookie from JS, so we query /api/auth/session to know who is
 * logged in. Sign-in / sign-out happen via full-page redirect to the Auth.js
 * endpoints (standard pattern for non-Next.js SPAs).
 */

export interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data: { user?: SessionUser }) => {
        if (active) setUser(data.user ?? null);
      })
      .catch(() => {
        /* offline or unauthenticated — stay null */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = () => {
    // Redirect to GitHub OAuth via Auth.js. Return here after callback.
    window.location.href = "/api/auth/signin/github";
  };

  const signOut = () => {
    window.location.href = "/api/auth/signout";
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
