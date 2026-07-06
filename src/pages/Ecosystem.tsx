import { useState } from "react";
import {
  Network,
  Database,
  Code,
  Key,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";
import { motion } from "motion/react";

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const BASE_URL_PLACEHOLDER = "https://your-app.vercel.app";

const endpoints = [
  { method: "GET", path: "/api/employees", desc: "Daftar seluruh pegawai (admin only)." },
  { method: "GET", path: "/api/employees/:id", desc: "Detail satu pegawai." },
  { method: "GET", path: "/api/settings", desc: "Pengaturan aplikasi singleton." },
];

export default function Ecosystem() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const sampleFetch = `// JavaScript — baca daftar pegawai (membutuhkan sesi admin)
const res = await fetch("${BASE_URL_PLACEHOLDER}/api/employees", {
  credentials: "include", // kirim cookie sesi Auth.js
});
const employees = await res.json();`;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
      className="max-w-5xl mx-auto space-y-6 p-4 sm:p-0 sm:py-8 pb-12"
    >
      <motion.div variants={itemVariants} className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center">
            <Network className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Ekosistem & Integrasi
          </h1>
        </div>
        <p className="text-sm text-slate-500 max-w-2xl">
          HRCube menyediakan REST API terproteksi untuk aplikasi pendamping
          (DMS, Arsip, dll). Akses memerlukan sesi admin yang sah.
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-900">
          <Code className="w-4 h-4" />
          <h2 className="font-semibold">Endpoint Tersedia</h2>
        </div>
        <div className="space-y-2">
          {endpoints.map((ep) => (
            <div key={ep.path} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold tracking-wider rounded bg-slate-900 text-white">
                {ep.method}
              </span>
              <div className="min-w-0">
                <code className="text-sm font-mono text-slate-900">{ep.path}</code>
                <p className="text-xs text-slate-500 mt-0.5">{ep.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900">
            <Database className="w-4 h-4" />
            <h2 className="font-semibold">Contoh Penggunaan</h2>
          </div>
          <button
            type="button"
            onClick={() => copy(sampleFetch, "fetch")}
            className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-50"
          >
            {copied === "fetch" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied === "fetch" ? "Tersalin" : "Salin"}
          </button>
        </div>
        <pre className="bg-slate-900 text-slate-100 text-xs font-mono rounded-lg p-4 overflow-x-auto">
          <code>{sampleFetch}</code>
        </pre>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-amber-50 border border-amber-100 rounded-xl p-5 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 space-y-1">
          <p className="font-semibold">Catatan Keamanan</p>
          <p>
            Semua endpoint <code className="font-mono">/api/*</code> memerlukan
            sesi admin yang terautentikasi via GitHub. Tidak ada akses publik ke
            data pegawai — berbeda dari konfigurasi Firebase sebelumnya.
          </p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <div className="flex items-center gap-2 text-slate-900">
          <Key className="w-4 h-4" />
          <h2 className="font-semibold">Setup Aplikasi Pendamping</h2>
        </div>
        <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
          <li>Pastikan akun admin terdaftar di <code className="font-mono">ADMIN_GITHUB_IDS</code>.</li>
          <li>Login sekali via <code className="font-mono">/api/auth/signin</code> untuk mendapatkan cookie sesi.</li>
          <li>Sertakan <code className="font-mono">credentials: "include"</code> pada setiap request fetch.</li>
        </ol>
      </motion.div>
    </motion.div>
  );
}
