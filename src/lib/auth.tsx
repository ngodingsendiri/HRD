import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

export interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  setUser: (user: SessionUser | null) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  setUser: () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = () => {
    fetch("/api/auth/session")
      .then(async (r) => {
        if (!r.ok) {
          console.warn("Session fetch failed:", r.status, r.statusText);
          return null;
        }
        // Guard: handler crash can return non-JSON (e.g. HTML error page)
        const text = await r.text();
        try {
          return text ? JSON.parse(text) : null;
        } catch {
          console.warn("Session response was not valid JSON");
          return null;
        }
      })
      .then((data: { user?: SessionUser } | null) => {
        setUser(data?.user ?? null);
      })
      .catch((err) => {
        console.warn("Session fetch error:", err);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const signOut = async () => {
    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();
      // Auth.js signout also responds with a 303 redirect; use manual mode
      // so the cookie gets cleared on the response without the browser
      // navigating away to follow the redirect.
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken }),
        redirect: "manual",
        credentials: "same-origin",
      });
      setUser(null);
      window.location.href = "/";
    } catch (e) {
      toast.error("Gagal logout");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, setUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
