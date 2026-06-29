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
import { useEffect, useState } from "react";
import { auth } from "./lib/firebase";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  User,
} from "firebase/auth";
import { LogIn } from "lucide-react";
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

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
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pwa-update", handlePwaUpdate);
    };
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
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
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="max-w-md w-full bg-white p-8 rounded-xl border border-slate-200 text-center "
        >
          <div className="w-16 h-16 bg-slate-900 text-white rounded-xl flex items-center justify-center mx-auto mb-6 ">
            <LogIn className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
            dataHRD Login
          </h1>
          <p className="text-slate-500 mb-8 text-sm">
            Aplikasi ini dilindungi. Silakan login menggunakan akun Google yang
            terdaftar sebagai Admin.
          </p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 py-2.5 px-4 rounded-lg hover:bg-slate-50 active:scale-[0.98] transition-all font-medium "
          >
            <svg
              className="w-5 h-5 bg-white rounded-full p-0.5"
              viewBox="0 0 24 24"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Login dengan Google
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
