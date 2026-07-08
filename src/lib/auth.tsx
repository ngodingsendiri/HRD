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
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json();
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
      await fetch("/api/auth/logout", {
        method: "POST",
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
