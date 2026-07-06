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
import Ecosystem from "./pages/Ecosystem";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useEffect } from "react";
import { LogIn } from "lucide-react";
import { Toaster, toast } from "sonner";
import { motion } from "motion/react";
import { useAuth } from "./lib/auth";

export default function App() {
  const { user, loading, signIn } = useAuth();

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
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="max-w-md w-full bg-white p-8 rounded-xl border border-slate-200 text-center"
        >
          <div className="w-16 h-16 bg-slate-900 text-white rounded-xl flex items-center justify-center mx-auto mb-6">
            <LogIn className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
            HRCube Login
          </h1>
          <p className="text-slate-500 mb-8 text-sm">
            Aplikasi ini dilindungi. Silakan login menggunakan akun GitHub yang
            terdaftar sebagai Admin.
          </p>
          <button
            type="button"
            onClick={signIn}
            className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-2.5 px-4 rounded-lg hover:bg-slate-800 active:scale-[0.98] transition-all font-medium"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            Login dengan GitHub
          </button>
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
            <Route path="ecosystem" element={<Ecosystem />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
