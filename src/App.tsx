/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useEffect, useState, lazy, Suspense, type ReactNode } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Toaster, toast } from "sonner";
import { motion } from "motion/react";
import { useAuth } from "./lib/auth";
import { btnPrimary, easeOut, input, label } from "./lib/ui";
import { routeLoaders } from "./lib/routePrefetch";
import { warmAppInBackground } from "./lib/bootstrap";

/** Route-level code split — keep initial JS small. Prefetch via routePrefetch. */

const Dashboard = lazy(routeLoaders.dashboard);
const Employees = lazy(routeLoaders.employees);
const EmployeeFormPage = lazy(routeLoaders.employeeForm);
const Print = lazy(routeLoaders.print);
const Settings = lazy(routeLoaders.settings);

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
        path: "employees/new",
        element: (
          <LazyPage>
            <EmployeeFormPage />
          </LazyPage>
        ),
      },
      {
        path: "employees/:id/edit",
        element: (
          <LazyPage>
            <EmployeeFormPage />
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
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
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

  // After auth: open shell immediately; warm stats/settings in background
  useEffect(() => {
    if (!user) return;
    warmAppInBackground();
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLoginError(null);
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
        const msg =
          serverMsg ||
          (res.status === 404
            ? "Layanan login tidak ditemukan."
            : res.status === 503
              ? "Server belum siap. Hubungi admin (database / AUTH_SECRET)."
              : res.status === 429
                ? "Terlalu banyak percobaan. Coba lagi nanti."
                : "Email atau password salah.");
        setLoginError(msg);
        toast.error("Login gagal", { description: msg });
      } else {
        toast.success("Login berhasil");
        setUser(data.user);
      }
    } catch (err: unknown) {
      console.error("Detail error login:", err);
      const message =
        err instanceof Error ? err.message : "Tidak dapat terhubung ke server.";
      setLoginError(message);
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
        <Toaster position="top-right" richColors closeButton />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={easeOut}
          className="max-w-md w-full bg-white p-6 sm:p-8 rounded-xl border border-slate-200"
        >
          <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center mx-auto mb-5 text-xs font-bold tracking-tight">
            HA
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-1 text-center">
            HRD ASN
          </h1>
          <p className="text-slate-500 mb-6 text-sm text-center">
            Masuk untuk mengelola data kepegawaian dinas Anda.
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {loginError && (
              <div
                role="alert"
                className="p-3 rounded-lg border border-red-100 bg-red-50 text-red-700 text-sm"
              >
                {loginError}
              </div>
            )}
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (loginError) setLoginError(null);
                }}
                className={input}
                placeholder="email@contoh.com"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="login-password" className={label}>
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (loginError) setLoginError(null);
                  }}
                  className={`${input} pr-10`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
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
