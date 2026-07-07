/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Settings from "./pages/Settings";
import Print from "./pages/Print";
import Chat from "./pages/Chat";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "./lib/auth";

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
      let csrfToken;
      try {
        const csrfRes = await fetch("/api/auth/csrf");
        const csrfData = await csrfRes.json();
        csrfToken = csrfData.csrfToken;
      } catch (e) {
        throw new Error("Gagal terhubung ke server (CSRF Init Failed). Server mungkin sedang down atau mengalami error internal.");
      }

      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email,
          password,
          csrfToken,
          redirect: "false",
        }),
        // Auth.js always responds to credential POSTs with a 303/302 redirect
        // (to "/" on success, to "/api/auth/error?error=..." on failure). If we
        // let fetch follow it, the browser GETs the SPA index.html and we get
        // HTML back here, which looks like an opaque "non-JSON" failure.
        // Manual mode lets us inspect the redirect target instead.
        redirect: "manual",
      });

      // `redirect: "manual"` returns an opaque response (type "opaqueredirect")
      // with status 0 and no readable body/headers. The only signal we get is
      // `res.type`. A successful Auth.js flow returns a normal redirect; a
      // server-side crash returns a real error status.
      if (res.type === "opaqueredirect") {
        // Auth.js processed the request and redirected. On success it sets the
        // session cookie and redirects to "/"; on failure it redirects to an
        // error URL. Verify by fetching the session.
        const sessionRes = await fetch("/api/auth/session", { credentials: "same-origin" });
        let loggedIn = false;
        if (sessionRes.ok) {
          try {
            const session = await sessionRes.json();
            loggedIn = Boolean(session?.user);
          } catch {
            loggedIn = false;
          }
        }
        if (loggedIn) {
          toast.success("Login berhasil");
          window.location.reload();
        } else {
          toast.error("Login gagal", { description: "Email atau password salah." });
        }
      } else if (!res.ok) {
        // Real server error (500, 404, etc.) — try to parse a JSON message.
        let detail = `Server merespons dengan status ${res.status}`;
        try {
          const text = await res.text();
          if (text) {
            try {
              detail = JSON.parse(text)?.error || detail;
            } catch {
              detail = text.slice(0, 200);
            }
          }
        } catch {
          /* ignore body read errors */
        }
        toast.error("Login gagal", { description: detail });
      } else {
        // Unexpected non-redirect, non-error response — treat as failure.
        toast.error("Login gagal", { description: "Respons server tidak terduga." });
      }
    } catch (err: any) {
      console.error("Detail error login:", err);
      toast.error("Terjadi kesalahan saat login.", { description: err?.message || String(err) });
    } finally {
      setIsSubmitting(false);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-slate-500 font-medium tracking-wider"
        >
          Memuat...
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <Toaster position="top-right" richColors />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="max-w-md w-full bg-white p-8 rounded-xl border border-slate-200"
        >
          <div className="w-16 h-16 bg-slate-900 text-white rounded-xl flex items-center justify-center mx-auto mb-6">
            <LogIn className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2 text-center">
            HRCube Login
          </h1>
          <p className="text-slate-500 mb-8 text-sm text-center">
            Masukkan email dan password untuk masuk ke sistem.
          </p>

          <form
            onSubmit={handleLogin}
            className="flex flex-col gap-4"
          >
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                placeholder="email@contoh.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 px-4 rounded-lg hover:bg-slate-800 active:scale-[0.98] transition-all font-medium disabled:opacity-70"
            >
              {isSubmitting ? "Memproses..." : "Masuk"}
            </button>
          </form>


        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="employees" element={<Employees />} />
            <Route path="print" element={<Print />} />
            <Route path="settings" element={<Settings />} />
            <Route path="chat" element={<Chat />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
