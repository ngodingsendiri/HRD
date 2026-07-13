import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

export type UserRole = "ADMIN" | "VIEWER";

export interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: UserRole;
  canWrite?: boolean;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  canWrite: boolean;
  setUser: (user: SessionUser | null) => void;
  signOut: (opts?: { allDevices?: boolean }) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  canWrite: false,
  setUser: () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = () => {
    fetch("/api/auth/me", { credentials: "same-origin" })
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

  const signOut = async (opts?: { allDevices?: boolean }) => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allDevices: Boolean(opts?.allDevices) }),
      });
      setUser(null);
      window.location.href = "/";
    } catch {
      toast.error("Gagal logout");
    }
  };

  // Fail-closed: only explicit canWrite from server grants mutations in UI
  const canWrite = Boolean(user?.canWrite);

  return (
    <AuthContext.Provider value={{ user, loading, canWrite, setUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
