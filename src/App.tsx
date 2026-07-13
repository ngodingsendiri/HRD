/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useEffect, useState, lazy, Suspense, type ReactNode } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { Toaster, toast } from "sonner";
import { motion } from "motion/react";
import { useAuth } from "./lib/auth";
import { btnPrimary, easeOut, input, label } from "./lib/ui";

/** Route-level code split — keep initial JS small. */
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Employees = lazy(() => import("./pages/Employees"));
const Print = lazy(() => import("./pages/Print"));
const Settings = lazy(() => import("./pages/Settings"));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh] gap-2 text-sm text-slate-500">
      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      Memuat halaman…
    </div>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

/**
 * Data router required for useBlocker (Settings unsaved-changes guard).
 * BrowserRouter does not support useBlocker — see React Router "picking a router".
 */
const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <LazyPage>
            <Dashboard />
          </LazyPage>
        ),
      },
      {
        path: "employees",
        element: (
          <LazyPage>
            <Employees />
          </LazyPage>
        ),
      },
      {
        path: "print",
        element: (
          <LazyPage>
            <Print />
          </LazyPage>
        ),
      },
      {
        path: "settings",
        element: (
          <LazyPage>
            <Settings />
          </LazyPage>
        ),
      },
    ],
  },
]);

export default function App() {
  const { user, loading, setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleOnline = () =>
      toast.success("Kembali Online", {
        description: "Koneksi internet Anda telah pulih.",
      });
    const handleOffline = () =>
      toast.error("Koneksi Terputus", {
        description:
          "Anda sedang offline. Beberapa fitur mungkin tidak tersedia.",
      });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handlePwaUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const updateSW = customEvent.detail.updateSW;
      toast("Pembaruan Tersedia", {
        description:
          "Versi baru aplikasi telah tersedia. Muat ulang untuk memperbarui?",
        action: { label: "Muat Ulang", onClick: () => updateSW(true) },
        duration: Infinity,
      });
    };
    window.addEventListener("pwa-update", handlePwaUpdate);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pwa-update", handlePwaUpdate);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.user) {
        const serverMsg =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.message === "string"
              ? data.message
              : null;
        const detail =
          typeof data?.detail === "string" ? data.detail : null;
        const code = typeof data?.code === "string" ? data.code : null;
        toast.error("Login gagal", {
          description: [
            serverMsg ||
              (res.status === 404
                ? "Endpoint API tidak ditemukan (routing)."
                : res.status === 503
                  ? "Server belum siap (AUTH_SECRET / database)."
                  : `Status ${res.status}`),
            code ? `[${code}]` : null,
            detail,
          ]
            .filter(Boolean)
            .join(" · "),
        });
      } else {
        toast.success("Login berhasil");
        setUser(data.user);
      }
    } catch (err: unknown) {
      console.error("Detail error login:", err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Terjadi kesalahan saat login.", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={easeOut}
          className="flex items-center gap-2 text-slate-500 text-sm font-medium"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          Memuat...
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Toaster position="top-right" richColors closeButton />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={easeOut}
          className="max-w-md w-full bg-white p-6 sm:p-8 rounded-xl border border-slate-200"
        >
          <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center mx-auto mb-5">
            <LogIn className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-1 text-center">
            HRD ASN
          </h1>
          <p className="text-slate-500 mb-6 text-sm text-center">
            Masuk untuk mengelola data kepegawaian dinas Anda.
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className={label}>
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={input}
                placeholder="email@contoh.com"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="login-password" className={label}>
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={input}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`${btnPrimary} w-full mt-1 py-2.5`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Masuk"
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors closeButton />
      <RouterProvider router={appRouter} />
    </ErrorBoundary>
  );
}
